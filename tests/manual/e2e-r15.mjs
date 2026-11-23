import fs from 'node:fs'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r15-probe.md'
const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = '研究意义\n\n这是 **重点** 段落\n'
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const blocks = T.parseBlocks(r.data.content)
const headingBlock = blocks.find((b) => b.type === 'paragraph')
const headingText = r.data.content.slice(headingBlock.from, headingBlock.to).replace(/\n$/, '')
console.log('paragraph:', JSON.stringify(headingText))
console.log('to h2:', JSON.stringify(T.setHeadingLevel(headingText, 2, 2).value))
console.log('h2 again clears:', JSON.stringify(T.setHeadingLevel(T.setHeadingLevel(headingText, 2, 2).value, 4, 2).value))
// the bold run lives in the other paragraph
const boldBlock = blocks.find((b) => b.type === 'paragraph' && r.data.content.slice(b.from, b.to).includes('**'))
const boldText = r.data.content.slice(boldBlock.from, boldBlock.to).replace(/\n$/, '')
const start = boldText.indexOf('**') + 2
const end = boldText.lastIndexOf('**')
console.log('bold paragraph:', JSON.stringify(boldText))
console.log('unwrap bold:', JSON.stringify(T.toggleMarker(boldText, start, end, '**').value))
console.log('wrap again:', JSON.stringify(T.toggleMarker(T.toggleMarker(boldText, start, end, '**').value, start - 2, end - 2, '**').value))
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
