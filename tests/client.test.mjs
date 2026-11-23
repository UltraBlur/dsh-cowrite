import fs from 'node:fs'

const CLIENT = new URL('../client.js', import.meta.url)
const code = fs.readFileSync(CLIENT, 'utf8')

// Minimal React stand-in: one render pass, refs and callbacks as themselves.
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
new Function('window', code)({
  __ModuleLoader__: {
    load(entry) {
      factory = entry.factory
    },
  },
})
if (factory === null) throw new Error('client.js did not call __ModuleLoader__.load')

const module = factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require("${name}")`)
})

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}

check('module declares service injection', Array.isArray(module.inject) && module.inject.includes('sidebarRightTabs'), module.inject)

// ---- apply() wiring ----
let tabDefinition = null
let slotRegistration = null
let slotComponent = null
let localeRegistration = null
let shortcutRegistration = null
const fakeShortcuts = {
  register(definition) {
    shortcutRegistration = definition
    return () => {}
  },
}

const ctx = {
  locale: {
    bind: () => (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`),
    register(namespace, dicts) {
      localeRegistration = { namespace, dicts }
      return () => {}
    },
  },
  slots: {
    inject(slotName, callback) {
      callback()
      return () => {}
    },
    register(options, component) {
      slotRegistration = options
      slotComponent = component
      return () => {}
    },
  },
  sidebarRightTabs: {
    register(definition) {
      tabDefinition = definition
      return () => {}
    },
  },
  sidebarRight: {
    commandTarget: () => ({ sessionId: 's1', paneId: 'p1', host: 'dock' }),
    openTabFromTarget: (kind) => {
      ctx.opened = kind
    },
  },
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
  inject(deps, callback) {
    if (deps.includes('shortcuts')) callback({ shortcuts: fakeShortcuts, effect: ctx.effect })
  },
}

try {
  module.apply(ctx)
  check('apply() ran without throwing', true)
} catch (error) {
  check('apply() ran without throwing', false, String(error && error.stack))
}

check('locale dictionaries registered', localeRegistration?.namespace === 'cowrite' && !!localeRegistration.dicts.zh['tab.title'], localeRegistration?.namespace)
check('tab type registered', tabDefinition?.id === 'dsh-cowrite' && tabDefinition?.kind === 'dsh-cowrite', tabDefinition?.id)
check('tab type is keep-mounted and titled', tabDefinition?.keepMounted === true && tabDefinition.title() === 'tab.title', {
  keepMounted: tabDefinition?.keepMounted,
  title: tabDefinition && typeof tabDefinition.title === 'function' ? tabDefinition.title() : null,
})
check(
  'guide card carries icon, title, description and command',
  tabDefinition?.guide?.length === 1 &&
    typeof tabDefinition.guide[0].title() === 'string' &&
    typeof tabDefinition.guide[0].description() === 'string' &&
    typeof tabDefinition.guide[0].icon === 'function' &&
    tabDefinition.guide[0].commandId === 'cowrite.open',
  tabDefinition?.guide,
)
check(
  'body registered under the tab kind with a locale namespace',
  slotRegistration?.name === 'sidebar.right.pane.tab' &&
    slotRegistration?.key === 'dsh-cowrite' &&
    slotRegistration?.locale === 'cowrite',
  slotRegistration,
)
check('body receives its api through inject', typeof slotRegistration?.inject === 'function' && typeof slotRegistration.inject().api.call === 'function', null)
check(
  'shortcut registered with a resolve that opens the tab',
  (() => {
    if (shortcutRegistration?.id !== 'cowrite.open') return false
    if (typeof shortcutRegistration.resolve !== 'function') return false
    const outcome = shortcutRegistration.resolve({ target: undefined })
    if (outcome.status !== 'handled') return false
    outcome.run()
    return ctx.opened === 'dsh-cowrite'
  })(),
  { id: shortcutRegistration?.id, opened: ctx.opened },
)
check(
  'shortcut blocks politely without a session',
  (() => {
    ctx.sidebarRight.commandTarget = () => undefined
    const outcome = shortcutRegistration.resolve({ target: undefined })
    return outcome.status === 'blocked' && typeof outcome.reason === 'string'
  })(),
  null,
)

// ---- component render ----
const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const collect = (node, out) => {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.text.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out)
    return out
  }
  const className = node.props && node.props.className
  if (typeof className === 'string') out.classes.push(className)
  if (node.props && node.props['data-cowrite']) out.markers.push(node.props['data-cowrite'])
  for (const child of node.children) collect(child, out)
  return out
}
const shape = (node) => {
  const out = { text: [], classes: [], markers: [] }
  collect(node, out)
  return out
}

const baseProps = {
  t,
  api: { call: async () => ({ files: [], root: '/ws' }) },
  useSessions: (selector) => selector({ byId: { s1: { cwd: '/ws' } } }),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
}

try {
  const tree = slotComponent(baseProps)
  const seen = shape(tree)
  check('body renders the ready shell', seen.markers.includes('ready'), seen.markers)
  check('body renders the file picker and toolbar', seen.classes.includes('dcw-select') && seen.classes.includes('dcw-bar'), seen.classes)
  check('empty state explains that no documents were found', seen.text.includes('empty.noFiles'), seen.text)
  check('footer is present', seen.classes.includes('dcw-foot'), seen.classes)
} catch (error) {
  check('body renders without a session cwd', false, String(error && error.stack))
}

try {
  const tree = slotComponent({ ...baseProps, useSessions: (selector) => selector({ byId: {} }) })
  const seen = shape(tree)
  check('no working directory renders its own notice', seen.text.includes('empty.noWorkspace'), seen.text)
} catch (error) {
  check('no working directory renders its own notice', false, String(error && error.stack))
}

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
