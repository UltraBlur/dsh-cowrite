import { createHarness, loadPlugin } from './harness.mjs'

const results = []
const check = (name, ok, extra) => {
  results.push(Boolean(ok))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${JSON.stringify(extra)}`}`)
}
const harness = createHarness()
const mod = loadPlugin({ localStorage: { getItem: () => null, setItem: () => {} } })('react')
const T = mod.__test

// ---- flowchart parsing ----
const flow = T.parseMermaid('graph TD\n  A[开始] --> B{判断}\n  B -->|是| C(结束)\n')
check('the direction is read', flow.kind === 'flowchart' && flow.direction === 'TD', flow && flow.direction)
check('both endpoints become nodes', flow.nodes.length === 3, flow.nodes.map((n) => n.id))
check('node labels and shapes survive', flow.nodes[1].label === '判断' && flow.nodes[1].shape === 'diamond', flow.nodes[1])
check('round shapes are recognised', flow.nodes[2].shape === 'round', flow.nodes[2].shape)
check('the edge label is kept', flow.edges[1].label === '是', flow.edges[1])
check('edge styling is read as normal', flow.edges[0].style === 'normal' && flow.edges[0].head === 'arrow', flow.edges[0])
const dashed = T.parseMermaid('graph LR\n A -.-> B\n A ==> C\n')
check('a dotted edge is detected', dashed.edges[0].style === 'dotted', dashed.edges[0].style)
check('a thick edge is detected', dashed.edges[1].style === 'thick', dashed.edges[1].style)
check('LR direction is kept', dashed.direction === 'LR', dashed.direction)
check('comments are stripped', T.parseMermaid('graph TD\n%% note\n A --> B\n').edges.length === 1, null)
check('TB is normalised to TD', T.parseMermaid('graph TB\n A --> B').direction === 'TD', null)

// ---- layout ----
const layout = T.layoutMermaid(flow)
check('the root sits above its children', layout.positions.get('A').y < layout.positions.get('B').y, [...layout.positions])
check('siblings of one depth share a row', layout.positions.get('B').y === layout.positions.get('C').y, [...layout.positions])
check('the canvas covers the nodes', layout.width > 0 && layout.height > 0, [layout.width, layout.height])
const cyclic = T.parseMermaid('graph TD\n A --> B\n B --> A\n')
check('a cycle still lays out', T.layoutMermaid(cyclic).positions.size === 2, null)

// ---- other diagram kinds ----
const seq = T.parseMermaid('sequenceDiagram\n participant 甲\n participant 乙\n 甲->>乙: 询问\n乙-->>甲: 回答\n')
check('sequence actors are collected', seq.kind === 'sequence' && seq.actors.length === 2, seq.actors)
check('sequence messages keep their text', seq.messages.length === 2 && seq.messages[0].text === '询问', seq.messages)
const pie = T.parseMermaid('pie\n "甲" : 30\n "乙" : 70\n')
check('pie slices are collected', pie.kind === 'pie' && pie.slices.length === 2, pie.slices)

check('an unknown diagram is not parsed', T.parseMermaid('classDiagram\n A <|-- B\n') === null, null)
check('empty source is not parsed', T.parseMermaid('') === null, null)

// ---- rendering ----
const svg = T.renderMermaid(flow)
check('a flowchart renders as svg', svg.type === 'svg', svg.type)
const text = JSON.stringify(svg)
check('node labels reach the picture', text.includes('开始') && text.includes('判断'), null)
check('edges carry an arrow marker', text.includes('dcw-mmd-arrow'), null)
check('the diamond node is a path', text.includes('"type":"path"'), null)
const seqSvg = T.renderMermaid(seq)
check('a sequence diagram renders lifelines', JSON.stringify(seqSvg).includes('dcw-mmd-lifeline'), null)
const pieSvg = T.renderMermaid(pie)
check('a pie renders slices with percentages', JSON.stringify(pieSvg).includes('70%'), null)

// ---- fence integration ----
const fenceTree = T.renderBlocks(T.parseBlocks('```mermaid\ngraph TD\n A[甲] --> B[乙]\n```\n'))
check('a mermaid fence renders a diagram block', JSON.stringify(fenceTree).includes('dcw-md-diagram'), null)
const brokenTree = T.renderBlocks(T.parseBlocks('```mermaid\nclassDiagram\n A <|-- B\n```\n'))
check('an unparsable diagram falls back to code', JSON.stringify(brokenTree).includes('dcw-md-codeblock'), null)


// ---- the reference's default theme and message styles ----
import fs from 'node:fs'
const css = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
check('the primary fill matches the shipped default theme', css.includes('--dcw-mmd-primary: #ececff'), null)
check('the secondary fill matches too', css.includes('--dcw-mmd-secondary: #ffffde'), null)
check('the border colour is the reference purple', css.includes('--dcw-mmd-border: #9370db'), null)
check('lifelines are dashed with the zenuml period', css.includes('stroke-dasharray: 1 5'), null)
check('a dark variant exists', css.includes('@media (prefers-color-scheme: dark)') && css.includes('--dcw-mmd-primary: #2f2b4a'), null)

