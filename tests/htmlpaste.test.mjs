import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- converter ----
check('plain text is not treated as HTML', T.htmlToMarkdown('just text') === '', T.htmlToMarkdown('just text'))
check('paragraphs keep their inline emphasis', T.htmlToMarkdown('<p>a <b>b</b></p>') === 'a **b**', T.htmlToMarkdown('<p>a <b>b</b></p>'))
check('spaces around inline markers survive', T.htmlToMarkdown('<p>Hello <strong>world</strong></p>') === 'Hello **world**', T.htmlToMarkdown('<p>Hello <strong>world</strong></p>'))
check('italics use single stars', T.htmlToMarkdown('<p><i>x</i></p>') === '*x*', T.htmlToMarkdown('<p><i>x</i></p>'))
check('strike uses tildes', T.htmlToMarkdown('<p><del>x</del></p>') === '~~x~~', T.htmlToMarkdown('<p><del>x</del></p>'))
check('inline code uses backticks', T.htmlToMarkdown('<p><code>x</code></p>') === '`x`', T.htmlToMarkdown('<p><code>x</code></p>'))
check('headings become hashes', T.htmlToMarkdown('<h3>标题</h3>') === '### 标题', T.htmlToMarkdown('<h3>标题</h3>'))
check('links keep their href', T.htmlToMarkdown('<p><a href="https://a.com">a</a></p>') === '[a](https://a.com)', T.htmlToMarkdown('<p><a href="https://a.com">a</a></p>'))
check('images keep src and alt', T.htmlToMarkdown('<p><img src="a.png" alt="图"></p>') === '![图](a.png)', T.htmlToMarkdown('<p><img src="a.png" alt="图"></p>'))
check('unordered lists become dashes', T.htmlToMarkdown('<ul><li>一</li><li>二</li></ul>') === '- 一\n- 二', T.htmlToMarkdown('<ul><li>一</li><li>二</li></ul>'))
check('ordered lists become numbers', T.htmlToMarkdown('<ol><li>甲</li><li>乙</li></ol>') === '1. 甲\n2. 乙', T.htmlToMarkdown('<ol><li>甲</li><li>乙</li></ol>'))
check('a nested list is indented', /- 一\n {2,}- 一甲/.test(T.htmlToMarkdown('<ul><li>一<ul><li>一甲</li></ul></li></ul>')), T.htmlToMarkdown('<ul><li>一<ul><li>一甲</li></ul></li></ul>'))
check('quotes get a bar', T.htmlToMarkdown('<blockquote><p>引用</p></blockquote>') === '> 引用', T.htmlToMarkdown('<blockquote><p>引用</p></blockquote>'))
check('pre keeps its line breaks in a fence', T.htmlToMarkdown('<pre>a\nb</pre>') === '```\na\nb\n```', T.htmlToMarkdown('<pre>a\nb</pre>'))
check('rules become dashes', T.htmlToMarkdown('<p>a</p><hr><p>b</p>').includes('---'), T.htmlToMarkdown('<p>a</p><hr><p>b</p>'))
check('br becomes a newline', T.htmlToMarkdown('<p>a<br>b</p>') === 'a\nb', T.htmlToMarkdown('<p>a<br>b</p>'))
const table = T.htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>')
check('a table becomes pipes with a delimiter row', table.split('\n')[0] === '| A | B |' && table.split('\n')[1] === '| --- | --- |', table)
check('entities are decoded', T.htmlToMarkdown('<p>a &amp; b &lt;c&gt;</p>') === 'a & b <c>', T.htmlToMarkdown('<p>a &amp; b &lt;c&gt;</p>'))
check('numeric entities are decoded', T.decodeEntities('&#65;&#x42;') === 'AB', T.decodeEntities('&#65;&#x42;'))
check('scripts are dropped', !T.htmlToMarkdown('<p>a</p><script>bad()</script>').includes('bad'), T.htmlToMarkdown('<p>a</p><script>bad()</script>'))
check('unknown tags keep their text', T.htmlToMarkdown('<p><custom>x</custom></p>') === 'x', T.htmlToMarkdown('<p><custom>x</custom></p>'))
check('blank lines are collapsed', !T.htmlToMarkdown('<p>a</p><p></p><p></p><p>b</p>').includes('\n\n\n'), null)

// ---- integration: a rich paste becomes markdown in the buffer ----
const DOC = '正文\n'
const storage = new Map([['dsh-cowrite:mode', 'source']])
const harness2 = createHarness()
const mod2 = loadPlugin({ localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: () => {} } })('react')
let body = null
const ctx = {
  locale: { bind: () => (k) => k, register: () => () => {} },
  slots: { inject: (n, cb) => { cb(); return () => {} }, register: (o, c) => { body = c; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  inject() {},
}
mod2.apply(ctx)
let written = null
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: written ?? DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    if (p.action === 'write') { written = p.content; return { path: 'd.md', size: p.content.length, mtimeMs: 2 } }
    return {}
  },
  async upload() { return {} },
}
const t = (k, vars) => (vars === undefined ? k : `${k}${JSON.stringify(vars)}`)
const props = {
  t, api,
  useSessions: (sel) => sel({ byId: { s1: { cwd: '/w' } } }),
  useTabInfo: () => ({ tab: { id: 't', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}
const tick = () => new Promise((r) => setTimeout(r, 0))
let tree = harness2.render(body, props)
for (let i = 0; i < 14; i += 1) {
  await tick()
  if (!harness2.scheduled) { if (i > 3) break; continue }
  tree = harness2.render(body, props)
}
tree = harness2.render(body, props)
const collect = (n, out = []) => {
  if (n === null || n === undefined) return out
  if (Array.isArray(n)) { for (const c of n) collect(c, out); return out }
  if (typeof n !== 'object') return out
  out.push(n)
  for (const c of n.children) collect(c, out)
  return out
}
const byClass = (name) => collect(tree).filter((n) => typeof n.props.className === 'string' && n.props.className.split(' ').includes(name))
const editor = byClass('dcw-editor')[0]

let prevented = false
const clipboard = {
  files: [],
  getData: (type) => (type === 'text/html' ? '<p>复制 <b>这段</b></p>' : '复制 这段'),
}
editor.props.onPaste({
  preventDefault: () => { prevented = true },
  clipboardData: clipboard,
  target: { value: DOC, selectionStart: 0, selectionEnd: 0 },
})
tree = harness2.render(body, props)
check('a rich paste is consumed', prevented === true, prevented)
const after = byClass('dcw-editor')[0]
check('the markdown reaches the buffer', after.props.value.includes('复制 **这段**'), after.props.value)
await new Promise((r) => setTimeout(r, 900))
check('the conversion is saved', (written ?? '').includes('复制 **这段**'), (written ?? '').trim())

// a plain paste converts to the same text, so it is left to the browser
prevented = false
editor.props.onPaste({
  preventDefault: () => { prevented = true },
  clipboardData: { files: [], getData: (type) => (type === 'text/html' ? '<p>plain</p>' : 'plain') },
  target: { value: DOC, selectionStart: 0, selectionEnd: 0 },
})
check('a structureless paste is left alone', prevented === false, prevented)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
