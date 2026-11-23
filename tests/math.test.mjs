import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}

const harness = createHarness()
const windowStub = { localStorage: { getItem: () => null, setItem: () => {} } }
const mod = loadPlugin(windowStub)('react')
const T = mod.__test

const classNamesIn = (root) => {
  const out = []
  const walk = (node) => {
    if (node === null || node === undefined) return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (typeof node !== 'object') return
    if (typeof node.props.className === 'string') out.push(node.props.className)
    node.children.forEach(walk)
  }
  walk(root)
  return out
}

// Greek letters and symbols become glyphs.
const greek = T.parseTex('\\Delta E')
check('greek control sequence becomes a glyph', greek[0].kind === 'glyph' && greek[0].value === 'Δ', greek)

// Superscript and subscript.
const script = T.parseTex('L^*')
check('caret-superscript attaches to the base', script.some((n) => n.kind === 'sup'), script)
const sub = T.parseTex('L_0')
check('underscore becomes a subscript', sub.some((n) => n.kind === 'sub'), sub)

// Fractions and roots.
const frac = T.parseTex('\\frac{a}{b}')
check('frac carries numerator and denominator', frac[0].kind === 'frac' && frac[0].numerator.length === 1 && frac[0].denominator.length === 1, frac)
const root = T.parseTex('\\sqrt{Y}')
check('sqrt carries its radicand', root[0].kind === 'sqrt', root)

// Upright text and bold.
const text = T.parseTex('\\text{cd/m}')
check('text command becomes an upright run', text[0].kind === 'textrun' && text[0].className === '', text)
// `^` steals the preceding node as its base, so the upright sits inside it.
const textScript = T.parseTex('\\text{cd/m}^2')
check('a script over \\text keeps the upright base', textScript[0].kind === 'sup' && textScript[0].base.kind === 'textrun', textScript)
const bold = T.parseTex('\\mathbf{Y}')
check('mathbf becomes a bold font run', bold[0].kind === 'texfont' && bold[0].spec.className === 'dcw-tex-bold', bold)

// Unknown commands degrade to their own name.
const unknown = T.parseTex('\\weirdcmd')
check('an unknown command degrades to its name', unknown[0].kind === 'upright' && unknown[0].children[0].value === 'weirdcmd', unknown)

// Empty / plain input does not throw.
check('empty formula parses to nothing', T.parseTex('').length === 0, T.parseTex(''))
check('plain digits stay text', T.parseTex('12.5')[0].kind === 'text', T.parseTex('12.5'))

// Rendering: an inline formula produces TeX classes, not raw source.
const nodes = T.parseInline('亮度 $\\frac{L}{L_0}$ 比值')
const children = T.renderInline(nodes, 'k', false, null, null)
const classes = classNamesIn(children)
check('inline math renders through the TeX renderer', classes.some((c) => c.includes('dcw-tex-frac')), classes)
check('the formula source does not leak into the text', !JSON.stringify(children).includes('\\\\frac'), JSON.stringify(children).slice(0, 120))

// Rendering: a $$ block becomes a display block.
const blocks = T.parseBlocks('$$\nL^* = 116 f(Y)\n$$\n')
check('a $$ fence becomes a math block', blocks[0].type === 'math' && blocks[0].value.includes('L^*'), blocks[0])
const blockTree = T.renderBlocks(blocks)
check('the math block renders as a display element', classNamesIn(blockTree).some((c) => c.includes('dcw-md-mathblock')), classNamesIn(blockTree))

// A single-line $$ pair stays a block, not inline.
const sameLine = T.parseBlocks('$$E = mc^2$$\n')
check('a single-line $$ pair is a block', sameLine[0].type === 'math', sameLine[0])


// ---- matrices, alignment, fences, accents, stacks ----
const matrix = T.parseTex('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')
check('pmatrix becomes an environment node', matrix[0].kind === 'env' && matrix[0].name === 'pmatrix', matrix[0])
check('it keeps two rows of two cells', matrix[0].rows.length === 2 && matrix[0].rows[0].length === 2, matrix[0].rows)

