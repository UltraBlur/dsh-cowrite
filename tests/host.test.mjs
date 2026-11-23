import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply } from '../index.js'

// Build the fixture ourselves: the suite must run on a fresh clone.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cowrite-ws-'))
fs.mkdirSync(path.join(ROOT, 'sub'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'notes.txt'), 'plain text\n')
fs.writeFileSync(path.join(ROOT, 'sub/notes.md'), '# sub\n')
fs.writeFileSync(path.join(ROOT, 'notes-zh.md'), '# 标题\n\n第一段正文。\n')
// Gallery fixture: real PNG signature plus readable bytes the suite can assert on.
fs.writeFileSync(
  path.join(ROOT, 'pic.png'),
  Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.from('FAKEPNG', 'utf8'),
  ]),
)
process.on('exit', () => {
  try {
    fs.rmSync(ROOT, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})
const routes = {}
let captured = null
const fakes = {
  webServer: {
    register(route) {
      routes[route.path] = route
      if (route.path === '/api/dsh-cowrite') captured = route
      return () => {
        delete routes[route.path]
      }
    },
  },
  workingDirectory: {
    defaultDirectory: ROOT,
    ensure: async () => ROOT,
  },
  agents: { get: () => undefined },
  workspaceRegistry: { list: () => [] },
}
const ctx = {
  get: (name) => fakes[name],
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
}

apply(ctx)
if (captured === null) throw new Error('route was not registered')
if (captured.kind !== 'prefix' || captured.path !== '/api/dsh-cowrite') {
  throw new Error(`unexpected route ${captured.kind} ${captured.path}`)
}
console.log('routes registered:', Object.keys(routes).join(', '))
if (routes['/api/dsh-cowrite/raw'] === undefined) throw new Error('image route missing')

function request(payload, overrides) {
  return new Promise((resolve) => {
    const req = new EventEmitter()
    req.method = 'POST'
    req.headers = {
      'content-type': 'application/json',
      host: '127.0.0.1:1',
      origin: 'http://127.0.0.1:1',
      cookie: 'dsh-auth-test=1',
    }
    const chunks = []
    const res = {
      statusCode: 200,
      setHeader() {},
      end(text) {
        chunks.push(text)
        resolve({ status: res.statusCode, body: JSON.parse(text) })
      },
    }
    if (overrides && 'cookie' in overrides) {
      if (overrides.cookie === undefined) delete req.headers.cookie
      else req.headers.cookie = overrides.cookie
    }
    const promise = captured.handler(req, res)
    req.emit('data', Buffer.from(JSON.stringify(payload), 'utf8'))
    req.emit('end')
    return promise
  })
}

const checks = []
const check = (name, condition, extra) => {
  checks.push({ name, ok: Boolean(condition), extra })
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${condition ? '' : ` → ${JSON.stringify(extra)}`}`)
}

const untrusted = await request({ action: 'list' }, { cookie: undefined })
check('request without the browser cookie is refused', untrusted.body.ok === false && untrusted.body.code === 'unauthorized', untrusted.body)

const list = await request({ action: 'list', sessionId: 's1', root: ROOT })
check(
  'list returns every text file and no binaries',
  list.body.ok &&
    list.body.data.files.map((f) => f.path).join(',') === 'notes-zh.md,notes.txt,sub/notes.md',
  list.body.data.files.map((f) => f.path),
)
check('list reports the root', list.body.data?.root === ROOT, list.body.data?.root)

const read = await request({ action: 'read', action_path: 1, path: 'notes-zh.md' })
check('read without session resolves via default root', read.body.ok && read.body.data.content.includes('第一段'), read.body)

const outside = await request({ action: 'read', sessionId: 's1', root: ROOT, path: '../etc/passwd' })
check('parent escape refused', outside.body.ok === false && outside.body.code === 'outside-root', outside.body)

const absolute = await request({ action: 'read', sessionId: 's1', root: ROOT, path: '/etc/passwd' })
check('absolute path refused', absolute.body.ok === false && absolute.body.code === 'bad-path', absolute.body)

const missing = await request({ action: 'read', sessionId: 's1', root: ROOT, path: 'nope.md' })
check('missing file refused', missing.body.ok === false && missing.body.code === 'not-found', missing.body)

const baseMtime = read.body.data.mtimeMs
const write = await request({
  action: 'write',
  sessionId: 's1',
  root: ROOT,
  path: 'notes-zh.md',
  content: '# 标题\n\n改过的第一段。\n',
  baseMtimeMs: baseMtime,
})
check('write succeeds with matching base mtime', write.body.ok && write.body.data.content === undefined, write.body)

const reread = await request({ action: 'read', sessionId: 's1', root: ROOT, path: 'notes-zh.md' })
check('written content is on disk', reread.body.data.content.includes('改过的第一段'), reread.body.data?.content)

const stale = await request({
  action: 'write',
  sessionId: 's1',
  root: ROOT,
  path: 'notes-zh.md',
  content: 'clobber attempt',
  baseMtimeMs: baseMtime,
})
check('stale write returns conflict, not a write', stale.body.ok && stale.body.data.conflict === true && stale.body.data.content.includes('改过的第一段'), stale.body)

const after = await request({ action: 'read', sessionId: 's1', root: ROOT, path: 'notes-zh.md' })
check('conflict left the file untouched', after.body.data.content.includes('改过的第一段'), after.body.data?.content)

const nested = await request({
  action: 'write',
  sessionId: 's1',
  root: ROOT,
  path: 'sub/notes.md',
  content: '# notes\n\nmore\n',
  baseMtimeMs: list.body.data.files.find((f) => f.path === 'sub/notes.md').mtimeMs,
})
check('nested write succeeds', nested.body.ok === true, nested.body)

const stat = await request({ action: 'stat', sessionId: 's1', root: ROOT, path: 'sub/notes.md' })
check('stat returns a numeric mtime', stat.body.ok && typeof stat.body.data.mtimeMs === 'number', stat.body)

const statMissing = await request({ action: 'stat', sessionId: 's1', root: ROOT, path: 'ghost.md' })
check('stat of missing file reports missing', statMissing.body.ok && statMissing.body.data.missing === true, statMissing.body)

const unknown = await request({ action: 'explode', sessionId: 's1', root: ROOT })
check('unknown action refused', unknown.body.ok === false && unknown.body.code === 'unknown-action', unknown.body)

// A client-supplied root outside every known root falls back to the known root.
const foreign = await request({
  action: 'read',
  sessionId: 's1',
  root: path.dirname(ROOT),
  path: `${path.basename(ROOT)}/sub/notes.md`,
})
check('foreign root is refused, not silently swapped', foreign.body.ok === false && foreign.body.code === 'root-not-allowed', foreign.body)


// ---- reactive registration when the Web carrier mounts later ----
const { apply: applyAgain } = await import(
  new URL('../index.js', import.meta.url).pathname
)
let deferred = null
const lateRoutes = []
const lateCtx = {
  get: () => undefined,
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
  inject(deps, callback) {
    deferred = { deps, callback }
  },
}
applyAgain(lateCtx)
check(
  'route registration waits for the carrier instead of giving up',
  deferred !== null && deferred.deps.includes('webServer'),
  deferred?.deps,
)
const lateServer = {
  register(route) {
    lateRoutes.push(route)
    return () => {}
  },
}
deferred.callback({
  get: (name) => (name === 'webServer' ? lateServer : undefined),
  webServer: lateServer,
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
})
check(
  'deferred callback registers every route once the carrier appears',
  lateRoutes.length === 3 &&
    lateRoutes.every((route) => route.kind === 'prefix') &&
    lateRoutes.map((route) => route.path).join(',') ===
      '/api/dsh-cowrite,/api/dsh-cowrite/raw,/api/dsh-cowrite/upload',
  lateRoutes,
)


// ------------------------------------------------------------- image route ----
import { Writable } from 'node:stream'
import { once } from 'node:events'

function rawResponse() {
  const chunks = []
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk))
      callback()
    },
  })
  res.statusCode = 200
  res.headers = {}
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value
  }
  res.text = () => Buffer.concat(chunks).toString('utf8')
  return res
}

async function rawRequest(url, options = {}) {
  const res = rawResponse()
  const req = { method: options.method ?? 'GET', url, headers: {} }
  if (options.cookie !== null) req.headers.cookie = options.cookie ?? 'dsh-auth-probe=1'
  const done = once(res, 'finish')
  await routes['/api/dsh-cowrite/raw'].handler(req, res)
  await done
  return res
}

const image = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=pic.png`)
check('image route streams bytes with a media type', image.headers['content-type'] === 'image/png' && image.text().includes('FAKEPNG'), image.headers)
check('image route disables caching', image.headers['cache-control'] === 'no-store', image.headers)

const imageAuth = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=pic.png`, { cookie: null })
check('image route requires the browser cookie', imageAuth.statusCode === 401 && imageAuth.text().includes('unauthorized'), imageAuth.statusCode)

const imageEscape = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=../secret.png`)
check('image route refuses a path escape', imageEscape.statusCode === 400 && imageEscape.text().includes('outside-root'), imageEscape.text())

const imageType = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=notes.txt`)
check('image route refuses a non-image', imageType.statusCode === 400 && imageType.text().includes('not-an-image'), imageType.text())

const imageMissing = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=ghost.png`)
check('image route reports a missing file', imageMissing.statusCode === 404 && imageMissing.text().includes('not-found'), imageMissing.text())

const head = await rawRequest(`/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=pic.png`, { method: 'HEAD' })
check('image route answers HEAD without a body', head.statusCode === 200 && head.text() === '', head.text())

const failedLate = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failedLate.length}/${checks.length} checks passed`)
process.exit(failedLate.length === 0 ? 0 : 1)
