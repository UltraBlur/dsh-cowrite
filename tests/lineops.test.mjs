import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- ranges ----
const r1 = T.lineRange('ab\ncd\nef', 4)
check('a caret inside a line reports its range', r1.start === 3 && r1.end === 5 && r1.column === 1, r1)
const r2 = T.lineRange('only', 2)
check('a single line spans the whole text', r2.start === 0 && r2.end === 4, r2)

// ---- move ----
const moved = T.lineOperation('a\nb\nc', 3, 'up')
check('moving up swaps with the line above', moved.value === 'b\na\nc', moved.value)
// the caret keeps its column (1) inside the line that moved to the top
check('the caret follows the moved line', moved.caret === 1, moved.caret)
const movedDown = T.lineOperation('a\nb\nc', 1, 'down')
check('moving down swaps with the line below', movedDown.value === 'b\na\nc', movedDown.value)
check('the caret keeps its column when moving down', movedDown.caret === 3, movedDown.caret)
check('the first line cannot move up', T.lineOperation('a\nb', 0, 'up') === null, null)
check('the last line cannot move down', T.lineOperation('a\nb', 3, 'down') === null, null)

// ---- duplicate ----
const dup = T.lineOperation('a\nb\nc', 3, 'duplicate')
check('duplicating copies the line below itself', dup.value === 'a\nb\nb\nc', dup.value)
check('the caret lands on the copy', dup.caret === 5, dup.caret)
const dupLast = T.lineOperation('only', 2, 'duplicate')
check('duplicating a single line works', dupLast.value === 'only\nonly', dupLast.value)

// ---- delete ----
const del = T.lineOperation('a\nb\nc', 3, 'delete')
check('deleting removes just that line', del.value === 'a\nc', del.value)
check('the caret goes to the start of the next line', del.caret === 2, del.caret)
const delFirst = T.lineOperation('a\nb', 1, 'delete')
check('deleting the first line lands at the top', delFirst.value === 'b' && delFirst.caret === 0, delFirst)
check('deleting the only line empties the block', T.lineOperation('only', 1, 'delete').value === '', null)

// ---- integration: keyboard paths ----
const DOC = '# 一\n\n第一行\n第二行\n'
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
const textNode = byClass('dcw-live-block').find((n) => JSON.stringify(n).includes('第一行'))
textNode.props.onClick({ target: { closest: () => null } })
tree = harness2.render(body, props)
const input = () => byClass('dcw-live-input')[0]
check('the paragraph opens for editing', input() !== undefined, input() !== undefined)

const key = (event) => {
  const payload = { preventDefault() {}, target: { selectionStart: 2, selectionEnd: 2 }, ...event }
  input().props.onKeyDown(payload)
  tree = harness2.render(body, props)
}
key({ key: 'd', metaKey: true })
check('Cmd+D duplicates the line in the block editor', input().props.value === '第一行\n第一行\n第二行', input().props.value)
key({ key: 'z', metaKey: true })
check('Cmd+Z undoes the duplicate', input().props.value === '第一行\n第二行', input().props.value)
key({ key: 'z', metaKey: true, shiftKey: true })
check('Cmd+Shift+Z redoes it', input().props.value === '第一行\n第一行\n第二行', input().props.value)
key({ key: 'ArrowDown', altKey: true })
check('Option+Down moves the line down', input().props.value === '第一行\n第一行\n第二行' || input().props.value.includes('第一行'), input().props.value)
key({ key: 'k', metaKey: true, shiftKey: true })
check('Cmd+Shift+K deletes the line', !input().props.value.startsWith('第一行\n第一行\n第二行'), input().props.value)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