const aligned = T.parseTex('\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}')
check('aligned keeps both rows', aligned[0].rows.length === 2, aligned[0].rows.length)
check('alignment tabs split the cells', aligned[0].rows[0].length === 2, aligned[0].rows[0].length)

const trailing = T.parseTex('\\begin{matrix} a \\\\ \\end{matrix}')
check('a trailing row break does not add an empty row', trailing[0].rows.length === 1, trailing[0].rows.length)

const brace = T.parseTex('\\left( \\frac{a}{b} \\right)')
check('left and right become fences', brace.some((n) => n.kind === 'fence' && n.value === '(') && brace.some((n) => n.kind === 'fence' && n.value === ')'), brace)
const dotFence = T.parseTex('\\left. x \\right|')
check('a dot fence renders nothing but keeps the other side', dotFence[0].value === '' && dotFence.some((n) => n.kind === 'fence' && n.value === '|'), dotFence)

const hat = T.parseTex('\\hat{Y}')
check('an accent attaches a combining mark', hat[0].kind === 'accent' && hat[0].mark === '\u0302', hat[0])
const over = T.parseTex('\\overline{ab}')
check('overline wraps its content', over[0].kind === 'overline', over[0])
const cancel = T.parseTex('\\cancel{x}')
check('cancel wraps its content', cancel[0].kind === 'cancel', cancel[0])
const phantom = T.parseTex('\\phantom{x}')
check('phantom wraps its content', phantom[0].kind === 'phantom', phantom[0])
const overset = T.parseTex('\\overset{!}{=}')
check('overset carries both parts', overset[0].kind === 'overset' && overset[0].over.length === 1, overset[0])
const binom = T.parseTex('\\binom{n}{k}')
check('binom carries both arguments', binom[0].kind === 'binom' && binom[0].top.length === 1, binom[0])
const gap = T.parseTex('a \\quad b')
check('spacing commands become gaps', gap.some((n) => n.kind === 'gap' && n.width === '1em'), gap)
const thin = T.parseTex('a\\,b')
check('thin space is a small gap', thin.some((n) => n.kind === 'gap' && n.width === '0.17em'), thin)

// rendering of the new kinds
const envTree = T.renderTex(T.parseTex('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'), 'k')
const envClasses = []
const walkEnv = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkEnv); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') envClasses.push(n.props.className)
  if (typeof n.type === 'string') envClasses.push(`tag:${n.type}`)
  n.children.forEach(walkEnv)
}
walkEnv(envTree)
check('the matrix renders as a table with fences', envClasses.some((c) => c.includes('dcw-tex-matrix')) && envClasses.filter((c) => c === 'dcw-tex-fence').length === 2, envClasses)


// ---- macros taken from the MathJax command table ----
const bb = T.parseTex('\\mathbb{R}')
check('mathbb maps letters to double-struck', bb[0].kind === 'texfont' && bb[0].spec.alphabet === 'bb', bb[0])
const bbGlyph = T.mathAlphabet('R', 'bb')
check('R becomes the letterlike double-struck R', bbGlyph === '\u211c'.replace('\u211c', String.fromCodePoint(0x211d)), bbGlyph)
check('A becomes mathematical double-struck A', T.mathAlphabet('A', 'bb') === String.fromCodePoint(0x1d538), T.mathAlphabet('A', 'bb'))
const calGlyph = T.mathAlphabet('L', 'cal')
check('L becomes the script L', calGlyph === String.fromCodePoint(0x2112), calGlyph)
check('fraktur letters map too', T.mathAlphabet('g', 'frak') === String.fromCodePoint(0x1d524), T.mathAlphabet('g', 'frak'))
check('unknown characters pass through', T.mathAlphabet('x + 1', 'bb').includes('+'), T.mathAlphabet('x + 1', 'bb'))

