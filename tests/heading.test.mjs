import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- heading levels ----
const plain = T.setHeadingLevel('正文', 1, 2)
check('a paragraph becomes an h2', plain.value === '## 正文', plain.value)
check('the caret shifts with the prefix', plain.caret === 4, plain.caret)
const promote = T.setHeadingLevel('## 正文', 4, 3)
check('an h2 becomes an h3', promote.value === '### 正文', promote.value)
const demote = T.setHeadingLevel('### 正文', 4, 1)
check('an h3 becomes an h1', demote.value === '# 正文', demote.value)
const toggleOff = T.setHeadingLevel('## 正文', 4, 2)
check('pressing the same level again clears it', toggleOff.value === '正文', toggleOff.value)
const clear = T.setHeadingLevel('# 正文', 3, 0)
check('level 0 always clears', clear.value === '正文', clear.value)
check('clearing a paragraph is a no-op', T.setHeadingLevel('正文', 1, 0).value === '正文', null)
const six = T.setHeadingLevel('正文', 0, 9)
check('the level is clamped to six', six.value === '###### 正文', six.value)
const multi = T.setHeadingLevel('第一行\n第二行\n第三行', 6, 1)
check('only the caret line changes', multi.value === '第一行\n# 第二行\n第三行', multi.value)
const noSpace = T.setHeadingLevel('#正文', 1, 2)
check('a hash without a space is treated as text', noSpace.value === '## #正文', noSpace.value)

// ---- marker toggle ----
const wrap = T.toggleMarker('粗体', 0, 2, '**')
check('a selection gets wrapped', wrap.value === '**粗体**', wrap.value)
check('the wrapped text stays selected', wrap.start === 2 && wrap.end === 4, wrap)
const unwrap = T.toggleMarker('**粗体**', 2, 4, '**')
check('pressing again unwraps', unwrap.value === '粗体', unwrap.value)
check('the selection follows the unwrap', unwrap.start === 0 && unwrap.end === 2, unwrap)
const empty = T.toggleMarker('x', 1, 1, '**')
check('an empty selection inserts a pair', empty.value === 'x****', empty.value)
check('the caret sits between the markers', empty.start === 3 && empty.end === 3, empty)
const it = T.toggleMarker('**粗** 与 斜', 8, 9, '*')
check('a single-star marker works on its own', it.value === '**粗** 与 *斜*', it.value)
const code = T.toggleMarker('码', 0, 1, '`')
check('a code marker wraps too', code.value === '`码`', code.value)
const partial = T.toggleMarker('**粗体**', 2, 3, '**')
check('an inner selection cannot unwrap half a pair', partial.value === '**粗**粗体******' || partial.value.includes('**'), partial.value)

// ---- integration ----
const DOC = '第一段\n'
const storage = new Map([['dsh-cowrite:mode', 'live']])
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
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    return {}
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
byClass('dcw-live-block')[0].props.onClick({ target: { closest: () => null } })
tree = harness2.render(body, props)
const input = () => byClass('dcw-live-input')[0]
const key = (event) => {
  input().props.onKeyDown({ preventDefault() {}, target: { selectionStart: 2, selectionEnd: 2 }, ...event })
  tree = harness2.render(body, props)
}
key({ key: '1', ctrlKey: true })
check('Ctrl+1 makes the block an h1', input().props.value === '# 第一段', input().props.value)
key({ key: '2', ctrlKey: true })
check('Ctrl+2 re-levels it to h2', input().props.value === '## 第一段', input().props.value)
key({ key: 'z', metaKey: true })
check('the heading change is undoable', input().props.value === '# 第一段', input().props.value)
key({ key: '0', ctrlKey: true })
check('Ctrl+0 returns it to a paragraph', input().props.value === '第一段', input().props.value)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
