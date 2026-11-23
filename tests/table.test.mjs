import { createHarness, loadPlugin, byClass, textOf } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}

const storage = new Map([['dsh-cowrite:mode', 'live']])
// A controllable selection: the click handler reads window.getSelection().
let selection = null
const windowStub = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
  getSelection: () => selection,
}
const harness = createHarness()
const mod = loadPlugin(windowStub)(  'react')
const T = mod.__test

// ------------------------------------------------------------- unit: wrap ----
const wrapInsert = T.applyFormatting('abcd', 2, 2, '**')
check('formatting without a selection inserts a pair and centres the caret', wrapInsert.value === 'ab****cd' && wrapInsert.caret === 4, wrapInsert)
const wrapSelection = T.applyFormatting('abcd', 1, 3, '**')
check('formatting wraps the selection', wrapSelection.value === 'a**bc**d' && wrapSelection.caret === 7, wrapSelection)
const wrapClamp = T.applyFormatting('abc', 99, 99, '*')
check('formatting clamps an out-of-range caret', wrapClamp.value === 'abc**' && wrapClamp.caret === 4, wrapClamp)

// ------------------------------------------------------- unit: cell offsets ----
const cells = T.splitTableRowCells('| 列A | 列B |')
check('cells keep their text and offsets', cells.length === 2 && cells[0].text === '列A' && cells[1].text === '列B', cells)
check(
  'cell offsets point at the cell text',
  cells[0].from === 2 && cells[0].to === 4 && cells[1].from === 7 && cells[1].to === 9,
  cells.map((c) => [c.from, c.to]),
)

const TABLE_DOC = '前文\n\n| 甲 | 乙 |\n| --- | --- |\n| 11 | 22 |\n\n后文\n'
const tableBlocks = T.parseBlocks(TABLE_DOC)
const tableBlock = tableBlocks.find((b) => b.type === 'table')
check('table block carries row metadata', tableBlock !== undefined && tableBlock.rowMeta.length === 2, tableBlock && tableBlock.rowMeta.length)
check(
  'row metadata offsets slice the real cells',
  tableBlock.rowMeta.every((row) =>
    row.cells.every((cell) => TABLE_DOC.slice(row.from + cell.from, row.from + cell.to) === cell.text),
  ),
  tableBlock.rowMeta,
)
check(
  'table offsets are inside the block source range',
  tableBlock.rowMeta.every((row) =>
    row.cells.every((cell) => row.from + cell.from >= tableBlock.from && row.from + cell.to <= tableBlock.to),
  ),
  tableBlock.rowMeta,
)

// ------------------------------------------------------- integration: table ----
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