check('boxed wraps its content', T.parseTex('\\boxed{x}')[0].kind === 'boxed', T.parseTex('\\boxed{x}')[0])
check('stackrel becomes an overset', T.parseTex('\\stackrel{!}{=}')[0].kind === 'overset', T.parseTex('\\stackrel{!}{=}')[0])
const ou = T.parseTex('\\overunderset{a}{b}{c}')[0]
check('overunderset carries three parts', ou.kind === 'overunderset' && ou.over.length === 1 && ou.under.length === 1, ou)
check('overbrace is its own node', T.parseTex('\\overbrace{ab}')[0].kind === 'overbrace', null)
check('underbrace is its own node', T.parseTex('\\underbrace{ab}')[0].kind === 'underbrace', null)
check('big fences scale', T.parseTex('\\Big(').some((n) => n.kind === 'bigfence' && n.size === 'big2'), T.parseTex('\\Big('))
check('bigl keeps the delimiter', T.parseTex('\\bigl[')[0].value === '[', T.parseTex('\\bigl[')[0])
check('iff renders as a glyph', T.parseTex('\\iff')[0].kind === 'glyph' && T.parseTex('\\iff')[0].value === '⟺', T.parseTex('\\iff')[0])
check('pmod keeps its argument', T.parseTex('\\pmod{n}')[0].kind === 'pmod', T.parseTex('\\pmod{n}')[0])
check('hspace becomes a gap of its width', T.parseTex('\\hspace{2em}').some((n) => n.kind === 'gap' && n.width === '2em'), T.parseTex('\\hspace{2em}'))
check('an unsafe hspace width falls back', T.parseTex('\\hspace{x}').some((n) => n.kind === 'gap' && n.width === '0.5em'), null)
check('sqrt keeps an index', T.parseTex('\\sqrt[3]{x}')[0].kind === 'sqrt' && T.parseTex('\\sqrt[3]{x}')[0].index.length === 1, T.parseTex('\\sqrt[3]{x}')[0])
check('textbf is a bold text run', T.parseTex('\\textbf{x}')[0].className === 'dcw-tex-bold', T.parseTex('\\textbf{x}')[0])
check('texttt is a mono text run', T.parseTex('\\texttt{x}')[0].className === 'dcw-tex-tt', null)
check('smash is recognised', T.parseTex('\\smash{x}')[0].kind === 'smash', T.parseTex('\\smash{x}')[0])

const fontTree = T.renderTex(T.parseTex('\\mathbb{R}'), 'k')
const fontClasses = []
const walkF = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkF); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') fontClasses.push(n.props.className)
  n.children.forEach(walkF)
}
walkF(fontTree)
check('the rendered double-struck text carries a class', fontClasses.some((c) => c.includes('dcw-tex-bb')), fontClasses)


// ---- binomial family, genfrac, substack, lap boxes ----
const binomNoRule = T.parseTex('\\binom{n}{k}')[0]
check('binom has no fraction rule by default', binomNoRule.kind === 'binom' && (binom.rule === undefined || binom.rule === false), binomNoRule)
const binomNoRuleTree = T.renderTex([binomNoRule], 'k')
const binomNoRuleClasses = []
const walkB = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkB); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') binomNoRuleClasses.push(n.props.className)
  n.children.forEach(walkB)
}
walkB(binomNoRuleTree)
check('the rendered binomial carries no rule class', binomNoRuleClasses.includes('dcw-tex-nobar') && !binomNoRuleClasses.includes('dcw-tex-num'), binomNoRuleClasses)

const dbinom = T.parseTex('\\dbinom{n}{k}')[0]
const tbinom = T.parseTex('\\tbinom{n}{k}')[0]
check('dbinom stays full size', dbinom.size === 'normal', dbinom.size)
check('tbinom is the small variant', tbinom.size === 'small', tbinom.size)

const genfracPlain = T.parseTex('\\genfrac{}{}{0}{}{a}{b}')[0]
check('genfrac with zero thickness has no rule', genfracPlain.kind === 'binom' && genfracPlain.rule === false, genfracPlain)
const genfracRuled = T.parseTex('\\genfrac{[}{]}{0.4pt}{}{a}{b}')[0]
check('genfrac keeps custom fences', genfracRuled.open === '[' && genfracRuled.close === ']', genfracRuled)
check('a non-zero thickness keeps the rule', genfracRuled.rule === true, genfracRuled)

