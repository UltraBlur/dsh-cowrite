import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- marker ranges ----
const ranges = T.markerRanges(T.parseInline('a **b** c'))
check('a bold run reports its source span', ranges.length === 1 && ranges[0].from === 2 && ranges[0].to === 7, ranges)
check('the span remembers the marker width', ranges[0].weight === 2, ranges)
const nested = T.markerRanges(T.parseInline('**[x](u)**'))
check('nested markers all report spans', nested.length === 2, nested)
const plain = T.markerRanges(T.parseInline('只有文字'))
check('plain text reports nothing', plain.length === 0, plain)

// ---- snapping ----
const text = 'a **bold** c'
const bold = { from: 2, to: 8, weight: 2 }
check('a caret just after the opener snaps left', T.snapToBoundary(3, [bold]) === 2, T.snapToBoundary(3, [bold]))
check('a caret on the opener snaps left', T.snapToBoundary(2, [bold]) === 2, T.snapToBoundary(2, [bold]))
check('a caret just before the closer snaps right', T.snapToBoundary(7, [bold]) === 8, T.snapToBoundary(7, [bold]))
check('a caret inside the word stays put', T.snapToBoundary(5, [bold]) === 5, T.snapToBoundary(5, [bold]))
check('a caret outside every span is untouched', T.snapToBoundary(10, [bold]) === 10, T.snapToBoundary(10, [bold]))
// `4` sits in both the outer left zone (2..4) and the inner one (4..5);
// the tighter span decides.
const outer = { from: 2, to: 9, weight: 2 }
const inner = { from: 4, to: 6, weight: 1 }
check('the tightest span wins', T.snapToBoundary(4, [outer, inner]) === 4, T.snapToBoundary(4, [outer, inner]))

// ---- indentation ----
const indented = T.indentLine('- a\n- b', 6, false)
check('tab indents the caret line', indented.value === '- a\n  - b' && indented.caret === 8, indented)
const outdented = T.indentLine('- a\n  - b', 9, true)
check('shift-tab removes one step', outdented.value === '- a\n- b' && outdented.caret === 7, outdented)
const nothing = T.indentLine('- a', 1, true)
check('shift-tab on an unindented line does nothing', nothing === null, nothing)
const partial = T.indentLine('  x', 2, true)
check('an indent is removed from an indented line', partial.value === 'x', partial.value)

// ---- click integration: clicking a bold word's edge escapes the markers ----
const DOC = '前 **粗体** 后\n'
const storage = new Map([['dsh-cowrite:mode', 'live']])
const harness2 = createHarness()
let selection = null
const mod2 = loadPlugin({
  localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: () => {} },
  getSelection: () => selection,
})('react')
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
const input = () => byClass('dcw-live-input')[0] ?? null
const textNode = byClass('dcw-live-block').find((n) => JSON.stringify(n).includes('粗体'))

// A click on the first character of the bold word maps to raw offset 4
// (`前 **b|粗体`)，which sits inside the opener run and must snap to 2.
const holder = { getAttribute: (name) => (name === 'data-dcw-f' ? '4' : null) }
selection = { anchorNode: { nodeType: 3, parentElement: { closest: () => holder } }, anchorOffset: 0 }
textNode.props.onClick({ target: { closest: () => null } })
tree = harness2.render(body, props)
check('clicking the opener run snaps the caret outside the markers', input().props['data-dcw-caret'] === '2', input().props['data-dcw-caret'])

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
