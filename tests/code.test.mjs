import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

const CODE_FAMILY_SHAPES = {
  hash: { line: '#', quotes: ['"', "'"] },
  dash: { line: '--', block: ['--[[', ']]'], quotes: ['"', "'"] },
  css: { block: ['/*', '*/'], quotes: ['"', "'"] },
  markup: { block: ['<!--', '-->'], quotes: ['"', "'"] },
  semi: { line: ';', quotes: ['"'] },
}
const kinds = (tokens) => tokens.map((t) => t.kind)
const texts = (tokens) => tokens.map((t) => t.value)

// ---- language resolution ----
check('a known language resolves', T.codeGrammar('py') !== null, T.codeGrammar('py'))
const sig = (lang) => JSON.stringify(T.codeGrammar(lang))
check('an alias resolves to its base grammar', sig('python') === sig('py'), sig('python'))
check('case and padding do not matter', T.codeGrammar('  PYTHON ') !== null, T.codeGrammar('  PYTHON '))
check('c++ shares the C grammar', sig('c++') === sig('c'), sig('c++'))
check('an unknown language has no grammar', T.codeGrammar('brainfuck') === null, T.codeGrammar('brainfuck'))
check('plain text has no grammar', T.codeGrammar('text') === null, null)
check('an empty language has no grammar', T.codeGrammar('') === null, null)

// ---- tokenising ----
const js = T.codeTokens('const a = "hi" // note', 'js')
check('keywords are tagged', kinds(js).includes('kw') && texts(js).includes('const'), kinds(js))
check('strings are tagged whole', js.some((t) => t.kind === 'str' && t.value === '"hi"'), js)
check('line comments run to the end of the line', js.some((t) => t.kind === 'com' && t.value === '// note'), js)
check('identifiers stay plain text', js.some((t) => t.kind === 'text' && t.value.includes('a')), js)

const py = T.codeTokens('# 注释\nx = 1', 'py')
check('python uses hash comments', py.some((t) => t.kind === 'com' && t.value === '# 注释'), py)
const block = T.codeTokens('/* a\nb */ c', 'c')
check('block comments span lines', block.some((t) => t.kind === 'com' && t.value.includes('b')), block)
check('numbers are tagged', T.codeTokens('n = 42.5', 'js').some((t) => t.kind === 'num' && t.value === '42.5'), T.codeTokens('n = 42.5', 'js'))
check('escaped quotes do not end a string', (() => {
  const out = T.codeTokens('s = "a\\"b"', 'js')
  return out.some((t) => t.kind === 'str' && t.value.endsWith('b"'))
})(), T.codeTokens('s = "a\\"b"', 'js'))
check('an unknown language yields no tokens', T.codeTokens('x', 'brainfuck') === null, null)

// ---- rendering ----
const noNums = T.renderCode('const a = 1', 'js', false)
const spans = noNums.filter((n) => n !== null && typeof n === 'object')
const classes = spans.map((n) => n.props.className)
check('rendering tags keywords with a colour class', classes.some((c) => c === 'dcw-tok-kw'), classes)
const plain = T.renderCode('const a = 1', 'brainfuck', false)
check('unknown languages render as one plain string', plain.length === 1 && plain[0] === 'const a = 1', plain)

const numbered = T.renderCode('a\nb\nc', 'js', true)
check('line numbering splits the lines', numbered.length === 3, numbered.length)
check('every numbered line carries the counter class', numbered.every((n) => n.props.className === 'dcw-md-line'), numbered.map((n) => n.props.className))
check('only real line breaks are kept', numbered[0].children.includes('\n') && !numbered[2].children.includes('\n'), null)

// ---- fences ----
const mathFence = T.parseBlocks('```math\nL^* = Y\n```\n')
const mathTree = T.renderBlocks(mathFence)
const mathClasses = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') mathClasses.push(n.props.className)
  n.children.forEach(walk)
}
walk(mathTree)
check('a ```math fence renders as display math', mathClasses.some((c) => c.includes('dcw-md-mathblock')), mathClasses)
check('a ```math fence is not a code block', !mathClasses.some((c) => c.includes('dcw-md-codeblock')), mathClasses)

const codeTree = T.renderBlocks(T.parseBlocks('```js\nx\n```\n'))
const codeClasses = []
const walk2 = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk2); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') codeClasses.push(n.props.className)
  n.children.forEach(walk2)
}
walk2(codeTree)
check('a code fence keeps its language attribute', codeClasses.some((c) => c.includes('dcw-md-codeblock')), codeClasses)

