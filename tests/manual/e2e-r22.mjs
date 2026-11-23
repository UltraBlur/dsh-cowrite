import fs from 'node:fs'
const BASE = process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r22-probe.md'
const post = async (payload) => {
  const res = await fetch(`${BASE}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const { htmlToMarkdown } = T
const sample = '<meta charset="utf-8"><h2>1. 研究意义</h2><p>移动显示的<b>亮度分布</b>影响<em>影调感知</em>，见 <a href="https://x.org">文献</a>。</p><ul><li>环境场</li><li>焦点场<ul><li>面积比</li></ul></li></ul>'
const markdown = htmlToMarkdown(sample)
console.log(markdown)
console.log('--- 回读校验 ---')
const blocks = T.parseBlocks(markdown)
console.log('blocks:', blocks.filter((b) => b.type !== 'blank').map((b) => b.type).join(','))
const w = await post({ action: 'write', path: NAME, content: markdown, baseMtimeMs: 0 })
console.log('written ok:', w.ok)
const r = await post({ action: 'read', path: NAME })
console.log('round-trips identical:', r.data.content === markdown || r.data.content === markdown + '\n')
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
