import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

const kws = (lang) => {
  const grammar = T.codeGrammar(lang)
  return new Set(String(grammar?.keywords ?? '').split(/\s+/).filter(Boolean))
}
const has = (lang, word) => kws(lang).has(word)
const count = (lang) => kws(lang).size

// Tables that came out of the mode bundle.
check('python keeps cdef/cimport from its mode', has('py', 'cdef') || has('py', 'cimport'), [...kws('py')].slice(0, 8))
check('shell picks up its builtins', has('sh', 'cd') && has('sh', 'chmod'), [...kws('sh')].slice(0, 8))
check('sql keeps its clause words', has('sql', 'select') || has('sql', 'SELECT'), [...kws('sql')].slice(0, 8))
check('verilog exists as its own language', count('verilog') > 8, count('verilog'))
check('vhdl exists as its own language', count('vhdl') > 8, count('vhdl'))
check('tcl exists as its own language', count('tcl') > 8, count('tcl'))
check('clojure has core forms', has('clojure', 'defn') || has('clojure', 'fn'), count('clojure'))
check('perl keeps its declarators', has('perl', 'my') && has('perl', 'sub'), [...kws('perl')].slice(0, 8))
check('cobol is covered', count('cobol') > 50, count('cobol'))
check('nginx directives are covered', count('nginx') > 50, count('nginx'))

// The C-like definition is shared by the languages that inherit it.
const clikeShare = ['c', 'cpp', 'java', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'dart', 'scala', 'php', 'glsl']
const base = count('c')
check('the C-like table is non-trivial', base > 30, base)
check(
  'inheriting languages carry the shared words',
  clikeShare.every((lang) => count(lang) >= base * 0.9),
  clikeShare.map((lang) => [lang, count(lang)]),
)

// Hand-written sets survive the merge.
check('javascript keeps its own keywords', has('js', 'const') && has('js', 'await'), [...kws('js')].slice(0, 6))
check('typescript adds type words', has('ts', 'interface') && has('ts', 'satisfies'), null)
check('matlab keeps end/function', has('matlab', 'function') && has('matlab', 'end'), null)
check('json stays tiny', count('json') === 3, count('json'))
check('yaml keeps yes/no', has('yaml', 'yes'), null)

// New aliases resolve onto the extracted tables.
check('perl6 maps onto perl', count('perl6') === count('perl'), [count('perl6'), count('perl')])
check('systemverilog maps onto verilog', count('systemverilog') === count('verilog'), null)
check('psql maps onto sql', count('psql') === count('sql'), null)
check('asn.1 spelling works', count('asn.1') > 20, count('asn.1'))

// Breadth: the family table still answers for names with no keyword table.
check('a family-only language still highlights', T.codeGrammar('nginx') !== null && count('nginx') > 20, count('nginx'))
check('languages without a table fall back to their family', T.codeGrammar('haskell') !== null && count('haskell') === 0, count('haskell'))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