// ---- image resolution rules ----
const imgs = { root: '/w', dir: 'sub' }
const url = mod.__test ? null : null
const imagesSrc = (src) => {
  // reuse the module surface through a rendered image node
  const nodes = T.parseInline(`![x](${src})`)
  const children = T.renderInline(nodes, 'k', false, null, imgs)
  const find = (n) => {
    if (n === null || n === undefined) return null
    if (Array.isArray(n)) { for (const c of n) { const r = find(c); if (r) return r } return null }
    if (typeof n !== 'object') return null
    if (n.type === 'img') return n.props.src
    for (const c of n.children) { const r = find(c); if (r) return r }
    return null
  }
  return find(children)
}
check('relative image paths join the document folder', imagesSrc('pic.png').includes('path=sub%2Fpic.png'), imagesSrc('pic.png'))
check('a fragment stays a fragment', imagesSrc('pic.png#frag').endsWith('#frag'), imagesSrc('pic.png#frag'))
check('backslashes become separators', imagesSrc('deep\\pic.png').includes('path=sub%2Fdeep%2Fpic.png'), imagesSrc('deep\\pic.png'))
check('http images pass through', imagesSrc('https://a/b.png') === 'https://a/b.png', imagesSrc('https://a/b.png'))
check('protocol-relative images get a scheme', imagesSrc('//a/b.png') === 'http://a/b.png', imagesSrc('//a/b.png'))
check('data images pass through', imagesSrc('data:image/png;base64,AA') === 'data:image/png;base64,AA', imagesSrc('data:image/png;base64,AA'))
check('a file URL inside the root becomes a workspace path', imagesSrc('file:///w/sub/pic.png').includes('path=sub%2Fpic.png'), imagesSrc('file:///w/sub/pic.png'))
check('a file URL outside the root is left alone', imagesSrc('file:///etc/pic.png').startsWith('file:'), imagesSrc('file:///etc/pic.png'))


