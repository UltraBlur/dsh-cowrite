import fs from 'node:fs'
const BASE = process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r18-probe.md'
const post = async (payload) => {
  const res = await fetch(`${BASE}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = '| 阶段 | 工作 |\n| --- | --- |\n| 标定 | 采集 |\n'
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const blocks = T.parseBlocks(r.data.content)
const table = blocks.find((b) => b.type === 'table')
const raw = r.data.content.slice(table.from, table.to).replace(/\n$/, '')
console.log('table:'); console.log(raw)
const caret = raw.indexOf('采集')
for (const op of ['row-before', 'row-after', 'col-before', 'col-after']) {
  const out = T.tableOperation(raw, caret, op)
  console.log(`\n[${op}]`); console.log(out.value)
}
fs.rmSync(`${ROOT}/${NAME}`)
console.log('\nprobe removed')
