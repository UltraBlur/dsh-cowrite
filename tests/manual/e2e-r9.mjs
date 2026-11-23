import fs from 'node:fs'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r9-probe.md'
const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = ['```python', 'cdef int x = None  # note', '```', '', '```verilog', 'always @(posedge clk) begin end', '```', '', '```tcl', 'foreach x {a b} { puts $x }', '```', ''].join('\n')
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const blocks = T.parseBlocks(r.data.content)
for (const block of blocks.filter((b) => b.type === 'code')) {
  const tokens = T.codeTokens(block.value, block.lang) ?? []
  const kw = tokens.filter((t) => t.kind === 'kw').map((t) => t.value)
  const com = tokens.filter((t) => t.kind === 'com').map((t) => t.value)
  console.log(`${block.lang.padEnd(9)} kw=[${kw.join(',')}] com=[${com.join(',')}]`)
}
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
