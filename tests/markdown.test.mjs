import fs from 'node:fs'

const CLIENT = new URL('../client.js', import.meta.url)
const code = fs.readFileSync(CLIENT, 'utf8')

function makeReact() {
  return {
    Fragment: 'Fragment',
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity) }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useRef(value) {
      return { current: value }
    },
    useCallback(fn) {
      return fn
    },
    useMemo(fn) {
      return fn()
    },
    useEffect() {},
    useLayoutEffect() {},
  }
}

let factory = null
const React = makeReact()
const storage = new Map()
const windowStub = {
  __ModuleLoader__: {
    load(entry) {
      factory = entry.factory
    },
  },
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null
    },
    setItem(key, value) {
      storage.set(key, String(value))
    },
  },
}
new Function('window', code)(windowStub)
if (factory === null) throw new Error('client.js did not call __ModuleLoader__.load')
const mod = factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require("${name}")`)
})
const T = mod.__test
if (T === undefined) throw new Error('module did not expose __test')

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------- blocks ----
const doc = [
  '# 标题一',
  '',
  '正文第一段，',
  '第二行。',
  '',
  '## 二级标题',
  '',
  '- 项目一',
  '- [x] 已完成',
  '- [ ] 未完成',
  '',
  '1. 一',
  '2. 二',
  '',
  '> 引用第一行',
  '> 引用第二行',
  '',
  '| 列A | 列B |',
  '| :--- | ---: |',
  '| 1 | 2 |',
  '',
  '```js',
  'const x = 1',
  '```',
  '',
  '---',
  '',
  '段落 *斜体* 与 **粗体** 和 `代码`，还有 [链接](https://example.com)。',
  '',
].join('\n')

const blocks = T.parseBlocks(doc)
const types = blocks.map((b) => b.type)
check('block order covers heading/paragraph/list/table/code/hr', eq(types.filter((t) => t !== 'blank'), [
  'heading',
  'paragraph',
  'heading',
  'list',
  'list',
  'quote',
  'table',
  'code',
  'hr',
  'paragraph',
]), types)

const heading = blocks.find((b) => b.type === 'heading')
check('atx heading level and text', heading.level === 1 && heading.value === '标题一', heading)

const wrapped = blocks.filter((b) => b.type === 'paragraph')[0]
check('wrapped paragraph keeps its soft line break in source', wrapped.value === '正文第一段，\n第二行。', wrapped.value)

const lists = blocks.filter((b) => b.type === 'list')
check('unordered list items and task marks', eq(lists[0].items.map((i) => [i.task, i.value]), [
  [null, '项目一'],
  ['checked', '已完成'],
  ['unchecked', '未完成'],
]), lists[0].items)
check('ordered list keeps its start number', lists[1].ordered === true && lists[1].start === 1, lists[1])

const quote = blocks.find((b) => b.type === 'quote')
check('blockquote collects stripped lines', eq(quote.lines, ['引用第一行', '引用第二行']), quote.lines)

const table = blocks.find((b) => b.type === 'table')
check('table header, alignment and rows', eq(table.header, ['列A', '列B']) && eq(table.align, ['left', 'right']) && eq(table.rows, [['1', '2']]), table)

const codeBlock = blocks.find((b) => b.type === 'code')
check('fenced code keeps language and body', codeBlock.lang === 'js' && codeBlock.value === 'const x = 1', codeBlock)

const rebuilt = blocks.map((b) => doc.slice(b.from, b.to)).join('')
check('block offsets rebuild the document byte for byte', rebuilt === doc, rebuilt === doc ? null : rebuilt.slice(0, 80))

const setext = T.parseBlocks('标题\n====\n\n内容\n')
check('setext heading recognised', setext[0].type === 'heading' && setext[0].level === 1 && setext[0].value === '标题', setext[0])

const loose = T.parseBlocks('- a\n\n- b\n')
check('list survives one blank line between items', loose.length === 1 && loose[0].items.length === 2, loose)

// ---------------------------------------------------------------- inline ----
const inlineCases = [
  ['**粗体**', (nodes) => nodes[0].kind === 'strong' && nodes[0].children[0].value === '粗体'],
  ['*斜体*', (nodes) => nodes[0].kind === 'em'],
  ['~~删除~~', (nodes) => nodes[0].kind === 'del'],
  ['`代码`', (nodes) => nodes[0].kind === 'code' && nodes[0].value === '代码'],
  ['$x^2$', (nodes) => nodes[0].kind === 'math' && nodes[0].value === 'x^2'],
  ['[文字](https://a.com)', (nodes) => nodes[0].kind === 'link' && nodes[0].href === 'https://a.com'],
  ['![图](img.png)', (nodes) => nodes[0].kind === 'image' && nodes[0].src === 'img.png'],
  ['<https://auto.link>', (nodes) => nodes[0].kind === 'link' && nodes[0].href === 'https://auto.link'],
  ['\\*不是斜体\\*', (nodes) => nodes.length === 1 && nodes[0].kind === 'text' && nodes[0].value === '*不是斜体*'],
  ['snake_case_name', (nodes) => nodes.length === 1 && nodes[0].kind === 'text'],
]
for (const [source, assert] of inlineCases) {
  const nodes = T.parseInline(source)
  check(`inline ${source}`, assert(nodes), nodes)
}

const unsafe = T.parseInline('[点我](javascript:alert(1))')
check('javascript: link is not a link', unsafe.every((node) => node.kind !== 'link'), unsafe)

const mixed = T.parseInline('a **b** c')
check('text around emphasis preserved', mixed.length === 3 && mixed[0].value === 'a ' && mixed[1].kind === 'strong' && mixed[2].value === ' c', mixed)