const api = {
  async call(payload) {
    if (payload.action === 'list') return { root: '/ws', files: [{ path: 'doc.md', size: TABLE_DOC.length, mtimeMs: 1 }] }
    if (payload.action === 'read') return { path: 'doc.md', content: TABLE_DOC, size: TABLE_DOC.length, mtimeMs: 1 }
    if (payload.action === 'stat') return { path: 'doc.md', size: TABLE_DOC.length, mtimeMs: 1 }
    if (payload.action === 'write') return { path: 'doc.md', size: TABLE_DOC.length, mtimeMs: 2 }
    return {}
  },
}
const t = (key, vars) => (vars === undefined ? key : `${key}${JSON.stringify(vars)}`)
const props = {
  t,
  api,
  useSessions: (selector) => selector({ byId: { s1: { cwd: '/ws' } } }),
  useTabInfo: () => ({ tab: { id: 'tab-1', kind: 'dsh-cowrite', signal: { aborted: false }, actions: {} } }),
  sessionId: 's1',
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
const rerender = () => {
  tree = harness.render(body, props)
}
const input = () => byClass(tree, 'dcw-live-input')[0] ?? null

await settle()
rerender()

const tableNode = byClass(tree, 'dcw-live-block').find((node) => textOf(node).includes('甲'))
check('the table renders as one live block', tableNode !== undefined, byClass(tree, 'dcw-live-block').map(textOf))

// Click the second body cell: the caret must land inside that cell.
const row = tableBlock.rowMeta[1]
const cellBase = (row.cells[1].from + row.from) - tableBlock.from
selection = {
  anchorNode: { nodeType: 3, parentElement: { closest: () => ({ getAttribute: (name) => (name === 'data-dcw-f' ? String(cellBase) : null) }) } },
  anchorOffset: 0,
}
tableNode.props.onClick({ target: { closest: (name) => (name === 'a' ? null : null) } })
rerender()
check('clicking a cell opens the table block', input() !== null, input() !== null)
check('the caret lands on the clicked cell', input().props['data-dcw-caret'] === String(cellBase), {
  got: input().props['data-dcw-caret'],
  want: cellBase,
})

// Tab walks to the next cell.
input().props.onKeyDown({ key: 'Tab', preventDefault() {}, target: { selectionStart: cellBase, selectionEnd: cellBase } })
rerender()
const firstCell = (tableBlock.rowMeta[0].cells[0].from + tableBlock.rowMeta[0].from) - tableBlock.from
check('Tab wraps to the first cell after the last', input().props['data-dcw-caret'] === String(firstCell), {
  got: input().props['data-dcw-caret'],
  want: firstCell,
})

// Formatting shortcut inside the block editor.
input().props.onKeyDown({
  key: 'b',
  metaKey: true,
  preventDefault() {},
  target: { selectionStart: 0, selectionEnd: 0 },
})
rerender()
check('Cmd+B inserts a bold marker pair', input().props.value.startsWith('****'), input().props.value.slice(0, 12))
check('the caret sits between the markers', input().props['data-dcw-caret'] === '2', input().props['data-dcw-caret'])


// ------------------------------------------------- unit: structural edits ----
const RAW = '| 甲 | 乙 |\n| --- | --- |\n| 11 | 22 |'
const caretInBody = RAW.indexOf('11') + 1

const addRow = T.tableOperation(RAW, caretInBody, 'row-after')
check('adding a row inserts an empty row after the caret row', addRow !== null && addRow.value.split('\n').length === 4, addRow && addRow.value.split('\n'))
check('the inserted row has the right cell count', addRow.value.split('\n')[3] === '|  |  |', addRow.value.split('\n')[3])
const caretLine = (text, at) => text.slice(0, at).split('\n').length - 1
check('the caret lands in the new row', caretLine(addRow.value, addRow.caret) === 3, caretLine(addRow.value, addRow.caret))

const addColumn = T.tableOperation(RAW, caretInBody, 'col-after')
check('adding a column widens every row', addColumn.value.split('\n').every((line) => line.split('|').length === 5), addColumn.value.split('\n'))
check('the new delimiter cell is dashes', addColumn.value.split('\n')[1].includes('--- | --- | ---'), addColumn.value.split('\n')[1])

const deleteRow = T.tableOperation(RAW, caretInBody, 'row-delete')
check('deleting a row drops exactly that line', deleteRow.value.split('\n').length === 2 && !deleteRow.value.includes('11'), deleteRow.value.split('\n'))

const deleteColumn = T.tableOperation(RAW, caretInBody, 'col-delete')
check('deleting a column narrows every row', deleteColumn.value.split('\n').every((line) => line.split('|').length === 3), deleteColumn.value.split('\n'))

const tiny = '| only |\n| --- |'
check('the last column cannot be deleted', T.tableOperation(tiny, 2, 'col-delete') === null, T.tableOperation(tiny, 2, 'col-delete'))
const tinyRow = '| a |\n| --- |'
check('refuses to delete the row that would leave only the delimiter', T.tableOperation(tinyRow, 2, 'row-delete') === null, T.tableOperation(tinyRow, 2, 'row-delete'))

// ---- inserting before the caret's row or column ----
const above = T.tableOperation(RAW, caretInBody, 'row-before')
const aboveLines = above.value.split('\n')
check('inserting above pushes the caret row down', aboveLines[2] === '|  |  |' && aboveLines[3] === '| 11 | 22 |', aboveLines)
check('the caret lands in the inserted row', caretLine(above.value, above.caret) === 2, caretLine(above.value, above.caret))

const left = T.tableOperation(RAW, caretInBody, 'col-before')
check('inserting on the left widens every row', left.value.split('\n').every((line) => line.split('|').length === 5), left.value.split('\n'))
check('the delimiter keeps a valid cell in the new column', left.value.split('\n')[1].split('|')[2].trim() === '---', left.value.split('\n')[1])

const ALIGNED = '| a | b |\n| :-- | --: |\n| 1 | 2 |'
const alignedLeft = T.tableOperation(ALIGNED, ALIGNED.indexOf('2'), 'col-before')
const alignedDelimiter = alignedLeft.value.split('\n')[1]
check('an aligned neighbour is inherited by the new column', alignedDelimiter.includes(':--') && alignedDelimiter.split('|').length === 5, alignedDelimiter)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
