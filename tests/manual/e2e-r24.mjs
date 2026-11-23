import fs from 'node:fs'
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const DOC = ['```mermaid', 'graph TD', '  subgraph 采集[环境采集]', '    A[测光] --> B[前摄]', '  end', '  subgraph 处理[影调处理]', '    C[候选曲线]', '  end', '  B --> C', '```', ''].join('\n')
const block = T.parseBlocks(DOC).find((b) => b.type === 'code')
const diagram = T.parseMermaid(block.value)
console.log('groups:', diagram.groups.map((g) => `${g.id}=${g.label}`).join(', '))
console.log('membership:', diagram.nodes.map((n) => `${n.id}:${n.group ?? '-'}`).join(' '))
const tree = T.renderMermaid(diagram)
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
console.log('cluster boxes:', cls.filter((c) => c === 'dcw-mmd-cluster').length)
console.log('labels drawn:', txt.filter((x) => String(x).includes('采集') || String(x).includes('处理')).join(' / '))
