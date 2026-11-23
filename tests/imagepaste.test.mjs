import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- paths ----
const one = T.imagePath('', 'png', Date.UTC(2026, 10, 22, 3, 4, 5))
check('a picture lands in assets beside the document', /^assets\/image-\d{8}-\d{6}-[a-z0-9]+\.png$/.test(one), one)
const two = T.imagePath('sub', 'jpeg', Date.UTC(2026, 10, 22, 3, 4, 5))
check('a nested document gets its own assets folder', two.startsWith('sub/assets/image-'), two)
check('the extension is sanitised', T.imagePath('', 'PNG!!', 0).endsWith('.png'), T.imagePath('', 'PNG!!', 0))
check('names differ so two pastes never collide', T.imagePath('', 'png', 0) !== T.imagePath('', 'png', 0), null)

// ---- insertion ----
const inserted = T.insertImage('前文', 2, 2, 'assets/a.png')
check('an image reference is inserted at the caret', inserted.value === '前文![](assets/a.png)', inserted.value)
check('the caret lands after the reference', inserted.caret === inserted.value.length, inserted.caret)
const replaced = T.insertImage('ab', 0, 2, 'assets/a.png')
check('a selection is replaced by the reference', replaced.value === '![](assets/a.png)', replaced.value)

// ---- integration: a paste reaches the upload route and the buffer ----
const DOC = '正文\n'
const storage = new Map([['dsh-cowrite:mode', 'source']])
const harness2 = createHarness()
const mod2 = loadPlugin({ localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: () => {} } })('react')
let body = null
const ctx = {
  locale: { bind: () => (k) => k, register: () => () => {} },
  slots: { inject: (n, cb) => { cb(); return () => {} }, register: (o, c) => { body = c; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  inject() {},
}
mod2.apply(ctx)
const uploads = []
let written = null
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: written ?? DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    if (p.action === 'write') { written = p.content; return { path: 'd.md', size: p.content.length, mtimeMs: 2 } }
    return {}
  },
  async upload(payload) {
    uploads.push(payload)
    return { path: payload.path, size: 3, mtimeMs: 1, type: 'image/png' }
  },
}
const t = (k, vars) => (vars === undefined ? k : `${k}${JSON.stringify(vars)}`)
const props = {
  t, api,
  useSessions: (sel) => sel({ byId: { s1: { cwd: '/w' } } }),
  useTabInfo: () => ({ tab: { id: 't', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}
const tick = () => new Promise((r) => setTimeout(r, 0))
let tree = harness2.render(body, props)
for (let i = 0; i < 14; i += 1) {
  await tick()
  if (!harness2.scheduled) { if (i > 3) break; continue }
  tree = harness2.render(body, props)
}
tree = harness2.render(body, props)
const collect = (n, out = []) => {
  if (n === null || n === undefined) return out
  if (Array.isArray(n)) { for (const c of n) collect(c, out); return out }
  if (typeof n !== 'object') return out
  out.push(n)
  for (const c of n.children) collect(c, out)
  return out
}
const byClass = (name) => collect(tree).filter((n) => typeof n.props.className === 'string' && n.props.className.split(' ').includes(name))
const editor = byClass('dcw-editor')[0]
check('the source editor is present', editor !== undefined, null)

// a fake clipboard image
const bytes = new Uint8Array([137, 80, 78, 71])
const file = { type: 'image/png', arrayBuffer: async () => bytes.buffer, name: 'shot.png' }
let prevented = false
const consumed = editor.props.onPaste({
  preventDefault: () => { prevented = true },
  clipboardData: { files: [file] },
  target: { value: DOC, selectionStart: 2, selectionEnd: 2 },
})
await new Promise((r) => setTimeout(r, 30))
tree = harness2.render(body, props)
check('the paste is consumed', prevented === true, prevented)
check('the bytes go to the upload route', uploads.length === 1 && uploads[0].data === 'iVBORw==', uploads)
check('the upload path is an assets image', /^assets\/image-\d{8}-\d{6}-[a-z0-9]+\.png$/.test(uploads[0].path), uploads[0].path)
const after = byClass('dcw-editor')[0]
check('a reference is spliced into the buffer', after.props.value.includes('![](assets/image-'), after.props.value)
await new Promise((r) => setTimeout(r, 900))
check('the change is saved', (written ?? '').includes('![](assets/image-'), (written ?? '').trim())

// a plain text paste is left alone
prevented = false
const notConsumed = editor.props.onPaste({
  preventDefault: () => { prevented = true },
  clipboardData: { files: [] },
  target: { value: DOC, selectionStart: 2, selectionEnd: 2 },
})
check('a text paste is not intercepted', prevented === false, notConsumed)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
