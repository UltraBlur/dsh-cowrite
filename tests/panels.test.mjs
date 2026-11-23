import fs from 'node:fs'

const CLIENT = new URL('../client.js', import.meta.url)
const code = fs.readFileSync(CLIENT, 'utf8')

function createHarness() {
  const hooks = []
  let cursor = 0
  let scheduled = false
  let pending = []
  const sameDeps = (a, b) => {
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false
    return true
  }
  const React = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    useState(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      const set = (next) => {
        const value = typeof next === 'function' ? next(hooks[index]) : next
        if (Object.is(value, hooks[index])) return
        hooks[index] = value
        scheduled = true
      }
      return [hooks[index], set]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = { current: initial }
      return hooks[index]
    },
    useCallback(fn) {
      cursor += 1
      return fn
    },
    useMemo(fn) {
      cursor += 1
      return fn()
    },
    useEffect(fn, deps) {
      const index = cursor++
      const previous = hooks[index]
      if (previous !== undefined && sameDeps(previous.deps, deps)) return
      pending.push({ index, fn, deps, previous })
    },
    useLayoutEffect(fn, deps) {
      const index = cursor++
      const previous = hooks[index]
      if (previous !== undefined && sameDeps(previous.deps, deps)) return
      pending.push({ index, fn, deps, previous, layout: true })
    },
  }
  return {
    React,
    get scheduled() {
      return scheduled
    },
    render(component, props) {
      let guard = 0
      do {
        cursor = 0
        pending = []
        scheduled = false
        const tree = component(props)
        pending.sort((a, b) => Number(b.layout ?? false) - Number(a.layout ?? false))
        for (const effect of pending) {
          if (effect.previous !== undefined && typeof effect.previous.cleanup === 'function') {
            effect.previous.cleanup()
          }
          const cleanup = effect.fn()
          hooks[effect.index] = { deps: effect.deps, cleanup }
        }
        guard += 1
        if (guard > 30) throw new Error('render loop did not settle')
      } while (scheduled)
      cursor = 0
      return component(props)
    },
  }
}

const DOC = [
  '# 标题',
  '',
  '第一段文字，含关键字。',
  '',
  '![图](pic.png)',
  '',
  '第二段文字，也有文字。',
  '',
  '- 项目一',
  '',
].join('\n')

const storage = new Map([['dsh-cowrite:mode', 'live']])
const windowStub = {
  __ModuleLoader__: { load(entry) { globalThis.__factory = entry.factory } },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
}
new Function('window', code)(windowStub)
const harness = createHarness()
const mod = globalThis.__factory((name) => (name === 'react' ? harness.React : null))

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}

const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const api = {
  async call(payload) {
    if (payload.action === 'list') return { root: ROOT, files: [{ path: 'sub/doc.md', size: DOC.length, mtimeMs: 1 }] }
    if (payload.action === 'read') return { path: 'sub/doc.md', content: DOC, size: DOC.length, mtimeMs: 1 }
    if (payload.action === 'stat') return { path: 'sub/doc.md', size: DOC.length, mtimeMs: 1 }
    if (payload.action === 'write') return { path: 'sub/doc.md', size: DOC.length, mtimeMs: 2 }
    return {}
  },
}

let body = null
const ctx = {
  locale: { bind: () => (key) => key, register: () => () => {} },
  slots: { inject: (n, cb) => { cb(); return () => {} }, register: (o, component) => { body = component; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  inject() {},
}
mod.apply(ctx)

const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const props = {
  t,
  api,
  useSessions: (selector) => selector({ byId: { s1: { cwd: ROOT } } }),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}

const collect = (node, out = []) => {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children) collect(child, out)
  return out
}
const byClass = (root, name) =>
  collect(root).filter((node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name))
const textOf = (node) => {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node !== 'object') return ''
  return node.children.map(textOf).join('')
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
let tree = harness.render(body, props)
const settle = async () => {
  for (let round = 0; round < 14; round += 1) {
    await tick()
    if (!harness.scheduled) {
      if (round > 3) return
      continue
    }
    tree = harness.render(body, props)
  }
}
const key = (event) => {
  const root = collect(tree).find((node) => node.props.className === 'dcw-root')
  const payload = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...event }
  root.props.onKeyDown(payload)
  return payload
}

await settle()
tree = harness.render(body, props)

