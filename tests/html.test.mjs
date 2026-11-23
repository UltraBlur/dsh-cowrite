import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- inline tags ----
const supers = T.parseInline('E = mc<sup>2</sup>')
check('sup parses as an element', supers.some((n) => n.kind === 'html' && n.tag === 'sup'), supers)
const sub = T.parseInline('L<sub>0</sub>')
check('sub parses too', sub.some((n) => n.kind === 'html' && n.tag === 'sub'), sub)
const mark = T.parseInline('<mark>重点</mark>')
check('mark keeps its inner text', mark.some((n) => n.kind === 'html' && n.children.some((c) => c.value === '重点')), mark)
const br = T.parseInline('a<br>b')
check('br is self closing', br.some((n) => n.kind === 'html' && n.selfClosing === true), br)
const unknown = T.parseInline('<blink>x</blink>')
check('a tag outside the whitelist stays text', unknown.every((n) => n.kind !== 'html'), unknown)
const unclosed = T.parseInline('<sup>2')
check('an unclosed tag stays text', unclosed.every((n) => n.kind !== 'html'), unclosed)
const linked = T.parseInline('<a href="https://a.com">x</a>')
check('a keeps its href', linked.some((n) => n.kind === 'html' && n.attributes.includes('https://a.com')), linked)

const tree = T.renderInline(T.parseInline('E = mc<sup>2</sup>'), 'k')
const tags = []
const attrs = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (typeof n.type === 'string') tags.push(n.type)
  if (n.props.href !== undefined) attrs.push(n.props.href)
  n.children.forEach(walk)
}
walk(tree)
check('sup renders as a real element', tags.includes('sup'), tags)
check('inline tags carry no danger', JSON.stringify(tree).includes('dangerouslySetInnerHTML') === false, null)

const hrefTree = T.renderInline(T.parseInline('<a href="https://a.com" class="c">x</a>'), 'k')
const found = []
const walkHref = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkHref); return }
  if (typeof n !== 'object') return
  if (n.type === 'a') found.push(n.props)
  n.children.forEach(walkHref)
}
walkHref(hrefTree)
check('anchor gets a target and its class', found[0].target === '_blank' && found[0].className === 'c', found[0])

// ---- html blocks ----
const block = T.parseBlocks('<div align="center">\n文字\n</div>\n')
check('an html block is its own block', block[0].type === 'html' && block[0].name === 'div', block[0].type)
check('the block keeps its body', block[0].value.includes('文字'), block[0].value)
check('a following paragraph still parses', T.parseBlocks('<p>x</p>\n\n后文\n').some((b) => b.type === 'paragraph'), null)
const selfContained = T.parseBlocks('<img src="a.png">\n\n后文\n')
check('a single-line tag does not swallow the next block', selfContained.some((b) => b.type === 'paragraph'), selfContained.map((b) => b.type))

check('scripts are stripped', T.sanitizeHtml('<div><script>x()</script>ok</div>') === '<div>ok</div>', T.sanitizeHtml('<div><script>x()</script>ok</div>'))
check('inline handlers are stripped', T.sanitizeHtml('<p onclick="go()">x</p>') === '<p>x</p>', T.sanitizeHtml('<p onclick="go()">x</p>'))
check('quoted handlers with spaces are stripped', T.sanitizeHtml('<p onclick="a(1, 2)">x</p>') === '<p>x</p>', T.sanitizeHtml('<p onclick="a(1, 2)">x</p>'))
check('plain attributes survive', T.sanitizeHtml('<img width="300" src="a.png">') === '<img width="300" src="a.png">', T.sanitizeHtml('<img width="300" src="a.png">'))

const htmlTree = T.renderBlocks(block)
check('the block renders through innerHTML', JSON.stringify(htmlTree).includes('dangerouslySetInnerHTML'), null)


// ---- image size attributes ----
const sized = T.parseInline('![图](a.png){width=300 height=200}')
const img = sized.find((n) => n.kind === 'image')
check('a size group attaches to the image', img !== undefined && img.width === '300' && img.height === '200', img)
check('the attribute group is consumed, not left as text', sized.every((n) => n.kind !== 'text' || !n.value.includes('width')), sized)
const sizedTree = T.renderInline(sized, 'k', false, null, { root: '/w', dir: '' })
const imgProps = []
const walkImg = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkImg); return }
  if (typeof n !== 'object') return
  if (n.type === 'img') imgProps.push(n.props)
  n.children.forEach(walkImg)
}
walkImg(sizedTree)
check('the width reaches the element', imgProps[0].width === '300' && imgProps[0].style.width === '300', imgProps[0])
const plainImg = T.parseInline('![图](a.png)')
check('an unsized image has no width', plainImg.find((n) => n.kind === 'image').width === undefined, null)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
