import fs from 'node:fs'

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory = null
const React = {
  Fragment: 'Fragment',
  createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat(Infinity) } },
  useState(v) { return [typeof v === 'function' ? v() : v, () => {}] },
  useRef(v) { return { current: v } },
  useCallback(fn) { return fn },
  useMemo(fn) { return fn() },
  useEffect() {},
}
new Function('window', code)({ __ModuleLoader__: { load(e) { factory = e.factory } } })
const mod = factory((n) => (n === 'react' ? React : null))
const T = mod.__test

const ROOT = process.env.COWRITE_TEST_ROOT
if (ROOT === undefined) {
  // This suite drives the live route, so it needs a workspace DSH will serve.
  console.log('SKIP realdoc: set COWRITE_TEST_ROOT to a workspace DSH accepts')
  process.exit(0)
}

const post = async (payload) => {
  const res = await fetch(`${process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'}/api/dsh-cowrite`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ sessionId: 'probe', root: ROOT, ...payload }),
  })
  return res.json()
}
// The thesis file gets renamed; take the newest markdown at the workspace root.
const listing = await post({ action: 'list' })
if (!listing.ok) throw new Error(JSON.stringify(listing))
const newest = listing.data.files
  .filter((file) => !file.path.includes('/') && /^开题/.test(file.path))
  .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
if (newest === undefined) throw new Error('no thesis file found')
console.log('doc:', newest.path)
const envelope = await post({ action: 'read', path: newest.path })
if (!envelope.ok) throw new Error(JSON.stringify(envelope))
const doc = envelope.data.content

const started = Date.now()
const blocks = T.parseBlocks(doc)
const elapsed = Date.now() - started
const counts = {}
for (const block of blocks) counts[block.type] = (counts[block.type] ?? 0) + 1

const rebuilt = blocks.map((b) => doc.slice(b.from, b.to)).join('')
const headings = blocks.filter((b) => b.type === 'heading').map((b) => `${'#'.repeat(b.level)} ${b.value}`)

console.log('chars', doc.length, 'blocks', blocks.length, 'parse ms', elapsed)
console.log('counts', counts)
console.log('lossless', rebuilt === doc)
console.log('headings:')
for (const heading of headings) console.log('  ', heading)

const tree = T.renderBlocks(blocks)
let nodes = 0
const walk = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (typeof n !== 'object') return
  nodes += 1
  n.children.forEach(walk)
}
walk(tree)
console.log('rendered nodes', nodes)


// Every table cell's recorded offsets must slice the real cell text.
const tables = blocks.filter((b) => b.type === 'table')
let cellsChecked = 0
let cellsBroken = 0
for (const table of tables) {
  for (const row of table.rowMeta ?? []) {
    for (const cell of row.cells) {
      if (cell.text === '') continue
      cellsChecked += 1
      if (doc.slice(row.from + cell.from, row.from + cell.to) !== cell.text) cellsBroken += 1
    }
  }
}
console.log('tables', tables.length, 'cells checked', cellsChecked, 'broken', cellsBroken)

const ok = rebuilt === doc && blocks.length > 10 && counts.heading >= 5 && elapsed < 200
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