// ------------------------------------------------------------------ images ----
const image = byClass(tree, 'dcw-md-img')[0]
check(
  'relative image resolves through the host raw route',
  image !== undefined &&
    typeof image.props.src === 'string' &&
    image.props.src.startsWith('/api/dsh-cowrite/raw?') &&
    decodeURIComponent(image.props.src).includes(`root=${ROOT}`) &&
    decodeURIComponent(image.props.src).includes('path=sub/pic.png'),
  image && image.props.src,
)

// -------------------------------------------------------------------- find ----
check('find bar is closed at first', byClass(tree, 'dcw-find').length === 0, byClass(tree, 'dcw-find').length)
key({ key: 'f', metaKey: true })
tree = harness.render(body, props)
check('Cmd+F opens the find bar', byClass(tree, 'dcw-find').length === 1, byClass(tree, 'dcw-find').length)

const findInput = byClass(tree, 'dcw-find-input')[0]
findInput.props.onChange({ target: { value: '文字' } })
tree = harness.render(body, props)
const marks = byClass(tree, 'dcw-mark')
check('matches are highlighted in the document', marks.length === 3, marks.map(textOf))
check('the first match is the active one', byClass(tree, 'dcw-mark-current').length === 1 && textOf(byClass(tree, 'dcw-mark-current')[0]) === '文字', byClass(tree, 'dcw-mark-current').length)
check('the counter reports the position', textOf(byClass(tree, 'dcw-find-count')[0]) === '1/3', textOf(byClass(tree, 'dcw-find-count')[0]))

key({ key: 'g', metaKey: true })
tree = harness.render(body, props)
check('Cmd+G advances to the next match', textOf(byClass(tree, 'dcw-find-count')[0]) === '2/3', textOf(byClass(tree, 'dcw-find-count')[0]))
key({ key: 'G', metaKey: true, shiftKey: true })
tree = harness.render(body, props)
check('Cmd+Shift+G goes back', textOf(byClass(tree, 'dcw-find-count')[0]) === '1/3', textOf(byClass(tree, 'dcw-find-count')[0]))

findInput.props.onChange({ target: { value: '不存在的词' } })
tree = harness.render(body, props)
check('a miss reports no matches', textOf(byClass(tree, 'dcw-find-count')[0]) === 'find.none', textOf(byClass(tree, 'dcw-find-count')[0]))

key({ key: 'Escape' })
tree = harness.render(body, props)
check('Escape closes the find bar', byClass(tree, 'dcw-find').length === 0, byClass(tree, 'dcw-find').length)

// ----------------------------------------------------------------- outline ----
const outlineButton = byClass(tree, 'dcw-seg').find((node) => textOf(node) === '▤')
check('outline button exists', outlineButton !== undefined, byClass(tree, 'dcw-seg').map(textOf))
outlineButton.props.onClick()
tree = harness.render(body, props)
const items = byClass(tree, 'dcw-outline-item')
check('outline lists the document headings', items.length === 1 && textOf(items[0]) === '标题', items.map(textOf))
items[0].props.onClick()
tree = harness.render(body, props)
check('picking an outline entry closes the popover', byClass(tree, 'dcw-outline').length === 0, byClass(tree, 'dcw-outline').length)

// ------------------------------------------------------------- focus mode ----
const block = byClass(tree, 'dcw-live-block').find((node) => textOf(node).includes('第一段文字'))
block.props.onClick({ target: { closest: () => null } })
tree = harness.render(body, props)
check('a block opens for editing before focus mode', byClass(tree, 'dcw-live-input').length === 1, byClass(tree, 'dcw-live-input').length)
check('blocks are not dimmed while focus mode is off', byClass(tree, 'dcw-live-block').every((node) => node.props['data-dim'] === 'false'), null)

const focusButton = byClass(tree, 'dcw-seg').find((node) => textOf(node) === '◎')
focusButton.props.onClick()
tree = harness.render(body, props)
check(
  'focus mode dims every other block',
  byClass(tree, 'dcw-live-block').length > 0 && byClass(tree, 'dcw-live-block').every((node) => node.props['data-dim'] === 'true'),
  byClass(tree, 'dcw-live-block').map((node) => node.props['data-dim']),
)
check('the edited block stays a textarea, not a dimmed block', byClass(tree, 'dcw-live-input').length === 1, byClass(tree, 'dcw-live-input').length)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