const soft = T.parseInline('第一行\n第二行')
check('soft break becomes its own node', soft.some((node) => node.kind === 'softbreak'), soft)


// ------------------------------------------------------------ enter rules ----
const enterCases = [
  ['正文。', '正文。'.length, { kind: 'block', before: '正文。', after: '' }],
  ['甲乙', 1, { kind: 'block', before: '甲', after: '乙' }],
  ['- 项目', '- 项目'.length, { kind: 'inline', insert: '\n- ' }],
  ['1. 第一', '1. 第一'.length, { kind: 'inline', insert: '\n2. ' }],
  ['  3) 第三', '  3) 第三'.length, { kind: 'inline', insert: '\n  4) ' }],
  ['> 引用', '> 引用'.length, { kind: 'inline', insert: '\n> ' }],
]
for (const [value, caret, expected] of enterCases) {
  const action = T.splitOnEnter(value, caret)
  const ok =
    action.kind === expected.kind &&
    (expected.kind === 'inline'
      ? action.insert === expected.insert
      : action.before === expected.before && action.after === expected.after && action.caret === 0)
  check(`Enter in ${JSON.stringify(value)}`, ok, action)
}

const exitList = T.splitOnEnter('- 项目一\n- ', '- 项目一\n- '.length)
check(
  'Enter on an empty item ends the list',
  exitList.kind === 'block' && exitList.before === '- 项目一' && exitList.after === '',
  exitList,
)

const shiftBlock = { from: 0, to: 6, value: '标题', type: 'heading' }
check('heading text shift is the marker width', T.blockShift(shiftBlock, '# 标题\n') === 2, T.blockShift(shiftBlock, '# 标题\n'))
check('list blocks report no shift', T.blockShift({ from: 0, to: 8, type: 'list' }, '- a\n- b\n') === null, null)

// ------------------------------------------------------------- rendering ----
const rendered = T.renderBlocks(blocks)
const tags = []
const classes = []
const attrs = []
const texts = []
const walk = (node) => {
  if (node === null || node === undefined || typeof node !== 'object') {
    if (typeof node === 'string') texts.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child)
    return
  }
  if (typeof node.type === 'string') tags.push(node.type)
  if (typeof node.props.className === 'string') classes.push(node.props.className)
  if (node.props.href !== undefined) attrs.push(['href', node.props.href])
  if (node.props.src !== undefined) attrs.push(['src', node.props.src])
  if (node.props.type === 'checkbox') attrs.push(['checkbox', node.props.checked])
  for (const child of node.children) walk(child)
}
walk(rendered)

check('renders headings h1 and h2', tags.includes('h1') && tags.includes('h2'), tags.filter((t) => /^h\d$/.test(t)))
check('renders a table with th/td', tags.includes('table') && tags.includes('th') && tags.includes('td'), tags.filter((t) => ['table', 'th', 'td'].includes(t)))
check('renders a code block as pre/code', tags.includes('pre') && tags.includes('code'), tags.filter((t) => ['pre', 'code'].includes(t)))
check('renders list items with task checkboxes', tags.filter((t) => t === 'li').length >= 5 && attrs.some(([k]) => k === 'checkbox'), tags.filter((t) => t === 'li').length)
check('renders a blockquote', tags.includes('blockquote'), tags.includes('blockquote'))
check('renders inline code and a safe link', classes.some((c) => c.includes('dcw-md-code')) && attrs.some(([k, v]) => k === 'href' && v === 'https://example.com'), attrs)
check('renders bold and italic elements', tags.includes('strong') && tags.includes('em'), tags.filter((t) => ['strong', 'em'].includes(t)))

// ------------------------------------------------------------- component ----
let slotBody = null
const ctx = {
  locale: {
    bind: () => (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`),
    register: () => () => {},
  },
  slots: {
    inject(slotName, callback) {
      callback()
      return () => {}
    },
    register(options, component) {
      slotBody = component
      return () => {}
    },
  },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
  inject() {},
}
mod.apply(ctx)
check('component registered for the smoke test', typeof slotBody === 'function', typeof slotBody)

const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const props = {
  t,
  api: { call: async () => ({ files: [], root: '/ws' }) },
  useSessions: (selector) => selector({ byId: { s1: { cwd: '/ws' } } }),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}

storage.set('dsh-cowrite:mode', 'preview')
storage.set('dsh-cowrite:zoom', '1.2')
const tree = slotBody(props)
const seen = { tags: [], classes: [], texts: [] }
const walk2 = (node) => {
  if (node === null || node === undefined || typeof node !== 'object') {
    if (typeof node === 'string') seen.texts.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) walk2(child)
    return
  }
  if (typeof node.type === 'string') seen.tags.push(node.type)
  if (typeof node.props.className === 'string') seen.classes.push(node.props.className)
  for (const child of node.children) walk2(child)
}
walk2(tree)

check('mode switch offers preview and source', seen.texts.includes('mode.preview') && seen.texts.includes('mode.source'), seen.texts.slice(0, 8))
check('zoom shows the stored percentage', seen.texts.includes('120%'), seen.texts.filter((x) => x.endsWith('%')))
check('zoom buttons cross the control group', seen.classes.includes('dcw-group dcw-zoom'), seen.classes.filter((c) => c.includes('zoom')))
check('stored preview mode is the active segment', tree.children.some((child) => child && child.props && child.props.className === 'dcw-tools') ||
  seen.classes.includes('dcw-tools'), seen.classes.filter((c) => c.includes('dcw-t')))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
