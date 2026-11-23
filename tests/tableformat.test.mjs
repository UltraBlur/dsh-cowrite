import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ------------------------------------------------------- alignment cells ----
check('a left cell leads with a colon', T.alignmentCell('left', 5) === ':----', T.alignmentCell('left', 5))
check('a right cell trails with a colon', T.alignmentCell('right', 5) === '----:', T.alignmentCell('right', 5))
check('a centre cell wraps the dashes', T.alignmentCell('center', 5) === ':---:', T.alignmentCell('center', 5))
check('no alignment is plain dashes', T.alignmentCell(null, 5) === '-----', T.alignmentCell(null, 5))
check('the width never drops below three', T.alignmentCell('center', 1) === ':-:', T.alignmentCell('center', 1))

const RAW = '| 甲 | 乙 |\n| --- | --- |\n| 11 | 22 |\n'
const caret = RAW.indexOf('22') + 1
const centred = T.setColumnAlignment(RAW, caret, 'center')
check('centring rewrites only the second delimiter cell', centred.value.split('\n')[1] === '| --- | :-: |', centred.value.split('\n')[1])
check('the first column is untouched', centred.value.split('\n')[1].startsWith('| --- '), centred.value.split('\n')[1])
const right = T.setColumnAlignment(centred.value, caret, 'right')
check('right takes the leading colon away', right.value.split('\n')[1] === '| --- | --: |', right.value.split('\n')[1])
const backToPlain = T.setColumnAlignment(right.value, caret, null)
check('clearing the alignment drops both colons', backToPlain.value.split('\n')[1] === '| --- | --- |', backToPlain.value.split('\n')[1])
check('the dash count survives the round trip', (backToPlain.value.split('\n')[1].match(/-/g) ?? []).length === 6, null)
check('outside a table nothing changes', T.setColumnAlignment('段落', 1, 'left') === null, T.setColumnAlignment('段落', 1, 'left'))

// a padded delimiter keeps its padding
const PADDED = '| a | b |\n|  ---  |  ---  |\n| 1 | 2 |\n'
const paddedOut = T.setColumnAlignment(PADDED, PADDED.indexOf('2'), 'center')
check('existing padding is preserved', paddedOut.value.split('\n')[1] === '|  ---  |  :-:  |', paddedOut.value.split('\n')[1])

// adding a column copies the neighbour alignment
const LEFT_DOC = '| a | b |\n| :-- | --: |\n| 1 | 2 |\n'
const added = T.tableOperation(LEFT_DOC, LEFT_DOC.indexOf('2'), 'col-after')
check('a new delimiter cell mirrors the neighbour alignment', added.value.split('\n')[1] === '| :-- | --: | --: |', added.value.split('\n')[1])

// -------------------------------------------------------------- bullets ----
check('the bullet character is kept on the list', T.parseBlocks('* a\n* b\n')[0].pattern === '*', T.parseBlocks('* a\n* b\n')[0].pattern)
check('a plus bullet is kept too', T.parseBlocks('+ a\n')[0].pattern === '+', T.parseBlocks('+ a\n')[0].pattern)
const bulletTree = T.renderBlocks(T.parseBlocks('* a\n'))
const ulProps = []
const walkUl = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkUl); return }
  if (typeof n !== 'object') return
  if (n.type === 'ul') ulProps.push(n.props)
  n.children.forEach(walkUl)
}
walkUl(bulletTree)
check('the marker reaches the rendered list', ulProps[0]['data-mark'] === '*', ulProps[0])
const olTree = T.renderBlocks(T.parseBlocks('1. a\n'))
const olProps = []
const walkOl = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkOl); return }
  if (typeof n !== 'object') return
  if (n.type === 'ol') olProps.push(n.props)
  n.children.forEach(walkOl)
}
walkOl(olTree)
check('ordered lists keep native numbering', olProps[0]['data-mark'] === undefined, olProps[0])

// ------------------------------------------------------------------ toc ----
const tocBlocks = T.parseBlocks('# 甲\n\n[TOC]\n\n## 乙\n')
check('[TOC] becomes its own block', tocBlocks.some((b) => b.type === 'toc'), tocBlocks.map((b) => b.type))
const headings = tocBlocks.filter((b) => b.type === 'heading')
const tocTree = T.renderBlocks(tocBlocks, { headings })
const tocClasses = []
const tocText = []
const walkToc = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkToc); return }
  if (typeof n === 'string') { tocText.push(n); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') tocClasses.push(n.props.className)
  n.children.forEach(walkToc)
}
walkToc(tocTree)
check('the toc lists both headings in order', tocText.includes('甲') && tocText.includes('乙'), tocText)
check('toc rows carry their level class', tocClasses.some((c) => c.includes('dcw-md-toc-h1')) && tocClasses.some((c) => c.includes('dcw-md-toc-h2')), tocClasses.filter((c) => c.includes('toc')))
const emptyToc = T.renderBlocks([{ type: 'toc', from: 0, to: 5 }], { headings: [], t: (k) => k })
const emptyText = []
const walkEmpty = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkEmpty); return }
  if (typeof n === 'string') { emptyText.push(n); return }
  if (typeof n !== 'object') return
  n.children.forEach(walkEmpty)
}
walkEmpty(emptyToc)
check('an empty toc says so', emptyText.includes('toc.empty'), emptyText)

// ------------------------------------------------------------------ kbd ----
const kbdNodes = T.parseInline('按 <kbd>Ctrl</kbd> 保存')
check('kbd parses', kbdNodes.some((n) => n.kind === 'kbd' && n.value === 'Ctrl'), kbdNodes)
const kbdTree = T.renderInline(kbdNodes, 'k')
const tags = []
const walkKbd = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkKbd); return }
  if (typeof n !== 'object') return
  if (typeof n.type === 'string') tags.push(n.type)
  n.children.forEach(walkKbd)
}
walkKbd(kbdTree)
check('kbd renders as a kbd element', tags.includes('kbd'), tags)
check('a bare kbd tag is not left as text', !JSON.stringify(kbdTree).includes('<kbd>'), JSON.stringify(kbdTree).slice(0, 80))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
