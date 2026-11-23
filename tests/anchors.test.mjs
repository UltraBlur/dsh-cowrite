import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- slugs ----
check('a latin heading keeps its words', T.headingSlug('Tone Mapping 研究') === 'tone-mapping-研究', T.headingSlug('Tone Mapping 研究'))
check('punctuation is dropped', T.headingSlug('1. 研究意义（上）') === '1-研究意义上', T.headingSlug('1. 研究意义（上）'))
check('repeated spaces collapse', T.headingSlug('a   b') === 'a-b', T.headingSlug('a   b'))
check('leading and trailing dashes are trimmed', T.headingSlug('  -x-  ') === 'x', T.headingSlug('  -x-  '))
check('an empty heading has no slug', T.headingSlug('   ') === '', T.headingSlug('   '))
check('code ticks are dropped', T.headingSlug('`code` 段') === 'code-段', T.headingSlug('`code` 段'))

// ---- anchor map ----
const blocks = T.parseBlocks('# 一\n\n## 二甲\n\n## 二甲\n\n# 三\n')
const anchors = T.headingAnchors(blocks)
check('every heading gets a slug', anchors.size === 4, [...anchors.keys()])
check('duplicates are numbered', anchors.has('二甲') && anchors.has('二甲-1'), [...anchors.keys()])
check('the anchor points at the block offset', anchors.get('一') === 0, anchors.get('一'))
check('later headings point further down', anchors.get('三') > anchors.get('二甲'), [anchors.get('二甲'), anchors.get('三')])

// ---- rendering ----
const rendered = T.renderBlocks(blocks, { headings: blocks.filter((b) => b.type === 'heading') })
const ids = []
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  if (n.props.id !== undefined) ids.push(n.props.id)
  n.children.forEach(walk)
}
walk(rendered)
check('headings render with anchor ids', ids.includes('dcw-h-一') && ids.includes('dcw-h-三'), ids)

// an internal link resolves and calls back instead of opening a tab
let jumped = null
const linkBlocks = T.parseBlocks('[去第三节](#三)\n')
const linkTree = T.renderBlocks(linkBlocks, { anchors, onAnchor: (from) => { jumped = from } })
const anchorsFound = []
const walk2 = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk2); return }
  if (typeof n !== 'object') return
  if (n.type === 'a') anchorsFound.push(n)
  n.children.forEach(walk2)
}
walk2(linkTree)
check('the internal link renders as an anchor', anchorsFound.length === 1, anchorsFound.length)
check('it does not open the link in a new tab', anchorsFound[0].props.target === undefined, anchorsFound[0].props.target)
anchorsFound[0].props.onClick({ preventDefault() {} })
check('clicking it jumps to the heading', jumped === anchors.get('三'), jumped)

const external = T.renderBlocks(T.parseBlocks('[站外](https://a.com)'), { anchors })
const ext = []
const walk3 = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk3); return }
  if (typeof n !== 'object') return
  if (n.type === 'a') ext.push(n)
  n.children.forEach(walk3)
}
walk3(external)
check('an external link still opens in a new tab', ext[0].props.target === '_blank', ext[0].props.target)

// unknown hash stays a plain link
const unknown = T.renderBlocks(T.parseBlocks('[缺](#不存在)'), { anchors })
const missing = []
const walk4 = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk4); return }
  if (typeof n !== 'object') return
  if (n.type === 'a') missing.push(n)
  n.children.forEach(walk4)
}
walk4(unknown)
check('a hash with no target keeps default behaviour', missing[0].props.target === '_blank', missing[0].props.target)

// ---- selection counting ----
check('an empty selection reads as empty', T.countFor('words', '') === 0, null)
const sel = '影调映射'
check('a CJK selection counts per character', T.countFor('words', sel) === 4, T.countFor('words', sel))

const DOC = '# 标题\n\n选中我\n'
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
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    return {}
  },
}
const t = (k, vars) => (vars === undefined ? k : `${k}${JSON.stringify(vars)}`)
const props = {
  t, api,
  useSessions: (sel2) => sel2({ byId: { s1: { cwd: '/w' } } }),
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
const editor = byClass('dcw-editor')[0] ?? byClass('dcw-live-input')[0]
check('the source editor is present', editor !== undefined, byClass('dcw-editor').length)
editor.props.onSelect({ target: { value: DOC, selectionStart: 4, selectionEnd: 7 } })
tree = harness2.render(body, props)
const footer = collect(tree).find((n) => typeof n.props.className === 'string' && n.props.className.includes('dcw-foot-count'))
check('the footer shows the selection', String(footer.children.join('')).includes(' / '), String(footer.children.join('')))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
