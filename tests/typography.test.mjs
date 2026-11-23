import fs from 'node:fs'
import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const css = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// The style rules below are the measurements read out of Typora 1.14.10's
// style/base.css and style/themes/github.css; each assertion guards one.
const rule = (fragment) => css.includes(fragment)
check('body copy uses the 1.6 line-height', rule('.dcw-md {\n  --dcw-blur: #c8c8c8;\n  font-size: 1em; line-height: 1.6;'), null)
check('h1 uses the 2.25em step and a rule', rule('.dcw-md h1 { font-size: 2.25em; line-height: 1.2; border-bottom:'), null)
check('h2 uses the 1.75em step', rule('.dcw-md h2 { font-size: 1.75em;'), null)
check('h3 uses the 1.5em step', rule('.dcw-md h3 { font-size: 1.5em; line-height: 1.43; }'), null)
check('h4 uses the 1.25em step', rule('.dcw-md h4 { font-size: 1.25em; }'), null)
check('h6 shares body size and goes secondary', rule('.dcw-md h6 { font-size: 1em; color: var(--dsw-alias-label-secondary); }'), null)
check('blocks take 0.8em top and bottom', rule('.dcw-md .dcw-md-mathblock { margin: 0.8em 0; }'), null)
check('headings take a full 1rem margin', rule('  margin: 1rem 0; font-weight: bold; line-height: 1.4;'), null)
check('quotes use a 4px bar and 15px padding', rule('border-left: 4px solid var(--dsw-alias-border-l2); padding: 0 15px;'), null)
check('cells use 6px 13px padding and 32px minimum', rule('border: 1px solid var(--dsw-alias-border-l2); padding: 6px 13px;'), rule('min-width: 32px;'))
check('the header row drops its bottom border', rule('.dcw-md th { font-weight: bold; border-bottom: 0;'), null)
check('zebra striping is present', rule('.dcw-md tr:nth-child(2n) {'), null)
check('inline code keeps the hairline border', rule('padding: 2px 4px 0; border-radius: 3px;\n  border: 1px solid var(--dsw-alias-border-l1);'), null)
check('code block body is 0.9em at 8px/6px', rule('padding: 8px 0 6px;'), null)
check('task checkboxes sit outside the text flow', rule('margin-left: -1.3em; margin-top: calc(0.8em - 10px);'), null)
check('task lists lose their bullets', rule('.dcw-md-list:has(> .dcw-md-li > input[type="checkbox"]) { list-style: none;'), null)
check('search hits are solid yellow on black', rule('.dcw-mark { background: #ffea00; color: #000;'), null)
check('the active hit is orange', rule('.dcw-mark-current { background: #ff8a00; }'), null)
check('outline indent is one em per level', rule('[data-level="1"] { font-weight: bold; }'), null)
check('dimmed text recolours instead of fading out', rule('.dcw-live-block[data-dim="true"] * { color: var(--dcw-blur) !important;'), null)
check('dimmed images fall to 0.3', rule('.dcw-live-block[data-dim="true"] img { opacity: 0.3; }'), null)

// ---- integration: task toggling and the typewriter toggle ----
const DOC = '- [ ] 未完成\n- [x] 已完成\n'
const storage = new Map([['dsh-cowrite:mode', 'live']])
const windowStub = { localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)) } }
const harness = createHarness()
const mod = loadPlugin(windowStub)('react')

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

const boxes = byClass(tree, 'dcw-md-li').map((li) => byClass(li, '')[0]).filter(Boolean)
const inputs = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (n.type === 'input') inputs.push(n)
  n.children.forEach(walk)
}
walk(tree)
check('both task checkboxes render', inputs.length === 2, inputs.length)
check('a checkbox reflects its state', inputs[1].props.checked === true, inputs.map((i) => i.props.checked))
check('checkboxes are interactive now', typeof inputs[0].props.onChange === 'function', typeof inputs[0].props.onChange)
inputs[0].props.onChange()
tree = harness.render(body, props)
const reWalk = []
const walk2 = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk2); return }
  if (typeof n !== 'object') return
  if (n.type === 'input') reWalk.push(n)
  n.children.forEach(walk2)
}
walk2(tree)
check('clicking an unchecked task checks it', reWalk[0].props.checked === true, reWalk.map((i) => i.props.checked))

const typeBtn = byClass(tree, 'dcw-seg').find((n) => textOf(n) === '⇕')
check('the typewriter toggle exists', typeBtn !== undefined, byClass(tree, 'dcw-seg').map(textOf))
typeBtn.props.onClick()
tree = harness.render(body, props)
check('toggling typewriter persists the choice', storage.get('dsh-cowrite:typewriter') === '1', storage.get('dsh-cowrite:typewriter'))
const onBtn = byClass(tree, 'dcw-seg').find((n) => textOf(n) === '⇕')
check('the toggle reads back as pressed', onBtn.props['data-on'] === 'true', onBtn.props['data-on'])

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
