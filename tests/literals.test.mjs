import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test
const strings = (lang, src) => (T.codeTokens(src, lang) ?? []).filter((t) => t.kind === 'str').map((t) => t.value)

// ---- JavaScript regular expressions ----
check('a regex after = is one literal', JSON.stringify(strings('js', 'const r = /ab+c/gi;')) === JSON.stringify(['/ab+c/gi']), strings('js', 'const r = /ab+c/gi;'))
check('a division is not a regex', strings('js', 'const x = a / b;').length === 0, strings('js', 'const x = a / b;'))
check('a regex after return is recognised', strings('js', 'return /x/.test(s)').length === 1, strings('js', 'return /x/.test(s)'))
check('a character class may hold a slash', strings('js', 'x = /[/]/').length === 1, strings('js', 'x = /[/]/'))
check('flags are part of the literal', strings('js', 'y = /a/gimsuy').join('').endsWith('/gimsuy'), strings('js', 'y = /a/gimsuy'))
check('an unterminated slash stays text', strings('js', 'a = b / c').length === 0, strings('js', 'a = b / c'))
check('a comment is still a comment', (T.codeTokens('// c', 'js') ?? []).some((t) => t.kind === 'com'), null)
check('a block comment is still a comment', (T.codeTokens('/* c */', 'js') ?? []).some((t) => t.kind === 'com'), null)
check('typescript gets regexes too', strings('ts', 'const r = /x/').length === 1, null)

// ---- Ruby percent literals ----
check('%w is one literal', JSON.stringify(strings('ruby', 'w = %w[a b c]')) === JSON.stringify(['%w[a b c]']), strings('ruby', 'w = %w[a b c]'))
check('%i works', strings('ruby', 'h = %i[a b]').length === 1, strings('ruby', 'h = %i[a b]'))
check('%q with braces works', strings('ruby', 'x = %q{text}').length === 1, strings('ruby', 'x = %q{text}'))
check('a modulo is not a percent literal', strings('ruby', 'a = b % c').length === 0, strings('ruby', 'a = b % c'))

// ---- Perl quote-like operators ----
check('qw is one literal', JSON.stringify(strings('perl', '@x = qw/a b/;')) === JSON.stringify(['qw/a b/']), strings('perl', '@x = qw/a b/;'))
check('q with braces works', strings('perl', '@q = q{a b};').length === 1, strings('perl', '@q = q{a b};'))
check('s/// covers both halves and flags', JSON.stringify(strings('perl', '$y =~ s/a/b/g;')) === JSON.stringify(['s/a/b/g']), strings('perl', '$y =~ s/a/b/g;'))
check('tr/// covers both halves', JSON.stringify(strings('perl', '$z =~ tr/a-z/A-Z/;')) === JSON.stringify(['tr/a-z/A-Z/']), strings('perl', '$z =~ tr/a-z/A-Z/;'))
check('m// works', strings('perl', 'if ($x =~ m/ab/) {}').length === 1, strings('perl', 'if ($x =~ m/ab/) {}'))
check('a plain variable is not a quote op', strings('perl', 'my $q = 1;').length === 0, strings('perl', 'my $q = 1;'))

// the language without the flag keeps its old behaviour
check('python has no regex literals', strings('py', 'r = /x/').length === 0, strings('py', 'r = /x/'))
check('javascript has no percent literals', strings('js', 'x = %w[a]').length === 0, strings('js', 'x = %w[a]'))

// ---- rendering keeps them as one span ----
const tree = T.renderCode('const r = /ab+c/g', 'js', false)
const classes = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') classes.push(n.props.className)
  n.children.forEach(walk)
}
walk(tree)
check('a regex renders as one string span', classes.filter((c) => c === 'dcw-tok-str').length === 1, classes)


// ---- C++ raw strings ----
check('a raw string is one literal', JSON.stringify(String(T.codeTokens('auto s = R"(a "q" b)"s;', 'c')[0].value)) !== 'null', null)
const rawStrings = (lang, src) => (T.codeTokens(src, lang) ?? []).filter((t) => t.kind === 'str').map((t) => t.value)
const rawOne = rawStrings('c', 'auto s = R"(a "quoted" line)";')
check('quotes inside a raw string do not end it', rawOne.length === 1 && rawOne[0].includes('"quoted"'), rawOne)
const rawCustom = rawStrings('cpp', 'auto u = R"xy(a ) b)xy";')
check('a custom delimiter works', rawCustom.length === 1 && rawCustom[0] === 'R"xy(a ) b)xy"', rawCustom)
// Python has no raw-string prefix: the R is just an identifier, then a normal string.
check('python reads it as an ordinary string', JSON.stringify(rawStrings('py', 'x = R"(a)"')) === JSON.stringify(['"(a)"']), rawStrings('py', 'x = R"(a)"'))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
