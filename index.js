/**
 * Host half of the co-writing document plugin.
 *
 * The browser half cannot touch the filesystem, so this plugin exposes one
 * same-origin JSON route on the Web carrier and performs the reads and writes
 * itself: list the workspace's text documents, read one, stat one, and save
 * one. Every request is resolved against a workspace root that the Host knows
 * (the Session's working directory, the default directory, or a registered
 * workspace), and a resolved path that escapes that root is refused.
 *
 * Saving is compare-and-swap: the client sends the modification time it last
 * saw, and a write against a newer file is rejected with `conflict` instead of
 * silently overwriting whatever the Agent just wrote.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const ROUTE = '/api/dsh-cowrite'
/** Image bytes for the preview: an `<img>` tag cannot send a JSON body. */
const RAW_ROUTE = '/api/dsh-cowrite/raw'
/** Receives a pasted or dropped picture and writes it beside the document. */
const UPLOAD_ROUTE = '/api/dsh-cowrite/upload'
const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_READ_BYTES = 4 * 1024 * 1024
const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const IMAGE_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.svg', 'image/svg+xml'],
])
const MAX_FILES = 600
const MAX_DEPTH = 6
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.txt'])
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.obsidian',
  '.venv',
  'venv',
  'dist',
  'build',
  'out',
  'target',
  '.next',
  '.nuxt',
  '.cache',
  '.idea',
])

/** One refusal with a stable code the browser half can translate. */
class CowriteError extends Error {
  constructor(code, detail) {
    super(detail === undefined ? code : `${code}: ${detail}`)
    this.code = code
    this.detail = detail
  }
}

/**
 * The Host's root for one request, including the roots a client-supplied
 * directory must stay inside.
 * @param ctx - host plugin context.
 * @param request - parsed request body.
 * @returns resolved absolute root.
 */
async function resolveRoot(ctx, request) {
  const roots = []
  const workingDirectory = ctx.get('workingDirectory')
  const agents = ctx.get('agents')

  if (workingDirectory && agents && typeof request.sessionId === 'string' && request.sessionId !== '') {
    try {
      const agent = agents.get(request.sessionId)
      if (agent !== undefined) {
        const directory = await workingDirectory.ensure(agent)
        if (typeof directory === 'string' && directory !== '') roots.push(directory)
      }
    } catch {
      /* the Session may have no live Agent; fall through to the other roots */
    }
  }
  if (workingDirectory && typeof workingDirectory.defaultDirectory === 'string' && workingDirectory.defaultDirectory !== '') {
    roots.push(workingDirectory.defaultDirectory)
  }
  try {
    const registry = ctx.get('workspaceRegistry')
    for (const workspace of registry?.list?.() ?? []) {
      if (typeof workspace?.path === 'string' && workspace.path !== '') roots.push(workspace.path)
    }
  } catch {
    /* an absent registry only narrows the allow-list */
  }

  const allowed = []
  for (const candidate of roots) {
    try {
      const resolved = path.resolve(candidate)
      if (!allowed.includes(resolved)) allowed.push(resolved)
    } catch {
      /* an unusable root is simply not allowed */
    }
  }
  if (allowed.length === 0) throw new CowriteError('no-root')

  // A client-supplied directory wins only when it is inside a known root, so
  // the allow-list, not the request, decides what this route can reach.
  if (typeof request.root === 'string' && request.root !== '') {
    const requested = path.resolve(request.root)
    const matched = allowed
      .filter((root) => requested === root || requested.startsWith(root + path.sep))
      .sort((a, b) => b.length - a.length)[0]
    if (matched !== undefined) return requested
    // Refuse rather than silently reading some other directory: a wrong root
    // would look like an empty workspace instead of a permission problem.
    throw new CowriteError('root-not-allowed', requested)
  }
  return allowed[0]
}

/**
 * Join a client path onto the root, refusing anything that leaves it.
 * @param root - resolved absolute root.
 * @param relative - workspace-relative path from the request.
 * @returns resolved absolute path.
 */
function resolveInside(root, relative) {
  if (typeof relative !== 'string' || relative === '' || relative.includes('\0')) {
    throw new CowriteError('bad-path')
  }
  if (path.isAbsolute(relative)) throw new CowriteError('bad-path')
  const absolute = path.resolve(root, relative)
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new CowriteError('outside-root')
  }
  return absolute
}

