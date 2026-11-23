import fs from 'node:fs'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r17-probe.md'
const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
const DOC = ['# 一、选题依据', '', '## 1. 研究意义（上）', '', '见 [研究意义](#1-研究意义上) 与 [不存在](#nope)。', ''].join('\n')
const w = await post({ action: 'write', path: NAME, content: DOC, baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const r = await post({ action: 'read', path: NAME })
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const blocks = T.parseBlocks(r.data.content)
const anchors = T.headingAnchors(blocks)
console.log('anchors:', [...anchors.keys()].join(' | '))
let jumped = null
const tree = T.renderBlocks(blocks, { headings: blocks.filter((b) => b.type === 'heading'), anchors, onAnchor: (f) => { jumped = f } })
const links = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (n.type === 'a') links.push(n)
  n.children.forEach(walk)
}
walk(tree)
console.log('links:', links.map((a) => `${a.props.href}->${a.props.target ?? 'internal'}`).join(' '))
links[0].props.onClick({ preventDefault() {} })
console.log('internal jump target offset:', jumped, 'matches heading:', jumped === anchors.get('1-研究意义上'))
console.log('selection count of 研究意义:', T.countFor('words', '研究意义'))
fs.rmSync(`${ROOT}/${NAME}`)
console.log('probe removed')
