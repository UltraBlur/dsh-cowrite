import fs from 'node:fs'
const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = { Fragment: 'F', createElement: (t, p, ...c) => ({ type: t, props: p ?? {}, children: c.flat(Infinity) }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(), useEffect() {}, useLayoutEffect() {} }
new Function('window', code)({ __ModuleLoader__: { load: (e) => { factory = e.factory } } })
const T = factory((n) => (n === 'react' ? React : null)).__test
const DOC = ['```js', 'const re = /影调+/gi; const half = a / 2;', '```', '', '```ruby', 'w = %w[影调 曲线]', '```', '', '```perl', '$s =~ s/影调/tone/g;', '```', ''].join('\n')
for (const block of T.parseBlocks(DOC).filter((b) => b.type === 'code')) {
  const tokens = T.codeTokens(block.value, block.lang) ?? []
  const strs = tokens.filter((t) => t.kind === 'str').map((t) => t.value)
  console.log(block.lang.padEnd(7), 'strings:', JSON.stringify(strs))
}
