import fs from 'node:fs'
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test

// raw strings inside a real fence
const DOC = '```cpp\nauto s = R"(影调 "曲线")";\n```\n'
const block = T.parseBlocks(DOC).find((b) => b.type === 'code')
console.log('cpp raw:', JSON.stringify((T.codeTokens(block.value, block.lang) ?? []).filter((t) => t.kind === 'str').map((t) => t.value)))

// classDef inside a real fence
const CHART = ['```mermaid', 'graph TD', '  classDef warn fill:#f96,stroke:#333,color:#111', '  A[测光] --> B[判定]', '  class B warn', '```', ''].join('\n')
const chart = T.parseBlocks(CHART).find((b) => b.type === 'code')
const diagram = T.parseMermaid(chart.value)
console.log('classes:', JSON.stringify(diagram.classes))
const tree = T.renderMermaid(diagram)
const json = JSON.stringify(tree)
console.log('style applied:', json.includes('"background":"#f96"'), 'label colour:', json.includes('"fill":"#111"'))

// an edge that would cross a middle node now takes a lane
const cross = T.parseMermaid('graph TD\n A-->C\n B-->D\n')
console.log('crossing diagram renders edges:', (JSON.stringify(T.renderMermaid(cross)).match(/dcw-mmd-edge/g) ?? []).length)