/** Recursively collect text documents under one directory. */
async function collectDocuments(directory, prefix, output, depth) {
  if (depth > MAX_DEPTH || output.length >= MAX_FILES) return
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch {
    return
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  for (const entry of entries) {
    if (output.length >= MAX_FILES) return
    if (entry.name.startsWith('.')) continue
    const absolute = path.join(directory, entry.name)
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      await collectDocuments(absolute, relative, output, depth + 1)
      continue
    }
    if (!entry.isFile()) continue
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
    let info
    try {
      info = await fs.stat(absolute)
    } catch {
      continue
    }
    output.push({ path: relative, size: info.size, mtimeMs: Math.round(info.mtimeMs) })
  }
}

/** Read the JSON request body, refusing oversized payloads. */
async function readJsonBody(req) {
  const text = await new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        settled = true
        reject(new CowriteError('body-too-large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
  if (text.trim() === '') return {}
  try {
    const parsed = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new CowriteError('bad-json')
  }
}

/** One action's work, returning the payload for `data`. */
async function runAction(ctx, request) {
  const root = await resolveRoot(ctx, request)
  const action = request.action

  if (action === 'list') {
    const documents = []
    await collectDocuments(root, '', documents, 0)
    return { root, files: documents, truncated: documents.length >= MAX_FILES }
  }

  if (action === 'read') {
    const absolute = resolveInside(root, request.path)
    let info
    try {
      info = await fs.stat(absolute)
    } catch {
      throw new CowriteError('not-found', request.path)
    }
    if (!info.isFile()) throw new CowriteError('not-a-file', request.path)
    if (info.size > MAX_READ_BYTES) throw new CowriteError('too-large', request.path)
    const content = await fs.readFile(absolute, 'utf8')
    return { path: request.path, content, size: info.size, mtimeMs: Math.round(info.mtimeMs) }
  }

  if (action === 'stat') {
    const absolute = resolveInside(root, request.path)
    try {
      const info = await fs.stat(absolute)
      return { path: request.path, size: info.size, mtimeMs: Math.round(info.mtimeMs) }
    } catch {
      return { path: request.path, missing: true }
    }
  }

  if (action === 'write') {
    const absolute = resolveInside(root, request.path)
    if (typeof request.content !== 'string') throw new CowriteError('bad-content')
    let current
    try {
      current = await fs.stat(absolute)
    } catch {
      current = undefined
    }
    if (typeof request.baseMtimeMs === 'number' && current !== undefined) {
      const observed = Math.round(current.mtimeMs)
      if (observed !== Math.round(request.baseMtimeMs)) {
        // The file moved under the client: hand back what is on disk now and
        // let the human decide, instead of clobbering the Agent's write.
        const content = current.size > MAX_READ_BYTES ? '' : await fs.readFile(absolute, 'utf8')
        return { conflict: true, path: request.path, content, size: current.size, mtimeMs: observed }
      }
    }
    const temporary = `${absolute}.cowrite-${randomBytes(4).toString('hex')}`
    try {
      await fs.writeFile(temporary, request.content, 'utf8')
      await fs.rename(temporary, absolute)
    } catch (error) {
      try {
        await fs.unlink(temporary)
      } catch {
        /* the temporary file may not exist */
      }
      throw new CowriteError('write-failed', error instanceof Error ? error.message : String(error))
    }
    const written = await fs.stat(absolute)
    return { path: request.path, size: written.size, mtimeMs: Math.round(written.mtimeMs) }
  }

  throw new CowriteError('unknown-action', typeof action === 'string' ? action : 'missing')
}

/**
 * The content type for one image path.
 * @param absolute - resolved file path.
 * @returns the media type, or null when this is not a supported image.
 */
function imageType(absolute) {
  return IMAGE_TYPES.get(path.extname(absolute).toLowerCase()) ?? null
}

/**
 * Whether the request comes from a page this Host admitted. The Web carrier
 * hands every browser session a `dsh-auth-*` cookie, and a request without one
 * is a local process rather than the GUI. This is the fallback used only when
 * the composition exposes no `connection` service; otherwise the platform's own
 * admission does the work.
 * @param req - the incoming request.
 * @returns `true` for a browser session.
 */
function isTrustedRequest(req) {
  return /(?:^|;\s*)dsh-auth-[^=]+=/.test(String(req.headers.cookie ?? ''))
}

/**
 * Ask the composition's `connection` service whether this request is admitted.
 * It owns the Host/Origin fence (DNS rebinding, cross-site calls) and the
 * login-cookie gate, so a route that asks it needs no second opinion.
 * @param ctx - host context.
 * @param req - the incoming request.
 * @returns `undefined` when admitted or when the service is absent, else the
 *   status code to answer with.
 */
function admissionStatus(ctx, req) {
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  if (connection === undefined || connection === null) return undefined
  if (typeof connection.requestRejection !== 'function') return undefined
  return connection.requestRejection(req)
}

/**
 * Answer a request the platform rejects.
 * @param ctx - host context.
 * @param req - the incoming request.
 * @param res - the response to close.
 * @returns `true` when the request was answered and the handler must stop.
 */
function rejectUnauthorized(ctx, req, res) {
  const status = admissionStatus(ctx, req)
  if (status !== undefined) {
    res.statusCode = status
    try {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: false, code: 'unauthorized' }))
    } catch {
      res.end()
    }
    return true
  }
  // No platform admission available: keep the local fence as a fallback.
  if (typeof ctx.get === 'function' && ctx.get('connection') !== undefined) return false
  if (!isTrustedRequest(req)) {
    sendJson(res, 401, { ok: false, code: 'unauthorized' })
    return true
  }
  return false
}

