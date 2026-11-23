import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ------------------------------------------------------------- front matter ----
const doc = '---\ntitle: 开题报告\ntags:\n  - a\n---\n\n# 正文\n\n段落\n'
const blocks = T.parseBlocks(doc)
check('front matter is its own block, not a rule', blocks[0].type === 'meta', blocks[0].type)
check('front matter keeps its body', blocks[0].value === 'title: 开题报告\ntags:\n  - a', blocks[0].value)
check('the body after front matter still parses', blocks.some((b) => b.type === 'heading'), blocks.map((b) => b.type))
check('offsets stay lossless', blocks.map((b) => doc.slice(b.from, b.to)).join('') === doc, null)

const midDoc = '前文\n\n---\n\n后文\n'
check('a later --- stays a rule', T.parseBlocks(midDoc).some((b) => b.type === 'hr'), T.parseBlocks(midDoc).map((b) => b.type))

// ------------------------------------------------------------------- alerts ----
const alertDoc = '> [!NOTE]\n> 注意这里\n\n> 普通引用\n'
const alertBlocks = T.parseBlocks(alertDoc)
check('an alert marker becomes an alert block', alertBlocks[0].type === 'alert' && alertBlocks[0].alert === 'note', alertBlocks[0])
check('the marker line is dropped from the body', alertBlocks[0].lines.length === 1 && alertBlocks[0].lines[0] === '注意这里', alertBlocks[0].lines)
check('a plain quote stays a quote', alertBlocks.some((b) => b.type === 'quote'), alertBlocks.map((b) => b.type))
for (const kind of ['tip', 'important', 'warning', 'caution']) {
  const parsed = T.parseBlocks(`> [!${kind.toUpperCase()}]\n> x\n`)
  check(`alert kind ${kind} is recognised`, parsed[0].type === 'alert' && parsed[0].alert === kind, parsed[0])
}
const alertTree = T.renderBlocks(alertBlocks)
const alertClasses = []
const walkAlert = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkAlert); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') alertClasses.push(n.props.className)
  n.children.forEach(walkAlert)
}
walkAlert(alertTree)
check('the alert renders with its kind class and label', alertClasses.some((c) => c.includes('dcw-md-alert-note')) && alertClasses.some((c) => c.includes('dcw-md-alert-label')), alertClasses)

// ---------------------------------------------------------------- footnotes ----
const fnDoc = '正文[^1]继续。\n\n[^1]: 脚注内容\n'
const fnBlocks = T.parseBlocks(fnDoc)
check('a footnote definition becomes its own block', fnBlocks.some((b) => b.type === 'footnote'), fnBlocks.map((b) => b.type))
const fnDef = fnBlocks.find((b) => b.type === 'footnote')
check('the definition keeps its id and text', fnDef.id === '1' && fnDef.value === '脚注内容', fnDef)
check('a reference inside text is not a definition', fnBlocks[0].type === 'paragraph' && fnBlocks[0].value.startsWith('正文[^1]'), fnBlocks[0].value)

const inlineFn = T.parseInline('正文[^1]继续')
check('the reference tokenises', inlineFn.some((n) => n.kind === 'fnref' && n.id === '1'), inlineFn)
const fnTree = T.renderInline(inlineFn, 'k')
const fnClasses = []
const walkFn = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkFn); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') fnClasses.push(n.props.className)
  if (n.props.href !== undefined) fnClasses.push(n.props.href)
  n.children.forEach(walkFn)
}
walkFn(fnTree)
check('the reference renders as a superscript link', fnClasses.some((c) => c.includes('dcw-md-fn')) && fnClasses.includes('#dcw-fn-1'), fnClasses)
check('a footnote definition renders with a matching anchor', (() => {
  const tree = T.renderBlocks([fnDef])
  const ids = []
  const walkId = (n) => {
    if (n === null || n === undefined) return
    if (Array.isArray(n)) { n.forEach(walkId); return }
    if (typeof n !== 'object') return
    if (n.props.id !== undefined) ids.push(n.props.id)
    n.children.forEach(walkId)
  }
  walkId(tree)
  return ids.includes('dcw-fn-1')
})(), null)