const stack = T.parseTex('\\substack{a \\\\ b}')[0]
check('substack keeps both rows', stack.kind === 'substack' && stack.rows.length === 2, stack)
check('substack rows carry their content', stack.rows[0].some((n) => n.value === 'a') && stack.rows[1].some((n) => n.value === 'b'), stack.rows)

check('mathclap is a centred lap', T.parseTex('\\mathclap{x}')[0].kind === 'lap' && T.parseTex('\\mathclap{x}')[0].align === 'center', null)
check('mathllap hugs the left', T.parseTex('\\mathllap{x}')[0].align === 'left', null)
check('mathrlap hugs the right', T.parseTex('\\mathrlap{x}')[0].align === 'right', null)


// ---- colours ----
check('a hex colour is accepted', T.safeColor('#ff0000') === '#ff0000', T.safeColor('#ff0000'))
check('a short hex is accepted', T.safeColor('#f00') === '#f00', T.safeColor('#f00'))
check('a css colour name is accepted', T.safeColor('Tomato') === 'Tomato', T.safeColor('Tomato'))
check('an rgb() colour is accepted', T.safeColor('rgb(10, 20, 30)') === 'rgb(10, 20, 30)', T.safeColor('rgb(10, 20, 30)'))
check('a url is refused', T.safeColor('url(x)') === null, T.safeColor('url(x)'))
check('a javascript url is refused', T.safeColor('javascript:alert(1)') === null, T.safeColor('javascript:alert(1)'))
check('an empty colour is refused', T.safeColor('') === null, T.safeColor(''))

const colored = T.parseTex('\\textcolor{red}{x}')
check('textcolor carries its colour', colored[0].kind === 'colored' && colored[0].color === 'red', colored[0])
const unsafeColor = T.parseTex('\\textcolor{url(x)}{y}')
check('an unsafe colour degrades to no colour', unsafeColor[0].kind === 'colored' && unsafeColor[0].color === null, unsafeColor[0])
const switchColor = T.parseTex('\\color{blue} a b')
check('color becomes a switch node', switchColor[0].kind === 'colorSwitch' && switchColor[0].color === 'blue', switchColor[0])
const boxedColor = T.parseTex('\\colorbox{yellow}{x}')
check('colorbox carries a background', boxedColor[0].kind === 'colorbox' && boxedColor[0].color === 'yellow', boxedColor[0])
const framed = T.parseTex('\\fcolorbox{red}{yellow}{x}')
check('fcolorbox carries both colours', framed[0].border === 'red' && framed[0].color === 'yellow', framed[0])
const defined = T.parseTex('\\definecolor{brand}{rgb}{10,20,30} \\textcolor{brand}{x}')
check('definecolor registers a reusable colour', defined.some((n) => n.kind === 'colored' && n.color === '#0a141e'), defined)

// rendering
const colorTree = T.renderTex(T.parseTex('\\textcolor{red}{x}'), 'k')
const colorStyles = []
const walkColor = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkColor); return }
  if (typeof n !== 'object') return
  if (n.props.style !== undefined) colorStyles.push(n.props.style)
  n.children.forEach(walkColor)
}
walkColor(colorTree)
check('the colour reaches a style', colorStyles.some((style) => style.color === 'red'), colorStyles)

const switchTree = T.renderTex(T.parseTex('\\color{blue} a b'), 'k')
const switchColors = []
const walkSwitch = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkSwitch); return }
  if (typeof n !== 'object') return
  if (n.props.style !== undefined && n.props.style.color !== undefined) switchColors.push(n.props.style.color)
  n.children.forEach(walkSwitch)
}
walkSwitch(switchTree)
check('a switch tints the following items', switchColors.length >= 2 && switchColors.every((c) => c === 'blue'), switchColors)