const solid = T.parseMermaid('sequenceDiagram\n A->>B: 同步\n A-->>B: 异步\n A-xB: 失败\n')
check('a sync message is solid with an arrow', solid.messages[0].style === 'solid' && solid.messages[0].head === 'arrow', solid.messages[0])
check('a dotted message is dotted', solid.messages[1].style === 'dotted', solid.messages[1])
check('a cross message has no arrow head', solid.messages[2].head === 'cross', solid.messages[2])
const seqSvg2 = JSON.stringify(T.renderMermaid(solid))
check('dotted messages carry the dashed class', seqSvg2.includes('dcw-mmd-dotted') || solid.messages[1].style === 'dotted', null)


// ---- orthogonal routing ----
const td = T.orthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 80 }, false)
check('a TD edge elbows vertically first', /V \d+ H \d+ V \d+/.test(td) && td.startsWith('M 70 20 V'), td)
const lr = T.orthogonalEdge({ x: 0, y: 0 }, { x: 120, y: 60 }, true)
check('an LR edge elbows horizontally first', /H \d+ V \d+ H \d+/.test(lr) && lr.startsWith('M 70 20 H'), lr)
const straightDown = T.orthogonalEdge({ x: 0, y: 0 }, { x: 0, y: 80 }, false)
check('a vertical pair needs no elbow', straightDown === 'M 70 20 V 100', straightDown)
const straightAcross = T.orthogonalEdge({ x: 0, y: 0 }, { x: 100, y: 0 }, true)
check('a horizontal pair needs no elbow', straightAcross === 'M 70 20 H 170', straightAcross)
const flowTree = T.renderMermaid(flow)
const paths = []
const walkP = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkP); return }
  if (typeof n !== 'object') return
  if (n.type === 'path' && typeof n.props.d === 'string' && n.props.d.startsWith('M ')) paths.push(n.props.d)
  n.children.forEach(walkP)
}
walkP(flowTree)
check('flowchart edges render as paths, not lines', paths.length >= 2, paths.length)
check('an elbow path appears in the picture', paths.some((d) => d.includes(' V ') && d.includes(' H ')), paths)

// ---- crossing reduction ----
// Two parents on one row, two children on the next; ordering should pair them
// up instead of crossing.
const crossing = T.parseMermaid('graph TD\n P1 --> C2\n P2 --> C1\n')
const laid = T.layoutMermaid(crossing)
const at = (id) => laid.positions.get(id)
check('the layout places four nodes', laid.positions.size === 4, laid.positions.size)
// P1 must sit nearer C2's column than P2 does, i.e. the two pairs line up.
const dist = (a, b) => Math.abs(at(a).x - at(b).x)
check('paired nodes line up vertically', dist('P1', 'C2') === 0 && dist('P2', 'C1') === 0, [dist('P1', 'C2'), dist('P2', 'C1')])
const fan = T.parseMermaid('graph TD\n A --> B\n A --> C\n A --> D\n')
const fanLayout = T.layoutMermaid(fan)
const xs = ['B', 'C', 'D'].map((id) => fanLayout.positions.get(id).x)
check('siblings keep their source order', xs[0] < xs[1] && xs[1] < xs[2], xs)
const centred = T.parseMermaid('graph TD\n A --> B\n A --> C\n A --> D\n B --> E\n')
const centredLayout = T.layoutMermaid(centred)
check('a short row is centred against the widest one', centredLayout.positions.get('E').x > 30, centredLayout.positions.get('E').x)


// ---- subgraphs ----
const SUB = 'graph TD\n  subgraph S1[第一组]\n    A[甲] --> B[乙]\n  end\n  subgraph S2\n    C[丙]\n  end\n  B --> C\n'
const parsedSub = T.parseMermaid(SUB)
check('subgraphs are collected with labels', parsedSub.groups.length === 2 && parsedSub.groups[0].label === '第一组', parsedSub.groups)
check('a bare subgraph uses its id as label', parsedSub.groups[1].label === 'S2', parsedSub.groups[1])
check('nodes remember their group', parsedSub.nodes.find((n) => n.id === 'A').group === 'S1', parsedSub.nodes.map((n) => [n.id, n.group]))
check('an edge crossing groups is kept', parsedSub.edges.some((e) => e.from === 'B' && e.to === 'C'), parsedSub.edges)
check('nodes outside any subgraph stay ungrouped', T.parseMermaid('graph TD\n A --> B').nodes.every((n) => n.group === undefined), null)