/** Send one JSON envelope. */
/**
 * Decode one base64 image and write it into the workspace.
 * @param ctx - host context, used to resolve the workspace root.
 * @param request - `{ path, data, root }` where `data` is base64.
 * @returns the stored path relative to the root, its size and modification time.
 */
async function storeImage(ctx, request) {
  const scope = await resolveRoot(ctx, { root: request.root, sessionId: request.sessionId })
  const absolute = resolveInside(scope, request.path)
  const type = imageType(absolute)
  if (type === null) throw new CowriteError('not-an-image', String(request.path))
  if (typeof request.data !== 'string' || request.data === '') throw new CowriteError('bad-data')
  const bytes = Buffer.from(request.data, 'base64')
  if (bytes.length === 0) throw new CowriteError('bad-data')
  if (bytes.length > MAX_IMAGE_BYTES) throw new CowriteError('too-large', String(request.path))
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  const temporary = `${absolute}.cowrite-${randomBytes(4).toString('hex')}`
  try {
    await fs.writeFile(temporary, bytes)
    await fs.rename(temporary, absolute)
  } catch (error) {
    try {
      await fs.unlink(temporary)
    } catch {
      /* the temporary file may not exist */
    }
    throw new CowriteError('write-failed', error instanceof Error ? error.message : String(error))
  }
  const written = await fs.stat(absolute)
  return {
    path: request.path,
    size: written.size,
    mtimeMs: Math.round(written.mtimeMs),
    type,
  }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  /**
   * Store one pasted picture next to the document that references it.
   * The body is JSON with base64 bytes, which keeps this on the same envelope
   * as every other action instead of a second content type.
   * @param req - the incoming POST.
   * @param res - the JSON response.
   */
  const uploadHandler = async (req, res) => {
    try {
      if (rejectUnauthorized(ctx, req, res)) return
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method-not-allowed' })
        return
      }
      const origin = req.headers.origin
      if (typeof origin === 'string' && origin !== '') {
        let originHost
        try {
          originHost = new URL(origin).host
        } catch {
          sendJson(res, 400, { ok: false, code: 'bad-origin' })
          return
        }
        if (typeof req.headers.host !== 'string' || originHost !== req.headers.host) {
          sendJson(res, 403, { ok: false, code: 'origin-not-allowed' })
          return
        }
      }
      if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        sendJson(res, 415, { ok: false, code: 'json-required' })
        return
      }
      let request
      let data
      try {
        request = await readJsonBody(req)
        data = await storeImage(ctx, request)
      } catch (error) {
        if (error instanceof CowriteError) {
          sendJson(res, error.code === 'no-root' ? 409 : 400, {
            ok: false,
            code: error.code,
            detail: error.detail ?? null,
          })
          return
        }
        sendJson(res, 500, {
          ok: false,
          code: 'internal',
          detail: error instanceof Error ? error.message : String(error),
        })
        return
      }
      sendJson(res, 200, { ok: true, data })
    } catch (error) {
      try {
        sendJson(res, 500, {
          ok: false,
          code: 'internal',
          detail: error instanceof Error ? error.message : String(error),
        })
      } catch {
        /* the socket may already be gone */
      }
    }
  }

  /**
   * Serve one workspace image to the preview.
   * @param req - the incoming GET.
   * @param res - the response to stream into.
   */
  const rawHandler = async (req, res) => {
    let streaming = false
    try {
      if (rejectUnauthorized(ctx, req, res)) return
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { ok: false, code: 'method-not-allowed' })
        return
      }
      const url = new URL(String(req.url ?? '/'), 'http://localhost')
      const root = url.searchParams.get('root')
      const relative = url.searchParams.get('path')
      const scope = await resolveRoot(ctx, { root: root ?? undefined })
      const absolute = resolveInside(scope, relative ?? '')
      const type = imageType(absolute)
      if (type === null) throw new CowriteError('not-an-image', String(relative))
      let info
      try {
        info = await fs.stat(absolute)
      } catch {
        throw new CowriteError('not-found', String(relative))
      }
      if (!info.isFile()) throw new CowriteError('not-a-file', String(relative))
      if (info.size > MAX_IMAGE_BYTES) throw new CowriteError('too-large', String(relative))
      res.statusCode = 200
      res.setHeader('Content-Type', type)
      res.setHeader('Content-Length', String(info.size))
      res.setHeader('Cache-Control', 'no-store')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      streaming = true
      await pipeline(createReadStream(absolute), res)
    } catch (error) {
      if (streaming) {
        try {
          res.destroy()
        } catch {
          /* the socket is already gone */
        }
        return
      }
      if (error instanceof CowriteError) {
        sendJson(res, error.code === 'not-found' ? 404 : 400, {
          ok: false,
          code: error.code,
          detail: error.detail ?? null,
        })
        return
      }
      sendJson(res, 500, {
        ok: false,
        code: 'internal',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Install both routes on the Web carrier.
   * @param owner - the context whose effect owns the registrations.
   */
  const install = (owner) => {
    const server =
      owner && typeof owner.get === 'function' ? owner.get('webServer') : owner?.webServer
    if (!server || typeof server.register !== 'function') return undefined

    const handler = async (req, res) => {
      try {
        if (rejectUnauthorized(ctx, req, res)) return
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, code: 'method-not-allowed' })
          return
        }
        const origin = req.headers.origin
        if (typeof origin === 'string' && origin !== '') {
          let originHost
          try {
            originHost = new URL(origin).host
          } catch {
            sendJson(res, 400, { ok: false, code: 'bad-origin' })
            return
          }
          if (typeof req.headers.host !== 'string' || originHost !== req.headers.host) {
            sendJson(res, 403, { ok: false, code: 'origin-not-allowed' })
            return
          }
        }
        if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          sendJson(res, 415, { ok: false, code: 'json-required' })
          return
        }
        let request
        let data
        try {
          request = await readJsonBody(req)
          data = await runAction(ctx, request)
        } catch (error) {
          if (error instanceof CowriteError) {
            sendJson(res, error.code === 'no-root' ? 409 : 400, {
              ok: false,
              code: error.code,
              detail: error.detail ?? null,
            })
            return
          }
          sendJson(res, 500, {
            ok: false,
            code: 'internal',
            detail: error instanceof Error ? error.message : String(error),
          })
          return
        }
        sendJson(res, 200, { ok: true, data })
      } catch (error) {
        try {
          sendJson(res, 500, {
            ok: false,
            code: 'internal',
            detail: error instanceof Error ? error.message : String(error),
          })
        } catch {
          /* the socket may already be gone */
        }
      }
    }

    const disposers = [
      server.register({ kind: 'prefix', path: ROUTE, handler }),
      server.register({ kind: 'prefix', path: RAW_ROUTE, handler: rawHandler }),
      server.register({ kind: 'prefix', path: UPLOAD_ROUTE, handler: uploadHandler }),
    ]
    return () => {
      for (const dispose of disposers) {
        try {
          if (typeof dispose === 'function') dispose()
        } catch {
          /* one failed disposal must not leak the other */
        }
      }
    }
  }

  // The Web carrier can mount after profile bundles, so a single read at apply
  // time would silently find no service and never register. Try it once, then
  // wait for the service through Cordis' reactive injection.
  const immediate = install(ctx)
  if (immediate !== undefined) {
    ctx.effect(() => immediate, 'cowrite: document route')
    return
  }
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (carrierCtx) => {
      carrierCtx.effect(() => install(carrierCtx), 'cowrite: document route')
    })
  }
}
