import fs from 'node:fs'

const CLIENT = new URL('../client.js', import.meta.url)
const code = fs.readFileSync(CLIENT, 'utf8')

/**
 * A miniature React: real hook state, dep-aware effects and a render loop.
 * Enough to drive the plugin's interactions without a DOM.
 */
function createHarness() {
  const hooks = []
  let cursor = 0
  let scheduled = false
  let pending = []

  const sameDeps = (a, b) => {
    if (!a || !b || a.length !== b.length) return false
    for (let index = 0; index < a.length; index += 1) if (!Object.is(a[index], b[index])) return false
    return true
  }

  const React = {
    Fragment: 'Fragment',
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity) }
    },
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

// ---------------------------------------------------------------- fixtures ----
const DOC = '# 标题\n\n第一段文字。\n\n- 项目一\n- 项目二\n'
const calls = []
let diskContent = DOC
const api = {
  async call(payload) {
    calls.push(payload)
    if (payload.action === 'list') {
      return { root: '/ws', files: [{ path: 'doc.md', size: DOC.length, mtimeMs: 1 }], truncated: false }
    }
    if (payload.action === 'read') return { path: 'doc.md', content: diskContent, size: diskContent.length, mtimeMs: 1 }
    if (payload.action === 'write') {
      diskContent = payload.content
      return { path: 'doc.md', size: diskContent.length, mtimeMs: 2 }
    }
    if (payload.action === 'stat') return { path: 'doc.md', size: diskContent.length, mtimeMs: 1 }
    return {}
  },
}

let body = null
const ctx = {
  locale: { bind: () => (key) => key, register: () => () => {} },
  slots: { inject: (name, callback) => { callback(); return () => {} }, register: (options, component) => { body = component; return () => {} } },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { commandTarget: () => undefined, openTabFromTarget() {} },
  effect(fn) { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
  inject() {},
}
mod.apply(ctx)
check('slot body registered', typeof body === 'function', typeof body)

const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const props = {
  t,
  api,
  useSessions: (selector) => selector({ byId: { s1: { cwd: '/ws' } } }),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const settle = async () => {
  for (let round = 0; round < 12; round += 1) {
    await tick()
    if (!harness.scheduled) {
      if (round > 3) return
      continue
    }
    tree = harness.render(body, props)
  }
}

// ------------------------------------------------------------- collection ----
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
const byClass = (root, className) =>
  collect(root).filter((node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(className))
const textOf = (node) => {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node !== 'object') return ''
  return node.children.map(textOf).join('')
}
const clickables = (root) => byClass(root, 'dcw-live-block')
const inputOf = (root) => byClass(root, 'dcw-live-input')[0] ?? null
const footerText = (root) => textOf(byClass(root, 'dcw-foot-state')[0] ?? null)

// ------------------------------------------------------------------ live ----
let tree = harness.render(body, props)
await settle()
tree = harness.render(body, props)

check('live view renders every block when nothing is focused', clickables(tree).length >= 3, clickables(tree).length)
check('no block editor is open at first', inputOf(tree) === null, inputOf(tree) !== null)
check('document heading is rendered', byClass(tree, 'dcw-md-h1').length === 1, byClass(tree, 'dcw-md-h1').length)
check('live container is marked', byClass(tree, 'dcw-live').length === 1, byClass(tree, 'dcw-live').length)

// Click the paragraph (second non-blank block) to edit it.
const paragraphBlock = clickables(tree).find((node) => textOf(node).includes('第一段文字'))
check('paragraph block is clickable', paragraphBlock !== undefined, clickables(tree).map(textOf))
paragraphBlock.props.onClick({ target: { closest: () => null } })
tree = harness.render(body, props)

const input = inputOf(tree)
check('clicking a block opens its source in an editor', input !== null && input.props.value === '第一段文字。', input && input.props.value)
check('the edited block is replaced by the editor', clickables(tree).every((node) => !textOf(node).includes('第一段文字')), clickables(tree).map(textOf))
check('other blocks keep rendering', clickables(tree).length >= 2, clickables(tree).length)

// Typing commits into the buffer immediately.
input.props.onChange({ target: { value: '第一段文字，改过。', selectionStart: 8 } })
tree = harness.render(body, props)
check('typing updates the editor value', inputOf(tree).props.value === '第一段文字，改过。', inputOf(tree).props.value)
check('typing marks the document dirty', footerText(tree) === 'state.dirty', footerText(tree))

// Enter inside a paragraph splits into two blocks.
inputOf(tree).props.onKeyDown({
  key: 'Enter',
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  preventDefault() {},
  target: { selectionStart: '第一段文字，改过。'.length },
})
tree = harness.render(body, props)
check('Enter splits the paragraph and moves the caret to a new block', inputOf(tree).props.value === '', inputOf(tree).props.value)
check('the split left both halves in the buffer', (() => {
  const writeCall = calls.filter((call) => call.action === 'write').at(-1)
  const pending = writeCall ? writeCall.content : null
  return pending === null || pending.includes('第一段文字，改过。\n\n')
})(), calls.filter((call) => call.action === 'write').length)

// Autosave fires after the quiet period.
await new Promise((resolve) => setTimeout(resolve, 900))
const writes = calls.filter((call) => call.action === 'write')
check('autosave wrote the buffer to disk', writes.length === 1 && writes[0].content.includes('第一段文字，改过。\n\n'), writes.length)

// Escape leaves the editor.
tree = harness.render(body, props)
inputOf(tree).props.onKeyDown({ key: 'Escape', preventDefault() {}, target: { selectionStart: 0 } })
tree = harness.render(body, props)
check('Escape closes the block editor', inputOf(tree) === null, inputOf(tree) !== null)

// A list item continues its marker on Enter.
const listBlock = clickables(tree).find((node) => textOf(node).includes('项目一'))
listBlock.props.onClick({ target: { closest: () => null } })
tree = harness.render(body, props)
const listInput = inputOf(tree)
check('list block opens with its markers', listInput.props.value === '- 项目一\n- 项目二', listInput.props.value)
listInput.props.onKeyDown({
  key: 'Enter',
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  preventDefault() {},
  target: { selectionStart: '- 项目一'.length },
})
tree = harness.render(body, props)
check('Enter in a list continues the marker', inputOf(tree).props.value === '- 项目一\n- \n- 项目二', inputOf(tree).props.value)

// Backspace at offset 0 merges into the previous block.
inputOf(tree).props.onKeyDown({ key: 'Backspace', preventDefault() {}, target: { selectionStart: 0 } })
tree = harness.render(body, props)
check(
  'Backspace at the block start merges upward',
  inputOf(tree).props.value.startsWith('第一段文字，改过。'),
  inputOf(tree).props.value,
)

// Arrow navigation between blocks.
const merged = inputOf(tree).props.value
inputOf(tree).props.onKeyDown({ key: 'ArrowUp', preventDefault() {}, target: { selectionStart: 0 } })
tree = harness.render(body, props)
// The editor holds raw source, so a heading keeps its markers (as in Typora).
check('ArrowUp at the first line jumps to the previous block', inputOf(tree).props.value === '# 标题', inputOf(tree).props.value)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