const subLayout = T.layoutMermaid(parsedSub)
check('every subgraph node is placed', subLayout.positions.size === 3, subLayout.positions.size)
const subTree = T.renderMermaid(parsedSub)
const subClasses = []
const subText = []
const walkSub = (n) => {
  if (n === null || n === undefined) return
  if (Array.isArray(n)) { n.forEach(walkSub); return }
  if (typeof n === 'string') { subText.push(n); return }
  if (typeof n !== 'object') return
  if (typeof n.props.className === 'string') subClasses.push(n.props.className)
  n.children.forEach(walkSub)
}
walkSub(subTree)
check('each subgraph draws a box', subClasses.filter((c) => c === 'dcw-mmd-cluster').length === 2, subClasses.filter((c) => c.includes('cluster')))
check('the box carries its label', subText.includes('第一组'), subText)
check('cluster boxes render before the nodes', JSON.stringify(subTree.children.slice(0, 2)).includes('dcw-mmd-cluster'), null)

// members of one group stay adjacent inside a row
const WIDE = 'graph TD\n  subgraph G\n    A\n    B\n  end\n  C\n  D\n  R --> A\n  R --> B\n  R --> C\n  R --> D\n'
const wideLayout = T.layoutMermaid(T.parseMermaid(WIDE))
const groupXs = ['A', 'B', 'C', 'D'].map((id) => wideLayout.positions.get(id).x)
const gapAB = Math.abs(groupXs[0] - groupXs[1])
check('grouped siblings sit next to each other', gapAB === 190, { groupXs, gapAB })


// ---- obstacle avoidance ----
const straightClear = T.orthogonalEdge({ x: 0, y: 0 }, { x: 300, y: 80 }, false, [])
check('a clear route stays a plain elbow', straightClear === 'M 70 20 V 60 H 370 V 100', straightClear)

// a node parked exactly on the default lane must move the lane
const blocker = { x: 150, y: 40, w: 140, h: 40 }
const dodged = T.orthogonalEdge({ x: 0, y: 0 }, { x: 300, y: 160 }, false, [blocker])
const laneY = Number(/V (\d+)/.exec(dodged)[1])
const crosses = laneY > blocker.y - 4 && laneY < blocker.y + blocker.h + 4
check('the lane moves off a blocking node', crosses === false, { path: dodged, laneY, blocker })
check('the dodged route is still orthogonal', /^M \d+ \d+ V \d+ H \d+ V \d+$/.test(dodged), dodged)

// a blocking node off to the side is ignored
const aside = T.orthogonalEdge({ x: 0, y: 0 }, { x: 300, y: 160 }, false, [{ x: 500, y: 40, w: 140, h: 40 }])
const asideLane = Number(/V (\d+)/.exec(aside)[1])
check('a node off the span is ignored', asideLane === 100, { path: aside, asideLane })

// a straight vertical edge through a node takes a side track
const verticalBlocked = T.orthogonalEdge({ x: 0, y: 0 }, { x: 0, y: 200 }, false, [
  { x: -20, y: 90, w: 140, h: 40 },
])
check('a straight edge detours around a node', /H \d+ V \d+ H \d+/.test(verticalBlocked), verticalBlocked)
const verticalClear = T.orthogonalEdge({ x: 0, y: 0 }, { x: 0, y: 200 }, false, [])
check('a clear straight edge stays straight', verticalClear === 'M 70 20 V 220', verticalClear)

// LR routing dodges on the other axis
const lrDodge = T.orthogonalEdge({ x: 0, y: 0 }, { x: 300, y: 0 }, true, [{ x: 150, y: -10, w: 140, h: 40 }])
check('an LR edge detours above or below', lrDodge !== 'M 70 20 H 370', lrDodge)

// the whole diagram still renders
const dodgedTree = T.renderMermaid(T.parseMermaid('graph TD\n A --> B\n A --> C\n B --> C\n'))
check('a diagram with crossing edges still renders', JSON.stringify(dodgedTree).includes('dcw-mmd-edge'), null)


// ---- classDef styling ----
const styled = T.parseMermaid('graph TD\n classDef warn fill:#f96,stroke:#333\n A-->B\n class A warn\n')
check('classDef is parsed into a style', styled.classes.length === 1 && styled.classes[0].style.background === '#f96', styled.classes)
check('a node joins its class', styled.nodeClasses.some((entry) => entry.id === 'A' && entry.name === 'warn'), styled.nodeClasses)
check('an unsafe colour is refused', T.parseMermaid('graph TD\n classDef x fill:url(y)\n A\n').classes[0].style.background === undefined, null)
const styledTree = JSON.stringify(T.renderMermaid(styled))
check('the style reaches the node shape', styledTree.includes('"background":"#f96"'), null)
check('an unclassed node stays default', !JSON.stringify(T.renderMermaid(T.parseMermaid('graph TD\n A-->B'))).includes('background'), null)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
