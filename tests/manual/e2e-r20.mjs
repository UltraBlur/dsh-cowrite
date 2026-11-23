import fs from 'node:fs'
const BASE = process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r20-probe.md'
const post = async (payload) => {
  const res = await fetch(`${BASE}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = '$$\\textcolor{#c00}{L^*} = \\color{blue} 116 f(Y) \\quad \\fcolorbox{red}{yellow}{x}$$\n'
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const tree = T.renderBlocks(T.parseBlocks(r.data.content))
const styles = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (n.props.style !== undefined) styles.push(n.props.style)
  n.children.forEach(walk)
}
walk(tree)
console.log('colours applied:', styles.filter((s) => s.color).map((s) => s.color).join(','))
console.log('backgrounds:', styles.filter((s) => s.background).map((s) => s.background).join(','))
console.log('borders:', styles.filter((s) => s.border).map((s) => s.border).join(','))
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
