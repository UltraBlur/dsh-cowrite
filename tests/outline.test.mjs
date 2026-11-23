import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const DOC = '# 一\n\n## 一甲\n\n### 一甲一\n\n## 一乙\n\n正文\n'
const storage = new Map([['dsh-cowrite:mode', 'preview']])
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) } })('react')

let body = null
const ctx = {
  locale: { bind: () => (key) => key, register: () => () => {} },
  slots: { inject: (n, cb) => { cb(); return () => {} }, register: (o, c) => { body = c; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  inject() {},
}
mod.apply(ctx)
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/ws', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    if (p.action === 'write') return { path: 'd.md', size: DOC.length, mtimeMs: 2 }
    return {}
  },
}
const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const props = {
  t, api,
  useSessions: (sel) => sel({ byId: { s1: { cwd: '/ws' } } }),
  useTabInfo: () => ({ tab: { id: 't', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}
const tick = () => new Promise((r) => setTimeout(r, 0))
let tree = harness.render(body, props)
for (let i = 0; i < 14; i += 1) {
  await tick()
  if (!harness.scheduled) { if (i > 3) break; continue }
  tree = harness.render(body, props)
}
tree = harness.render(body, props)

const seg = (text) => byClass(tree, 'dcw-seg').find((n) => textOf(n) === text)

// ---- first-line indent toggle ----
const doc = () => byClass(tree, 'dcw-doc')[0]
check('indent is off by default', doc().props['data-indent'] === 'false', doc().props['data-indent'])
const indentBtn = seg('¶')
check('the indent toggle exists', indentBtn !== undefined, byClass(tree, 'dcw-seg').map(textOf))
indentBtn.props.onClick()
tree = harness.render(body, props)
check('indent turns on for the document', doc().props['data-indent'] === 'true', doc().props['data-indent'])
check('the choice is stored', storage.get('dsh-cowrite:indent') === '1', storage.get('dsh-cowrite:indent'))
seg('¶').props.onClick()
tree = harness.render(body, props)
check('indent toggles back off', doc().props['data-indent'] === 'false', doc().props['data-indent'])

// ---- outline tree ----
seg('▤').props.onClick()
tree = harness.render(body, props)
const items = () => byClass(tree, 'dcw-outline-item')
check('the outline nests child headings', items().map(textOf).join('|') === '一|一甲|一甲一|一乙', items().map(textOf))
check('children live inside a children container', byClass(tree, 'dcw-outline-children').length === 2, byClass(tree, 'dcw-outline-children').length)
const expanders = byClass(tree, 'dcw-outline-expander').filter((n) => n.type === 'button')
check('only rows with children carry an expander', expanders.length === 2, expanders.length)
check('branches start open', expanders.every((n) => n.props['data-open'] === 'true'), expanders.map((n) => n.props['data-open']))

// collapse the top branch: its two descendants disappear
expanders[0].props.onClick()
tree = harness.render(body, props)
check('collapsing a branch hides its descendants', items().map(textOf).join('|') === '一', items().map(textOf))
const closed = byClass(tree, 'dcw-outline-expander').filter((n) => n.type === 'button' && n.props['data-open'] === 'false')
check('the collapsed expander reads as closed', closed.length === 1, closed.length)
byClass(tree, 'dcw-outline-expander').filter((n) => n.type === 'button')[0].props.onClick()
tree = harness.render(body, props)
check('re-opening restores the descendants', items().map(textOf).join('|') === '一|一甲|一甲一|一乙', items().map(textOf))

// leaf rows keep an inert spacer instead of a button
const spacers = byClass(tree, 'dcw-outline-expander').filter((n) => n.type === 'span')
check('leaf rows get a bare spacer', spacers.length === 2, spacers.length)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