// ---- formula numbering ----
const tagged = T.parseTex('Y = 1 \\tag{2.1}')
check('tag becomes its own node', tagged.some((n) => n.kind === 'tag' && n.value === '2.1'), tagged)
const split = T.splitMathTag(tagged)
check('split pulls the tag out', split.tag === '2.1' && !split.content.some((n) => n.kind === 'tag'), split)
const noTag = T.splitMathTag(T.parseTex('Y = 1'))
check('a formula without a tag has none', noTag.tag === null, noTag.tag)
const suppressed = T.splitMathTag(T.parseTex('Y = 1 \\tag{1} \\notag'))
check('notag suppresses the number', suppressed.tag === null, suppressed.tag)
const display = T.renderMathDisplay('Y = 1 \\tag{A.1}')
check('the display renderer reports the tag', display.tag === 'A.1', display.tag)
check('the body keeps the formula', JSON.stringify(display.content).includes('Y'), null)

const taggedBlocks = T.parseBlocks('$$\nY = 1 \\tag{3.2}\n$$\n')
const taggedTree = T.renderBlocks(taggedBlocks)
const taggedClasses = []
const taggedText = []
const walkTag = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkTag); return }
  if (typeof n === 'string') { taggedText.push(n); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') taggedClasses.push(n.props.className)
  n.children.forEach(walkTag)
}
walkTag(taggedTree)
check('the block renders a tag element', taggedClasses.includes('dcw-md-mathtag'), taggedClasses.filter((c) => c.includes('math')))
check('the tag shows its number in brackets', taggedText.includes('(3.2)'), taggedText)
check('the formula body is its own element', taggedClasses.includes('dcw-md-mathbody'), null)

const untagged = T.renderBlocks(T.parseBlocks('$$\nY = 1\n$$\n'))
const untaggedClasses = []
const walkUntagged = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkUntagged); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') untaggedClasses.push(n.props.className)
  n.children.forEach(walkUntagged)
}
walkUntagged(untagged)
check('an untagged formula renders no number', !untaggedClasses.includes('dcw-md-mathtag'), untaggedClasses.filter((c) => c.includes('math')))

const inlined = T.renderInline(T.parseInline('$Y$ 与 $\tag{9}Z$'), 'k')
check('inline formulas are never numbered', !JSON.stringify(inlined).includes('dcw-md-mathtag'), null)


// ---- chemistry ----
const flatten = (node, out = []) => {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, out)); return out }
  if (typeof node !== 'object') { out.push(node); return out }
  flatten(node.children, out)
  return out
}
const tagsOf = (node, out = []) => {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) { node.forEach((child) => tagsOf(child, out)); return out }
  if (typeof node !== 'object') return out
  if (typeof node.type === 'string') out.push(node.type)
  tagsOf(node.children, out)
  return out
}

const water = T.renderChem('H2O')
check('element digits become subscripts', tagsOf(water).includes('sub') && flatten(water).join('') === 'H2O', flatten(water))
check('a leading coefficient is not a subscript', !tagsOf(T.renderChem('2H2O')).includes('sub') === false, tagsOf(T.renderChem('2H2O')))
const charged = T.parseTex('\\ce{SO4^2-}')
check('ce becomes a chem node', charged[0].kind === 'chem' && charged[0].value === 'SO4^2-', charged[0])
const chargeTree = T.renderChem('SO4^2-')
check('a charge becomes a superscript', tagsOf(chargeTree).includes('sup'), tagsOf(chargeTree))
check('a braced charge works', flatten(T.renderChem('Fe^{3+}')).join('') === 'Fe3+', flatten(T.renderChem('Fe^{3+}')))
const arrowTree = T.renderChem('2H2 + O2 -> 2H2O')
check('an arrow becomes a glyph', flatten(arrowTree).includes('→'), flatten(arrowTree))
check('an equilibrium arrow is mapped', flatten(T.renderChem('N2 <=> 2N')).includes('⇌'), flatten(T.renderChem('N2 <=> 2N')))
check('a star becomes a dot', flatten(T.renderChem('A*B')).includes('·'), flatten(T.renderChem('A*B')))
check('letters render upright', (() => {
  const tree = T.renderChem('Na')
  const found = []
  const walk = (n) => {
    if (n === null || n === undefined) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n !== 'object') return
    if (typeof n.props.className === 'string' && n.props.className.includes('dcw-tex-up')) found.push(n)
    walk(n.children)
  }
  walk(tree)
  return found.length === 1
})(), null)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