// ---- language switching through the panel ----
const storage2 = new Map([['dsh-cowrite:mode', 'preview']])
const harness2 = createHarness()
const DOC2 = '```js\nconst a = 1\n```\n'
const mod2 = loadPlugin({ localStorage: { getItem: (k) => storage2.get(k) ?? null, setItem: () => {} } })('react')
let body2 = null
const ctx2 = {
  locale: { bind: () => (k) => k, register: () => () => {} },
  slots: { inject: (n, cb) => { cb(); return () => {} }, register: (o, c) => { body2 = c; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  inject() {},
}
mod2.apply(ctx2)
let written = null
const api2 = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC2.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: written ?? DOC2, size: DOC2.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC2.length, mtimeMs: 1 }
    if (p.action === 'write') { written = p.content; return { path: 'd.md', size: p.content.length, mtimeMs: 2 } }
    return {}
  },
}
const t2 = (k, vars) => (vars === undefined ? k : `${k}${JSON.stringify(vars)}`)
const props2 = {
  t: t2, api: api2,
  useSessions: (sel) => sel({ byId: { s1: { cwd: '/w' } } }),
  useTabInfo: () => ({ tab: { id: 't', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}
const tick2 = () => new Promise((r) => setTimeout(r, 0))
let tree2 = harness2.render(body2, props2)
for (let i = 0; i < 14; i += 1) {
  await tick2()
  if (!harness2.scheduled) { if (i > 3) break; continue }
  tree2 = harness2.render(body2, props2)
}
tree2 = harness2.render(body2, props2)

const collect2 = (n, out = []) => {
  if (n === null || n === undefined) return out
  if (Array.isArray(n)) { for (const c of n) collect2(c, out); return out }
  if (typeof n !== 'object') return out
  out.push(n)
  for (const c of n.children) collect2(c, out)
  return out
}
const byCls = (name) => collect2(tree2).filter((n) => typeof n.props.className === 'string' && n.props.className.split(' ').includes(name))
const langBtn = byCls('dcw-md-langbtn')[0]
check('the language label is a button', langBtn !== undefined && langBtn.type === 'button', langBtn && langBtn.type)
langBtn.props.onClick()
tree2 = harness2.render(body2, props2)
const langInput = byCls('dcw-md-langinput')[0]
check('clicking it opens an input with the current language', langInput !== undefined && langInput.props.defaultValue === 'js', langInput && langInput.props.defaultValue)
langInput.props.onKeyDown({ key: 'Enter', preventDefault() {}, target: { value: 'python' } })
tree2 = harness2.render(body2, props2)
const langAfter = byCls('dcw-md-langbtn')[0]
check('committing rewrites the info string', langAfter !== undefined && langAfter.children.includes('python'), langAfter && langAfter.children)
await new Promise((r) => setTimeout(r, 900))
check('the change is saved', (written ?? '').includes('```python'), (written ?? '').split('\n')[0])


// breadth: names taken straight from the shipped mode table
for (const [lang, family] of [['ruby', 'hash'], ['haskell', 'dash'], ['lua', 'dash'], ['scss', 'css'], ['svelte', 'markup'], ['clojure', 'semi'], ['julia', 'hash'], ['vhdl', 'dash'], ['toml', 'hash'], ['handlebars', 'markup']]) {
  const grammar = T.codeGrammar(lang)
  check(`${lang} resolves to its ${family} family`, grammar !== null && JSON.stringify(grammar) === JSON.stringify({ ...grammar, ...(CODE_FAMILY_SHAPES[family] ?? {}) }), grammar)
}


// a bare identifier start must still advance the scan (regression)
check('a lone @ terminates', T.codeTokens('@a', 'ruby') !== null && T.codeTokens('@a', 'ruby').length > 0, T.codeTokens('@a', 'ruby'))
check('a lone $ terminates', T.codeTokens('$', 'js') !== null, T.codeTokens('$', 'js'))
check('ruby comments are coloured', (T.codeTokens('# c', 'ruby') ?? []).some((t) => t.kind === 'com'), T.codeTokens('# c', 'ruby'))


// ---- multi-line constructs: the state-machine half ----
const triple = T.codeTokens('x = """line1\nline2"""\ny = 1', 'py')
check('python triple quotes span lines as one string', triple.some((t) => t.kind === 'str' && t.value.includes('line2')), triple)
check('the code after a triple quote is scanned again', triple.some((t) => t.value === 'y') || triple.some((t) => t.value.includes('y')), triple.map((t) => t.value))
const single = T.codeTokens("s = 'a'\nt = 'b'", 'py')
check('ordinary quotes stay line-local', single.filter((t) => t.kind === 'str').length === 2, single)

const heredoc = T.codeTokens('cat <<EOF\n影调\nEOF\necho done', 'sh')
check('a heredoc is one string token', heredoc.filter((t) => t.kind === 'str').length === 1, heredoc)
check('the heredoc keeps its body', heredoc.find((t) => t.kind === 'str').value.includes('影调'), heredoc.find((t) => t.kind === 'str'))
check('the line after the heredoc is code again', heredoc.some((t) => t.kind === 'kw' && t.value === 'echo'), heredoc)
const heredocQuoted = T.codeTokens("cat <<'END'\na\nEND", 'sh')
check('a quoted heredoc marker works', heredocQuoted.some((t) => t.kind === 'str' && t.value.includes('a')), heredocQuoted)
const shift = T.codeTokens('x = a << 2', 'js')
check('a shift operator is not a heredoc', shift.every((t) => t.kind !== 'str'), shift)

const nested = T.codeTokens('/* a /* b */ c */ let x', 'rust')
check('rust nests block comments', nested.some((t) => t.kind === 'com' && t.value.includes('c */')), nested)
const flat = T.codeTokens('/* a /* b */ c', 'c')
check('c block comments do not nest', flat.find((t) => t.kind === 'com').value === '/* a /* b */', flat)

const template = T.codeTokens('const s = `a ${ "}" } b` + 1', 'js')
check('a template literal survives braces and inner quotes', template.some((t) => t.kind === 'str' && t.value.includes('+ 1') === false && t.value.includes('b`')), template)
check('the code after the template is scanned', template.some((t) => t.kind === 'num' && t.value === '1'), template)

// line numbering must keep multi-line tokens intact
const numberedTriple = T.renderCode('x = """a\nb"""', 'py', true)
check('numbered rendering still splits into two lines', numberedTriple.length === 2, numberedTriple.length)
const numberedStrings = JSON.stringify(numberedTriple)
check(
  'a multi-line string stays a string on both numbered lines',
  (numberedStrings.match(/dcw-tok-str/g) ?? []).length === 2 &&
    numberedStrings.includes('dcw-tok-kw') === false,
  numberedStrings.slice(0, 220),
)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
