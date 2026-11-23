import fs from 'node:fs'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r16-probe.md'
const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = '影调映射研究，影调曲线与影调感知。\n'
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const text = r.data.content
console.log('matches of 影调:', T.findMatches(text, '影调').length)
const all = T.replaceMatches(text, '影调', 'tone')
console.log('replace all:', JSON.stringify(all.value.trim()), 'count', all.count)
const one = T.replaceMatches(text, '影调', 'tone', 1)
console.log('replace second only:', JSON.stringify(one.value.trim()))
const link = T.insertLink(text, 0, 4)
console.log('link:', JSON.stringify(link.value.slice(0, 30)), 'url range', link.start, link.end)
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
