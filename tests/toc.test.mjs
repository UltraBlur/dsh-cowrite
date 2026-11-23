import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

const texts = (tree) => {
  const out = []
  const walk = (n) => {
    if (n === null || n === undefined) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n === 'string') { out.push(n); return }
    if (typeof n !== 'object') return
    n.children.forEach(walk)
  }
  walk(tree)
  return out
}

// The toc reads the headings handed to the renderer, so it follows edits.
const blocks = T.parseBlocks('# 甲\n\n[TOC]\n')
check('an empty heading list shows the placeholder', texts(T.renderBlocks(blocks, { headings: [], t: (k) => k })).includes('toc.empty'), null)
const withHeading = T.renderBlocks(blocks, { headings: blocks.filter((b) => b.type === 'heading') })
check('a heading appears in the toc', texts(withHeading).includes('甲'), texts(withHeading))

// Edit the heading, reparse: the toc text follows without any extra wiring.
const edited = T.parseBlocks('# 甲改\n\n[TOC]\n')
const after = T.renderBlocks(edited, { headings: edited.filter((b) => b.type === 'heading') })
check('the toc follows a rename', texts(after).includes('甲改') && !texts(after).includes('甲'), texts(after))

// A new deeper heading slots in at its own level.
const grown = T.parseBlocks('# 甲\n\n## 乙\n\n[TOC]\n')
const grownTree = T.renderBlocks(grown, { headings: grown.filter((b) => b.type === 'heading') })
const classes = []
const walkC = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkC); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') classes.push(n.props.className)
  n.children.forEach(walkC)
}
walkC(grownTree)
check('a second level appears with its own indent class', classes.some((c) => c.includes('dcw-md-toc-h2')), classes.filter((c) => c.includes('toc-h')))

// Removing every heading returns to the placeholder.
const none = T.parseBlocks('[TOC]\n')
check('removing all headings returns the placeholder', texts(T.renderBlocks(none, { headings: [], t: (k) => k })).includes('toc.empty'), null)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
