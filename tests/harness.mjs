import fs from 'node:fs'

export const CLIENT = new URL('../client.js', import.meta.url)

export function loadPlugin(windowStub) {
  const code = fs.readFileSync(CLIENT, 'utf8')
  let factory = null
  new Function('window', code)({ ...windowStub, __ModuleLoader__: { load(entry) { factory = entry.factory } } })
  return (requireName) => factory((name) => (name === requireName ? globalThis.__react : null))
}

export function createHarness(React) {
  const hooks = []
  let cursor = 0
  let scheduled = false
  let pending = []
  const sameDeps = (a, b) => {
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false
    return true
  }
  const api = {
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
    useCallback(fn) { cursor += 1; return fn },
    useMemo(fn) { cursor += 1; return fn() },
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
  globalThis.__react = api
  return {
    React: api,
    get scheduled() { return scheduled },
    render(component, props) {
      let guard = 0
      do {
        cursor = 0
        pending = []
        scheduled = false
        component(props)
        pending.sort((a, b) => Number(b.layout ?? false) - Number(a.layout ?? false))
        for (const effect of pending) {
          if (effect.previous !== undefined && typeof effect.previous.cleanup === 'function') effect.previous.cleanup()
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

export const collect = (node, out = []) => {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) { for (const child of node) collect(child, out); return out }
  if (typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children) collect(child, out)
  return out
}
export const byClass = (root, name) =>
  collect(root).filter((node) => typeof node.props.className === 'string' && node.props.className.split(' ').includes(name))
export const textOf = (node) => {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node !== 'object') return ''
  return node.children.map(textOf).join('')
}
