import fs from 'node:fs'
import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- serialiser ----
check('text is escaped', T.nodeToHtml(['a & b < c']) === 'a &amp; b &lt; c', T.nodeToHtml(['a & b < c']))
check('quotes in attributes are escaped', T.nodeToHtml([{ type: 'img', props: { src: 'a"b' }, children: [] }]).includes('&quot;'), T.nodeToHtml([{ type: 'img', props: { src: 'a"b' }, children: [] }]))
check('void tags get no closing tag', T.nodeToHtml([{ type: 'br', props: {}, children: [] }]) === '<br>', T.nodeToHtml([{ type: 'br', props: {}, children: [] }]))
check('classes and styles serialise', T.nodeToHtml([{ type: 'p', props: { className: 'x', style: { width: '2px' } }, children: ['t'] }]) === '<p class="x" style="width: 2px">t</p>', null)
check('checked renders as a bare attribute', T.nodeToHtml([{ type: 'input', props: { type: 'checkbox', checked: true }, children: [] }]).includes('checked'), null)
check('unchecked drops the attribute', !T.nodeToHtml([{ type: 'input', props: { type: 'checkbox', checked: false }, children: [] }]).includes('checked'), null)
check('nested children serialise in order', T.nodeToHtml([{ type: 'p', props: {}, children: ['a', { type: 'b', props: {}, children: ['c'] }] }]) === '<p>a<b>c</b></p>', null)
check('raw html blocks pass through unescaped', T.nodeToHtml([{ type: 'div', props: { dangerouslySetInnerHTML: { __html: '<i>x</i>' } }, children: [] }]) === '<div><i>x</i></div>', null)

// ---- document wrapper ----
const docHtml = T.buildExportDocument({ title: '开题报告.md', body: '<p>x</p>', css: 'p{color:red}' })
check('the document declares a doctype', docHtml.startsWith('<!doctype html>'), docHtml.slice(0, 20))
check('the title keeps the name without the extension', docHtml.includes('<title>开题报告</title>'), null)
check('the stylesheet is embedded', docHtml.includes('p{color:red}'), null)
check('the body is wrapped in the export container', docHtml.includes('<div id="write">') && docHtml.includes('<p>x</p>'), null)
check('the body carries the export class', docHtml.includes('class="typora-export"'), null)
check('the title is escaped', T.buildExportDocument({ title: 'a<b>.md' }).includes('a&lt;b&gt;'), null)

// ---- print stylesheet ----
const css = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
check('chrome is hidden when printing', css.includes('.dcw-bar, .dcw-tools, .dcw-find, .dcw-outline'), null)
check('blocks avoid page breaks', css.includes('page-break-inside: avoid'), null)
check('headings avoid trailing breaks', css.includes('page-break-after: avoid'), null)
check('page margins are declared', css.includes('@page { margin: 18mm 16mm; }'), null)
check('dimmed text prints at full contrast', css.includes('.dcw-live-block[data-dim="true"] * { color: inherit !important; }'), null)

// ---- the toolbar control ----
const DOC = '# 标题\n\n正文\n'
const storage = new Map([['dsh-cowrite:mode', 'preview']])
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
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'sub/d.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'sub/d.md', content: DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'sub/d.md', size: DOC.length, mtimeMs: 1 }
    return {}
  },
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
const exportBtn = byClass(tree, 'dcw-seg').find((n) => textOf(n) === '⤓')
check('the export control exists', exportBtn !== undefined, byClass(tree, 'dcw-seg').map(textOf))
check('it is enabled once a file is open', exportBtn.props.disabled === false, exportBtn.props.disabled)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
