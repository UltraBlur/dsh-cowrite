import fs from 'node:fs'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r10-probe.md'
const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = ['$$', '\\mathbb{R} \\subset \\mathbb{C}, \\quad \\boxed{\\sqrt[3]{x}}', '$$', '', '行内 $\\overbrace{a+b}^{n}$ 与 $\\stackrel{!}{=}$ 与 $\\Big($ 与 $\\textbf{粗}$。', ''].join('\n')
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const tree = T.renderBlocks(T.parseBlocks(r.data.content))
const cls = []
const txt = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n === 'string') { txt.push(n); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') cls.push(n.props.className)
  n.children.forEach(walk)
}
walk(tree)
for (const probe of ['dcw-tex-bb', 'dcw-tex-boxed', 'dcw-tex-rootindex', 'dcw-tex-overstack', 'dcw-tex-big2', 'dcw-tex-bold']) {
  console.log(probe.padEnd(20), cls.some((c) => c.includes(probe)))
}
console.log('double-struck R present:', txt.join('').includes(String.fromCodePoint(0x211d)))
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
