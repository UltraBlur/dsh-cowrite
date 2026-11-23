import fs from 'node:fs'
const BASE = process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r26-probe.md'
const post = async (payload) => {
  const res = await fetch(`${BASE}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = ['影调感知受亮度影响[^1]。', '', '$$', '\\ce{2H2 + O2 -> 2H2O} \\quad \\ce{SO4^2-}', '$$', '', '[^1]: 见第 2 章。', ''].join('\n')
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const blocks = T.parseBlocks(r.data.content)
let flashed = null
const tree = T.renderBlocks(blocks, { footnoteState: { seen: new Map(), order: [] }, flashAnchor: (id) => { flashed = id } })
const subs = []
const sups = []
const arrows = []
const backs = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (n.type === 'sub') subs.push(n.children.join(''))
  if (n.type === 'sup') sups.push(n.children.join(''))
  if (typeof n.props.className === 'string' && n.props.className.includes('dcw-md-fn-back')) backs.push(n)
  for (const c of n.children) {
    if (typeof c === 'string' && ['→', '⇌', '·'].includes(c)) arrows.push(c)
    walk(c)
  }
}
walk(tree)
console.log('subscripts:', JSON.stringify(subs), 'superscripts:', JSON.stringify(sups))
console.log('arrow glyphs:', JSON.stringify(arrows))
console.log('back-links:', backs.length, 'clickable:', typeof backs[0]?.props?.onClick)
backs[0]?.props?.onClick({ preventDefault() {} })
console.log('flash id:', flashed)
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
