import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- the counting rule ----
check('empty text counts zero', T.countWords('') === 0, T.countWords(''))
check('whitespace counts zero', T.countWords('   \n\t ') === 0, T.countWords('   \n\t '))
check('each CJK character counts once', T.countWords('影调映射') === 4, T.countWords('影调映射'))
check('kana counts per character', T.countWords('テスト') === 3, T.countWords('テスト'))
// The reference counter's ideograph range stops at U+ABFF, so hangul
// syllables fall through to token counting.
check('hangul stays one token', T.countWords('한글') === 1, T.countWords('한글'))
check('latin words count per token', T.countWords('tone mapping') === 2, T.countWords('tone mapping'))
check('a contraction stays one token', T.countWords("don't stop") === 2, T.countWords("don't stop"))
check('standalone punctuation does not count', T.countWords('a , b') === 2, T.countWords('a , b'))
check('mixed scripts add up', T.countWords('影调 mapping 曲线') === 5, T.countWords('影调 mapping 曲线'))

check('char counting is raw length', T.countFor('chars', '影调') === 2, T.countFor('chars', '影调'))
check('line counting uses newlines', T.countFor('lines', 'a\nb\nc') === 3, T.countFor('lines', 'a\nb\nc'))
const wpmText = Array.from({ length: 382 }, (_, i) => `w${i}`).join(' ')
check('minutes uses the reference reading speed', T.countFor('minutes', wpmText) === 1, T.countFor('minutes', wpmText))
check('zero words is zero minutes', T.countFor('minutes', '') === 0, T.countFor('minutes', ''))

// ---- the footer control ----
const DOC = '影调映射研究\n'
const storage = new Map([['dsh-cowrite:mode', 'preview']])
const harness2 = createHarness()
const mod2 = loadPlugin({ localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) } })('react')
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

const counter = () => byClass(tree, 'dcw-foot-count')[0]
check('the footer counter starts on words', counter().children.join('') === 'foot.words{"n":6}', counter().children.join(''))
counter().props.onClick()
tree = harness2.render(body, props)
check('clicking cycles to characters', counter().children.join('') === `foot.chars{"n":${DOC.length}}`, counter().children.join(''))
check('the choice is stored', storage.get('dsh-cowrite:count') === 'chars', storage.get('dsh-cowrite:count'))
counter().props.onClick()
tree = harness2.render(body, props)
check('the next step is lines', counter().children.join('').startsWith('foot.lines'), counter().children.join(''))
counter().props.onClick()
tree = harness2.render(body, props)
check('minutes uses the short wording at zero', counter().children.join('') === 'foot.zeroMinutes', counter().children.join(''))
counter().props.onClick()
tree = harness2.render(body, props)
check('it wraps back to words', counter().children.join('').startsWith('foot.words'), counter().children.join(''))

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
