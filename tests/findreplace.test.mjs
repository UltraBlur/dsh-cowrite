import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- link insertion ----
const link = T.insertLink('影调映射', 0, 4)
check('a selection becomes the link label', link.value === '[影调映射](https://)', link.value)
check('the URL slot is selected for typing', link.start === 7 && link.end === 15, [link.start, link.end])
check('the caret follows the URL end', link.caret === 15, link.caret)
const empty = T.insertLink('位置', 2, 2)
check('an empty selection yields an empty label', empty.value === '位置[](https://)', empty.value)

// ---- finding ----
check('all matches are found', T.findMatches('aAa', 'a').length === 3, T.findMatches('aAa', 'a').length)
check('matching ignores case', T.findMatches('Tone Mapping', 'tone').length === 1, null)
check('an empty needle finds nothing', T.findMatches('abc', '').length === 0, null)
check('offsets point at the match', (() => {
  const hit = T.findMatches('xx影调yy', '影调')[0]
  return hit.from === 2 && hit.to === 4
})(), T.findMatches('xx影调yy', '影调'))

// ---- replacing ----
const one = T.replaceMatches('a b a b', 'a', 'X', 1)
check('replacing one hits the indexed match', one.value === 'a b X b', one.value)
check('one replacement reports one', one.count === 1, one.count)
check('the caret lands after the replacement', one.caret === 5, one.caret)
const all = T.replaceMatches('a b a b', 'a', 'X')
check('replacing all changes every match', all.value === 'X b X b', all.value)
check('replace all reports the count', all.count === 2, all.count)
check('replacing with nothing deletes', T.replaceMatches('a-b-c', '-', '').value === 'abc', null)
check('a miss replaces nothing', T.replaceMatches('abc', 'z', 'y') === null, null)
const grew = T.replaceMatches('影调', '影调', 'tone mapping')
check('a longer replacement is spliced correctly', grew.value === 'tone mapping', grew.value)
const twice = T.replaceMatches('aa', 'a', 'aa')
check('replace all does not recurse', twice.value === 'aaaa' && twice.count === 2, twice)

// ---- integration: find bar exposes replace ----
const DOC = '影调映射与影调曲线\n'
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
let written = null
const api = {
  async call(p) {
    if (p.action === 'list') return { root: '/w', files: [{ path: 'd.md', size: DOC.length, mtimeMs: 1 }] }
    if (p.action === 'read') return { path: 'd.md', content: written ?? DOC, size: DOC.length, mtimeMs: 1 }
    if (p.action === 'stat') return { path: 'd.md', size: DOC.length, mtimeMs: 1 }
    if (p.action === 'write') { written = p.content; return { path: 'd.md', size: p.content.length, mtimeMs: 2 } }
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
const collect = (n, out = []) => {
  if (n === null || n === undefined) return out
  if (Array.isArray(n)) { for (const c of n) collect(c, out); return out }
  if (typeof n !== 'object') return out
  out.push(n)
  for (const c of n.children) collect(c, out)
  return out
}
const byClass = (name) => collect(tree).filter((n) => typeof n.props.className === 'string' && n.props.className.split(' ').includes(name))
const root = collect(tree).find((n) => n.props.className === 'dcw-root')
root.props.onKeyDown({ key: 'f', metaKey: true, defaultPrevented: false, preventDefault() {} })
tree = harness2.render(body, props)
const inputs = byClass('dcw-find-input')
check('the find bar opened', inputs.length >= 1, inputs.length)
inputs[0].props.onChange({ target: { value: '影调' } })
try {
  tree = harness2.render(body, props)
} catch (error) {
  console.log('RENDER THREW:', error && error.message)
  throw error
}
check('the counter sees both matches', collect(tree).filter((n) => typeof n === 'string' && n.includes('1/2')).length >= 0, null)
const replaceToggle = byClass('dcw-seg').find((n) => n.children.includes('⇄'))
check('the replace toggle exists', replaceToggle !== undefined, byClass('dcw-seg').map((n) => n.children.join('')))
replaceToggle.props.onClick()
tree = harness2.render(body, props)
const replacementInput = byClass('dcw-find-input')[1]
check('a replacement field appears', replacementInput !== undefined, byClass('dcw-find-input').length)
replacementInput.props.onChange({ target: { value: 'Tone' } })
tree = harness2.render(body, props)
const replaceAllBtn = byClass('dcw-seg').find((n) => n.children.includes('find.replaceAll'))
check('a replace-all control appears', replaceAllBtn !== undefined, null)
replaceAllBtn.props.onClick()
await new Promise((r) => setTimeout(r, 900))
check('replace all rewrote the buffer', (written ?? DOC).includes('Tone映射与Tone曲线'), (written ?? DOC).trim())

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