// --------------------------------------------------------------- auto pairs ----
check('an opener inserts its closer', T.autoPair('a', 1, 1, '(')?.value === 'a()', T.autoPair('a', 1, 1, '('))
check('a selection is wrapped', T.autoPair('ab', 0, 2, '[')?.value === '[ab]', T.autoPair('ab', 0, 2, '['))
check('a closer steps over the existing one', T.autoPair('a()', 2, 2, ')')?.caret === 3, T.autoPair('a()', 2, 2, ')'))
check('a closing closer is left alone', T.autoPair('a()', 3, 3, ')') === null, T.autoPair('a()', 3, 3, ')'))
check('a marker inside a word does not pair', T.autoPair('snakecase', 5, 5, '_') === null, T.autoPair('snakecase', 5, 5, '_'))
check('a marker at a word edge pairs', T.autoPair('word', 0, 0, '*')?.value === '**word', T.autoPair('word', 0, 0, '*'))
check('a quote after a letter does not pair', T.autoPair("it's", 2, 2, "'") === null, T.autoPair("it's", 2, 2, "'"))


// --------------------------------------------------- footnote ordinals/back ----
const twice = T.parseBlocks('a[^x]b[^x]c\n\n[^x]: 注\n')
const state = { seen: new Map(), order: [] }
const twiceTree = T.renderBlocks(twice, { footnoteState: state })
const anchors = []
const hrefs = []
const walkA = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkA); return }
  if (typeof n !== 'object') return
  if (n.props.id !== undefined) anchors.push(n.props.id)
  if (n.props.href !== undefined) hrefs.push(n.props.href)
  n.children.forEach(walkA)
}
walkA(twiceTree)
check('the first reference anchors its own id', anchors.includes('dcw-fnref-x'), anchors)
check('a repeated reference gets a numeric suffix', anchors.includes('dcw-fnref-x-1'), anchors)
check('both references point at the same note', hrefs.filter((h) => h === '#dcw-fn-x').length === 2, hrefs)
check('the note carries a back-link to the first reference', anchors.includes('dcw-fn-x') && hrefs.includes('#dcw-fnref-x'), hrefs)
const backClasses = []
const walkB = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkB); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') backClasses.push(n.props.className)
  n.children.forEach(walkB)
}
walkB(twiceTree)
check('the back-link uses the reference class', backClasses.some((c) => c.includes('dcw-md-fn-back')), backClasses)


// ---- footnote back-link flash ----
const flashDoc = T.parseBlocks('正文[^1]\n\n[^1]: 注\n')
let flashedId = null
const flashTree = T.renderBlocks(flashDoc, {
  footnoteState: { seen: new Map(), order: [] },
  flashAnchor: (id) => { flashedId = id },
})
const collectBack = (root) => {
  const found = []
  const walk = (n) => {
    if (n === null || n === undefined) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n !== 'object') return
    if (typeof n.props.className === 'string' && n.props.className.includes('dcw-md-fn-back')) found.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return found
}
const flashBacks = collectBack(flashTree)
check('the back-link exists', flashBacks.length === 1, flashBacks.length)
check('it carries a click handler when a flash callback is given', typeof flashBacks[0].props.onClick === 'function', typeof flashBacks[0].props.onClick)
flashBacks[0].props.onClick({ preventDefault() {} })
check('clicking it flashes the reference', flashedId === 'dcw-fnref-1', flashedId)

const quietBacks = collectBack(T.renderBlocks(flashDoc, { footnoteState: { seen: new Map(), order: [] } }))
check('without the callback it stays a plain link', quietBacks[0].props.onClick === undefined, typeof quietBacks[0].props.onClick)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
