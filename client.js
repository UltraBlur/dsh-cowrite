/**
 * Browser half of the co-writing document plugin.
 *
 * Registers one right-sidebar tab type ("共写") whose body is a live Markdown
 * editor over a workspace file. Typing saves itself; a poll compares the file's
 * modification time against the version this tab last saw, so a write from the
 * Agent (or any other tool) appears in the pane instead of being overwritten
 * blind. When both sides changed the same file, the pane stops saving and asks
 * which version to keep.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-cowrite',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** This package's copy and locale namespace. */
    const NS = 'cowrite'
    /** The tab type's identity: the kind the registry opens, and this body's slot key. */
    const TAB_ID = 'dsh-cowrite'
    const TAB_KIND = 'dsh-cowrite'
    /** The host route that reads and writes the file. */
    const ROUTE = '/api/dsh-cowrite'
    /** The host's binary route, used for images inside the document. */
    const RAW_ROUTE = '/api/dsh-cowrite/raw'
    const STICKY_PREFIX = 'dsh-cowrite:path:'
    const MODE_KEY = 'dsh-cowrite:mode'
    const ZOOM_KEY = 'dsh-cowrite:zoom'
    const FOCUS_KEY = 'dsh-cowrite:focus'
    const TYPEWRITER_KEY = 'dsh-cowrite:typewriter'
    const INDENT_KEY = 'dsh-cowrite:indent'
    const LINENO_KEY = 'dsh-cowrite:lineno'
    const COUNT_KEY = 'dsh-cowrite:count'
    const SHORTCUT_ID = 'cowrite.open'
    /** Quiet-period before a typed change is written. */
    const SAVE_DELAY_MS = 700
    const POLL_VISIBLE_MS = 1100
    const POLL_HIDDEN_MS = 4000

    const zh = {
      'tab.title': '共写文档',
      'guide.title': '共写文档',
      'guide.description': '在工作区里直接编辑 Markdown，助手改同一文件时自动载入',
      'shortcut.noSession': '先打开一个会话',
      'type.label': '共写文档',
      'bar.save': '保存',
      'bar.refresh': '刷新',
      'bar.pick': '选择文件',
      'mode.preview': '预览',
      'mode.source': '源码',
      'mode.live': '排版',
      'zoom.out': '缩小',
      'zoom.in': '放大',
      'zoom.reset': '重置为 100%',
      'outline.title': '大纲',
      'find.title': '查找',
      'find.placeholder': '查找…',
      'find.prev': '上一个',
      'find.next': '下一个',
      'find.close': '关闭查找',
      'find.none': '无匹配',
      'find.replace': '替换',
      'find.replacePlaceholder': '替换为…',
      'find.replaceOne': '替换',
      'find.replaceAll': '全部替换',
      'focus.on': '焦点模式：开',
      'focus.off': '焦点模式：关',
      'table.addRow': '+ 行',
      'table.addRowAbove': '在上方插入一行',
      'table.addColumn': '+ 列',
      'table.addColumnBefore': '在左侧插入一列',
      'table.deleteRow': '− 行',
      'table.deleteColumn': '− 列',
      'table.hint': '表格操作（光标所在行列）',
      'table.alignLeft': '本列左对齐',
      'table.alignCenter': '本列居中',
      'table.alignRight': '本列右对齐',
      'toc.empty': '（暂无标题）',
      'indent.title': '首行缩进 2 字',
      'export.title': '导出为 HTML 文件',
      'lineno.title': '代码块行号',
      'code.language': '点击修改语言',
      'outline.collapse': '收起',
      'outline.expand': '展开',
      'typewriter.on': '打字机模式：开',
      'typewriter.off': '打字机模式：关',
      'editor.aria': 'Markdown 源码',
      'live.hint': '点击这里开始输入…',
      'empty.noWorkspace': '当前会话还没有工作目录',
      'empty.noFiles': '这个工作区里没有找到 Markdown 或文本文件',
      'empty.noFilesHint': '新建 .md 文件后点“刷新”',
      'empty.loading': '正在载入…',
      'empty.pick': '选择一个文件开始共写',
      'foot.chars': '{n} 字',
      'foot.stats': '{n} 字',
      'foot.words': '{n} 词',
      'foot.lines': '{n} 行',
      'foot.minutes': '{n} 分钟',
      'foot.zeroMinutes': '≤ 1 分钟',
      'foot.oneMinute': '1 分钟',
      'foot.cycle': '切换计数：词 / 字 / 行 / 分钟',
      'foot.modified': '磁盘版本 {time}',
      'state.synced': '已同步',
      'state.dirty': '未保存',
      'state.saving': '保存中…',
      'state.saved': '已保存 {time}',
      'state.loading': '载入中…',
      'state.reloaded': '已载入磁盘更新 {time}',
      'conflict.changed': '磁盘上的文件被改动了，这里的编辑尚未保存。',
      'conflict.takeDisk': '载入磁盘版本',
      'conflict.keepMine': '覆盖为我的版本',
      'err.no-root': '找不到可写入的工作区目录',
      'err.bad-path': '文件路径不合法',
      'err.outside-root': '这个路径不在当前工作区内',
      'err.not-found': '文件不存在',
      'err.not-a-file': '这个路径不是普通文件',
      'err.too-large': '文件太大，无法在侧栏编辑',
      'err.write-failed': '写入失败',
      'err.bad-content': '提交的内容不合法',
      'err.body-too-large': '内容太大，主机拒绝接收',
      'err.bad-json': '主机无法解析这次请求',
      'err.no-host-route': '主机没有注册共写接口',
      'err.unauthorized': '页面未通过主机校验，刷新页面后再试',
      'err.root-not-allowed': '这个目录不在主机的可编辑范围内（工作区未注册）',
      'err.internal': '主机内部错误',
      'err.unknown': '操作失败',
    }

    const en = {
      'tab.title': 'Co-writing',
      'guide.title': 'Co-writing editor',
      'guide.description': 'Edit a Markdown file here; Agent writes to the same file load automatically',
      'shortcut.noSession': 'Open a session first',
      'type.label': 'Co-writing editor',
      'bar.save': 'Save',
      'bar.refresh': 'Refresh',
      'bar.pick': 'Pick a file',
      'mode.preview': 'Preview',
      'mode.source': 'Source',
      'mode.live': 'Live',
      'zoom.out': 'Zoom out',
      'zoom.in': 'Zoom in',
      'zoom.reset': 'Reset to 100%',
      'outline.title': 'Outline',
      'find.title': 'Find',
      'find.placeholder': 'Find…',
      'find.prev': 'Previous match',
      'find.next': 'Next match',
      'find.close': 'Close find',
      'find.none': 'No matches',
      'find.replace': 'Replace',
      'find.replacePlaceholder': 'Replace with…',
      'find.replaceOne': 'Replace',
      'find.replaceAll': 'Replace all',
      'focus.on': 'Focus mode: on',
      'focus.off': 'Focus mode: off',
      'table.addRow': '+ row',
      'table.addRowAbove': 'Insert a row above',
      'table.addColumn': '+ column',
      'table.addColumnBefore': 'Insert a column to the left',
      'table.deleteRow': '− row',
      'table.deleteColumn': '− column',
      'table.hint': 'Table operations at the caret',
      'table.alignLeft': 'Left-align this column',
      'table.alignCenter': 'Centre this column',
      'table.alignRight': 'Right-align this column',
      'toc.empty': '(no headings yet)',
      'indent.title': 'Indent first line by 2em',
      'export.title': 'Export as an HTML file',
      'lineno.title': 'Code line numbers',
      'code.language': 'Click to change the language',
      'outline.collapse': 'Collapse',
      'outline.expand': 'Expand',
      'typewriter.on': 'Typewriter mode: on',
      'typewriter.off': 'Typewriter mode: off',
      'editor.aria': 'Markdown source',
      'live.hint': 'Click here to start writing…',
      'empty.noWorkspace': 'This session has no working directory yet',
      'empty.noFiles': 'No Markdown or text file was found in this workspace',
      'empty.noFilesHint': 'Create a .md file, then press Refresh',
      'empty.loading': 'Loading…',
      'empty.pick': 'Pick a file to start co-writing',
      'foot.chars': '{n} chars',
      'foot.stats': '{n} chars',
      'foot.words': '{n} words',
      'foot.lines': '{n} lines',
      'foot.minutes': '{n} min',
      'foot.zeroMinutes': '≤ 1 min',
      'foot.oneMinute': '1 min',
      'foot.cycle': 'Cycle the counter: words / chars / lines / minutes',
      'foot.modified': 'disk {time}',
      'state.synced': 'In sync',
      'state.dirty': 'Unsaved',
      'state.saving': 'Saving…',
      'state.saved': 'Saved {time}',
      'state.loading': 'Loading…',
      'state.reloaded': 'Disk update loaded {time}',
      'conflict.changed': 'The file changed on disk and this pane has unsaved edits.',
      'conflict.takeDisk': 'Load disk version',
      'conflict.keepMine': 'Overwrite with mine',
      'err.no-root': 'No writable workspace directory was found',
      'err.bad-path': 'Invalid file path',
      'err.outside-root': 'That path is outside the current workspace',
      'err.not-found': 'The file does not exist',
      'err.not-a-file': 'That path is not a regular file',
      'err.too-large': 'The file is too large to edit here',
      'err.write-failed': 'Writing failed',
      'err.bad-content': 'The submitted content is invalid',
      'err.body-too-large': 'Content too large for the host',
      'err.bad-json': 'The host could not parse this request',
      'err.no-host-route': 'The host did not register the co-writing route',
      'err.unauthorized': 'This page is not admitted by the host; refresh and retry',
      'err.root-not-allowed': 'That directory is outside the host\'s editable workspaces',
      'err.internal': 'Host internal error',
      'err.unknown': 'The operation failed',
    }

    const CSS = `
.dcw-root {
  position: relative;
  display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  color: var(--dsw-alias-label-primary); background: transparent; font-size: 13px;
}
.dcw-bar {
  display: flex; align-items: center; gap: 6px; flex: none; min-width: 0;
  padding: 8px 10px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dcw-tools {
  display: flex; align-items: center; gap: 6px; flex: none; min-width: 0;
  padding: 0 10px 7px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dcw-select {
  flex: 1; min-width: 0; height: 26px; padding: 0 6px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 12px;
  outline: none; text-overflow: ellipsis;
}
.dcw-select:focus { border-color: var(--dsw-alias-brand-primary); }
.dcw-btn {
  flex: none; height: 26px; padding: 0 9px; border-radius: 6px; line-height: 1;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px;
  white-space: nowrap; cursor: pointer;
}
.dcw-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dcw-btn:disabled { opacity: 0.45; cursor: default; }
.dcw-group {
  display: flex; align-items: stretch; flex: none; overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
}
.dcw-seg {
  height: 24px; padding: 0 8px; border: 0; background: transparent;
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px;
  line-height: 1; cursor: pointer; white-space: nowrap;
}
.dcw-seg + .dcw-seg { border-left: 1px solid var(--dsw-alias-border-l1); }
.dcw-seg[data-on="true"] {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dcw-seg:hover { color: var(--dsw-alias-label-primary); }
.dcw-zoom { display: flex; align-items: stretch; flex: none; margin-left: auto; }
.dcw-zoom-value {
  min-width: 40px; padding: 0 4px; line-height: 24px; text-align: center;
  font-size: 11px; color: var(--dsw-alias-label-secondary);
}
.dcw-doc {
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  box-sizing: border-box; max-width: 860px; width: 100%; margin: 0 auto;
  padding: 30px 30px 100px;
}
/* First-line indent, only for top-level paragraphs: 2em, reset in lists and
   inline runs, and pull a lone image back by the same amount. */
.dcw-md[data-indent="true"] .dcw-md > .dcw-md-p,
.dcw-md[data-indent="true"] .dcw-live-block > .dcw-md-p { text-indent: 2em; }
.dcw-md[data-indent="true"] li .dcw-md-p,
.dcw-md[data-indent="true"] .dcw-md-p * { text-indent: 0; }
.dcw-md[data-indent="true"] .dcw-md-li { margin-left: 2em; }
.dcw-md[data-indent="true"] .dcw-md-p > img:only-child { margin-left: -2em; }
.dcw-editor {
  flex: 1; min-height: 0; width: 100%; box-sizing: border-box; margin: 0;
  padding: 14px 16px 56px; border: 0; outline: none; resize: none;
  background: transparent; color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "PingFang SC", "Hiragino Sans GB", monospace;
  line-height: 1.85; tab-size: 2;
  white-space: pre-wrap; word-break: break-word; overflow-y: auto;
}
.dcw-banner {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex: none;
  padding: 7px 10px; font-size: 12px; line-height: 1.5;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-state-warn-primary);
}
.dcw-banner[data-kind="error"] { color: var(--dsw-alias-state-error-primary); }
.dcw-banner-text { flex: 1; min-width: 120px; }
.dcw-foot {
  display: flex; align-items: center; gap: 8px; flex: none;
  padding: 6px 10px; border-top: 1px solid var(--dsw-alias-border-l1);
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  white-space: nowrap; overflow: hidden;
}
.dcw-foot-state { margin-left: auto; overflow: hidden; text-overflow: ellipsis; }
.dcw-foot-count {
  border: 0; background: transparent; padding: 0; font: inherit; cursor: pointer;
  color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums;
}
.dcw-foot-count:hover { color: var(--dsw-alias-label-primary); }
.dcw-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; padding: 24px; text-align: center;
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.7;
}
.dcw-empty strong { color: var(--dsw-alias-label-primary); font-weight: 500; }

/* ---- rendered markdown ----
   Measurements follow Typora 1.14.10's shipped base.css and github theme:
   16px base, 1.6 line-height, 2.25/1.75/1.5/1.25em heading ladder, 0.8em block
   margins, 6px 13px cells. Sizes stay in em so the zoom scales everything. */
.dcw-md {
  --dcw-blur: #c8c8c8;
  font-size: 1em; line-height: 1.6; color: var(--dsw-alias-label-primary);
  word-break: normal; overflow-wrap: break-word;
}
.dcw-md p, .dcw-md blockquote, .dcw-md ul, .dcw-md ol, .dcw-md dl,
.dcw-md table, .dcw-md pre, .dcw-md h1, .dcw-md h2, .dcw-md h3, .dcw-md h4,
.dcw-md h5, .dcw-md h6, .dcw-md hr { margin: 0; }
.dcw-md li > ul, .dcw-md li > ol { margin: 0; }
.dcw-md p, .dcw-md blockquote, .dcw-md ul, .dcw-md ol, .dcw-md dl,
.dcw-md table, .dcw-md .dcw-md-codeblock, .dcw-md .dcw-md-mathblock { margin: 0.8em 0; }
.dcw-md h1, .dcw-md h2, .dcw-md h3, .dcw-md h4, .dcw-md h5, .dcw-md h6 {
  margin: 1rem 0; font-weight: bold; line-height: 1.4;
}
.dcw-md > h1:first-child, .dcw-md > h2:first-child,
.dcw-md > * > h1:first-child, .dcw-md > * > h2:first-child { margin-top: 0; }
.dcw-md h1 { font-size: 2.25em; line-height: 1.2; border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 0.15em; }
.dcw-md h2 { font-size: 1.75em; line-height: 1.225; border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 0.15em; }
.dcw-md h3 { font-size: 1.5em; line-height: 1.43; }
.dcw-md h4 { font-size: 1.25em; }
.dcw-md h5 { font-size: 1em; }
.dcw-md h6 { font-size: 1em; color: var(--dsw-alias-label-secondary); }

/* inline code carries a hairline border in the reference theme */
.dcw-md-code, .dcw-md-math {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em; padding: 2px 4px 0; border-radius: 3px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.dcw-md-math { border: 0; background: transparent; }
.dcw-md-lang {
  font-size: 0.72em; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--dsw-alias-label-secondary); padding: 8px 12px 0;
}
.dcw-md-codeblock {
  background: var(--dsw-alias-bg-layer-2); border-radius: 4px;
  padding: 8px 0 6px; overflow: hidden; position: relative;
}
.dcw-md-fencepanel {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 8px 4px 12px;
}
.dcw-md-fencepanel .dcw-md-lang { padding: 0; }
.dcw-md-langbtn {
  border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--dsw-alias-label-secondary);
}
.dcw-md-langbtn:hover { color: var(--dsw-alias-label-primary); }
.dcw-md-langinput {
  width: 10em; padding: 0 4px; font-size: 0.72em; font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 3px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); outline: none;
}
.dcw-md-diagram {
  display: block; padding: 10px 8px; margin: 0.8em 0;
  background: var(--dsw-alias-bg-layer-1); border-radius: 6px; overflow-x: auto;
}
/* Diagram colours follow mermaid's default theme (primary #ECECFF, secondary
   #ffffde, linear curves, unnumbered sequence) while staying themeable. */
.dcw-md-diagram {
  --dcw-mmd-primary: #ececff;
  --dcw-mmd-secondary: #ffffde;
  --dcw-mmd-border: #9370db;
  --dcw-mmd-line: currentColor;
  --dcw-mmd-lifeline: #d3d3d3;
}
.dcw-mmd { display: block; max-width: 100%; height: auto; color: var(--dsw-alias-label-secondary); font-family: inherit; }
.dcw-mmd-node { fill: var(--dcw-mmd-primary); stroke: var(--dcw-mmd-border); stroke-width: 1; }
.dcw-mmd-actor { fill: var(--dcw-mmd-secondary); stroke: var(--dcw-mmd-border); }
.dcw-mmd-actorlabel, .dcw-mmd-label { fill: var(--dsw-alias-label-primary); font-size: 12px; text-anchor: middle; }
.dcw-mmd-edge { stroke: var(--dcw-mmd-line); stroke-width: 1.2; fill: none; }
.dcw-mmd-dotted { stroke-dasharray: 4 3; }
.dcw-mmd-thick { stroke-width: 2.4; }
.dcw-mmd-cluster {
  fill: none; stroke: var(--dcw-mmd-border); stroke-width: 1;
  stroke-dasharray: 5 4; opacity: 0.55;
}
.dcw-mmd-clusterlabel {
  fill: var(--dsw-alias-label-secondary); font-size: 11px; font-style: italic;
}
.dcw-mmd-lifeline { stroke: var(--dcw-mmd-lifeline); stroke-dasharray: 1 5; stroke-width: 1.2; }
.dcw-mmd-edgelabel, .dcw-mmd-msg { fill: var(--dsw-alias-label-secondary); font-size: 11px; text-anchor: middle; }
@media (prefers-color-scheme: dark) {
  .dcw-md-diagram {
    --dcw-mmd-primary: #2f2b4a;
    --dcw-mmd-secondary: #43402a;
    --dcw-mmd-border: #8a7ac0;
    --dcw-mmd-lifeline: #5a5a66;
  }
}
.dcw-md-fencebtn {
  border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 11px; cursor: pointer; padding: 0 2px; opacity: 0.7;
}
.dcw-md-fencebtn:hover { opacity: 1; color: var(--dsw-alias-label-primary); }
.dcw-md-codeblock[data-lineno="true"] code { display: block; counter-reset: dcw-line; }
.dcw-md-line { display: block; counter-increment: dcw-line; }
.dcw-md-line::before {
  content: counter(dcw-line);
  display: inline-block; width: 2.2em; margin-right: 0.8em;
  text-align: right; color: var(--dsw-alias-label-secondary); opacity: 0.65;
  user-select: none;
}
.dcw-tok-kw { color: #c678dd; }
.dcw-tok-str { color: #98c379; }
.dcw-tok-com { color: #7d8799; font-style: italic; }
.dcw-tok-num { color: #d19a66; }
.dcw-md-codeblock pre { padding: 0 12px; overflow-x: auto; }
.dcw-md-codeblock code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em; line-height: 1.45; white-space: pre;
}
.dcw-md-quote {
  border-left: 4px solid var(--dsw-alias-border-l2); padding: 0 15px;
  color: var(--dsw-alias-label-secondary);
}
.dcw-md-quote > * + * { margin-top: 0.4em; }
.dcw-md-list { padding-left: 1.6em; }
.dcw-md-list[data-mark] { list-style: none; }
.dcw-md-list[data-mark] > .dcw-md-li::before {
  content: attr(data-mark); position: absolute; left: -1.1em;
  color: var(--dsw-alias-label-secondary);
}
kbd {
  margin: 0 .1em; padding: .1em .6em; font-size: .8em;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 3px; white-space: nowrap; vertical-align: middle;
}
.dcw-md-toc { font-size: 0.9em; border-radius: 10px; min-height: 3.58rem; padding: 6px 0; }
.dcw-md-toc-empty { color: var(--dsw-alias-label-secondary); padding-left: 0; }
.dcw-md-toc-inner {
  display: block; width: 100%; border: 0; background: transparent; text-align: left;
  color: var(--dsw-alias-brand-primary); font: inherit; cursor: pointer;
  padding: 1px 0; text-decoration: none;
}
.dcw-md-toc-inner:hover { text-decoration: underline; }
.dcw-md-toc-h1 { margin-left: 0; font-weight: bold; }
.dcw-md-toc-h2 { margin-left: 2em; }
.dcw-md-toc-h3 { margin-left: 4em; }
.dcw-md-toc-h4 { margin-left: 6em; }
.dcw-md-toc-h5 { margin-left: 8em; }
.dcw-md-toc-h6 { margin-left: 10em; }
.dcw-tabletools-sep { width: 1px; background: var(--dsw-alias-border-l1); margin: 0 4px; }

/* ---- print: the reference hides chrome and keeps blocks whole ---- */
@media print {
  .dcw-bar, .dcw-tools, .dcw-find, .dcw-outline, .dcw-tabletools, .dcw-foot,
  .dcw-banner, .dcw-md-fencepanel, .dcw-live-block:hover {
    display: none !important;
  }
  .dcw-root, .dcw-doc { display: block; height: auto; overflow: visible; max-width: none; padding: 0; }
  .dcw-md { line-height: 1.5; }
  .dcw-md h1, .dcw-md h2, .dcw-md h3, .dcw-md h4, .dcw-md h5, .dcw-md h6,
  .dcw-md tr, .dcw-md img, .dcw-md-codeblock, .dcw-md-mathblock, .dcw-md-diagram {
    page-break-inside: avoid;
  }
  .dcw-md h1, .dcw-md h2, .dcw-md h3, .dcw-md h4 { page-break-after: avoid; }
  .dcw-md-li > input[type="checkbox"] { pointer-events: none; }
  .dcw-live-block[data-dim="true"], .dcw-live-block[data-dim="true"] * { color: inherit !important; }
}
@page { margin: 18mm 16mm; }
.dcw-md-li { margin: 0.2em 0; }
.dcw-md-li > input[type="checkbox"] {
  position: absolute; left: 0; margin-left: -1.3em; margin-top: calc(0.8em - 10px);
  cursor: pointer;
}
.dcw-md-list:has(> .dcw-md-li > input[type="checkbox"]) { list-style: none; padding-left: 1.5em; }
.dcw-md-li { position: relative; }
.dcw-md-hr { border: 0; border-top: 1px solid var(--dsw-alias-border-l1); margin: 1.2em 0; }
.dcw-md a { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.dcw-md a:hover { text-decoration: underline; }
.dcw-md-img { max-width: 100%; height: auto; display: block; margin: 0.6em 0; }
.dcw-md-tablewrap { overflow-x: auto; }
.dcw-md table { border-collapse: collapse; width: 100%; word-break: initial; }
.dcw-md th, .dcw-md td {
  border: 1px solid var(--dsw-alias-border-l2); padding: 6px 13px;
  text-align: left; vertical-align: top; min-width: 32px;
}
.dcw-md th { font-weight: bold; border-bottom: 0; background: var(--dsw-alias-bg-layer-2); }
.dcw-md tr:nth-child(2n) { background: var(--dsw-alias-bg-layer-1); }
.dcw-md-blank { height: 0.6em; }
.dcw-md-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em; line-height: 1.5; color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-1); border-radius: 4px;
  padding: 8px 10px; overflow-x: auto; white-space: pre;
}
/* GitHub-callout colours, straight from the reference stylesheet */
.dcw-md-alert {
  padding: 0 1em; margin: 0.8em 0;
  border-left: 0.25em solid var(--dsw-alias-border-l2);
}
.dcw-md-alert-note { border-left-color: #0969da; }
.dcw-md-alert-important { border-left-color: #8250df; }
.dcw-md-alert-warning { border-left-color: #9a6700; }
.dcw-md-alert-tip { border-left-color: #1f883d; }
.dcw-md-alert-caution { border-left-color: #cf222e; }
.dcw-md-alert-label {
  font-size: 0.9em; font-weight: bold; text-transform: capitalize;
  margin-top: 0.5em;
}
.dcw-md-alert-note .dcw-md-alert-label { color: #0969da; }
.dcw-md-alert-important .dcw-md-alert-label { color: #8250df; }
.dcw-md-alert-warning .dcw-md-alert-label { color: #9a6700; }
.dcw-md-alert-tip .dcw-md-alert-label { color: #1f883d; }
.dcw-md-alert-caution .dcw-md-alert-label { color: #cf222e; }
.dcw-md-fn > a { text-decoration: none; font-size: 0.78em; }
.dcw-md-fn {
  background-color: rgba(238, 238, 238, 0.7); color: #555;
  padding: 2px 4px; border-radius: 4px; cursor: pointer;
}
.dcw-md-fn > a { color: inherit; }
[data-dcw-flash="true"] {
  background: #ffea00; color: #000; border-radius: 2px;
  transition: background 120ms ease;
}
.dcw-md-fn-back { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-decoration: none; padding: 0 4px; }
.dcw-md-fn-def {
  font-size: 0.9em; color: var(--dsw-alias-label-secondary);
  padding-left: 1.4em; text-indent: -1.2em; margin: 0.3em 0;
}
.dcw-md-fn-label { font-weight: bold; margin-right: 0.35em; }

/* ---- typeset math: serif, italic variables, upright digits and \text ---- */
.dcw-md-math, .dcw-md-mathblock, .dcw-tex-t, .dcw-tex-g {
  font-family: "Times New Roman", "Latin Modern Roman", "Songti SC", serif;
  font-style: italic; white-space: nowrap;
}
.dcw-md-mathblock {
  display: block; position: relative; text-align: center;
  overflow-x: auto; overflow-y: hidden;
  padding: 0.35em 0; margin: 0.8em 0; font-size: 1.06em;
}
.dcw-md-mathbody { display: inline-block; }
.dcw-md-mathtag {
  position: absolute; right: 0; top: 50%; transform: translateY(-50%);
  font-size: 0.92em; color: var(--dsw-alias-label-secondary); font-style: normal;
}
.dcw-tex-t { font-style: normal; }
.dcw-tex-g { font-style: normal; font-size: 1.02em; }
.dcw-tex-up, .dcw-tex-up .dcw-tex-t { font-style: normal; }
.dcw-tex-bold { font-weight: 600; font-style: normal; }
.dcw-tex-sp { display: inline-block; width: 0.28em; }
.dcw-tex-script sup, .dcw-tex-script sub { font-size: 0.7em; line-height: 0; }
.dcw-tex-frac {
  display: inline-flex; flex-direction: column; align-items: center;
  vertical-align: middle; font-size: 0.96em; margin: 0 0.14em;
}
.dcw-tex-num { border-bottom: 1px solid currentColor; padding: 0 0.22em; }
.dcw-tex-den { padding: 0 0.22em; }
.dcw-tex-sqrt { display: inline-flex; align-items: flex-start; }
.dcw-tex-radical { transform: scaleY(1.25); transform-origin: bottom; }
.dcw-tex-radicand { border-top: 1px solid currentColor; padding: 0 0.14em; }
.dcw-tex-gap { display: inline-block; }
.dcw-tex-fence { display: inline-block; transform: scaleY(1.35); color: inherit; }
.dcw-tex-accent { position: relative; }
.dcw-tex-over { border-top: 1px solid currentColor; padding-top: 0.06em; }
.dcw-tex-under { border-bottom: 1px solid currentColor; padding-bottom: 0.06em; }
.dcw-tex-cancel { text-decoration: line-through; }
.dcw-tex-phantom { visibility: hidden; }
.dcw-tex-stack { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; }
.dcw-tex-stacktop { font-size: 0.78em; line-height: 1.1; }
.dcw-tex-env { display: inline-flex; align-items: center; gap: 0.12em; vertical-align: middle; }
.dcw-tex-matrix { border-collapse: collapse; display: inline-table; }
.dcw-tex-matrix td { padding: 0.12em 0.32em; text-align: center; border: 0; }
.dcw-tex-binom { display: inline-flex; align-items: center; vertical-align: middle; }
.dcw-tex-small { font-size: 0.9em; }
.dcw-tex-nobar { padding: 0 0.22em; }
.dcw-tex-substack {
  display: inline-flex; flex-direction: column; align-items: center;
  vertical-align: middle; font-size: 0.72em; line-height: 1.15;
}
.dcw-tex-lap { position: relative; display: inline-block; width: 0; }
.dcw-tex-lap-center > span:first-child { position: absolute; left: 50%; transform: translateX(-50%); }
.dcw-tex-lap-left > span:first-child { position: absolute; right: 0; }
.dcw-tex-lap-right > span:first-child { position: absolute; left: 0; }
.dcw-tex-sf { font-family: "Helvetica Neue", Arial, sans-serif; }
.dcw-tex-tt { font-family: ui-monospace, Menlo, monospace; font-size: 0.92em; }
.dcw-tex-it, .dcw-tex-textit { font-style: italic; }
.dcw-tex-bold { font-weight: 600; }
.dcw-tex-bb, .dcw-tex-cal, .dcw-tex-frak { font-style: normal; }
.dcw-tex-boxed {
  display: inline-block; padding: 0.12em 0.3em; border: 1px solid currentColor;
  border-radius: 2px; vertical-align: middle;
}
.dcw-tex-overstack, .dcw-tex-understack {
  display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle;
  line-height: 1.05;
}
.dcw-tex-brace { font-size: 1.15em; line-height: 0.6; }
.dcw-tex-stackbot { font-size: 0.78em; line-height: 1.1; }
.dcw-tex-big { font-size: 1.25em; }
.dcw-tex-big2 { font-size: 1.55em; }
.dcw-tex-big3 { font-size: 1.9em; }
.dcw-tex-big4 { font-size: 2.3em; }
.dcw-tex-rootindex { font-size: 0.6em; vertical-align: super; margin-right: -0.15em; }
.dcw-tex-smash { display: inline-block; line-height: 0; }
.dcw-tex-pmod { white-space: nowrap; }
.dcw-tex-colorbox { padding: 0.05em 0.2em; border-radius: 2px; }

/* ---- hybrid (live) view ---- */
.dcw-live > * + * { margin-top: 0; }
.dcw-live-block { border-radius: 4px; cursor: text; }
.dcw-live-block:hover { background: var(--dsw-alias-bg-layer-1); }
.dcw-live-block[data-dim="true"],
.dcw-live-block[data-dim="true"] * { color: var(--dcw-blur) !important; transition: color 140ms ease; }
.dcw-live-block[data-dim="true"] img { opacity: 0.3; }
.dcw-live-block[data-dim="true"]:hover,
.dcw-live-block[data-dim="true"]:hover * { color: var(--dsw-alias-label-primary) !important; }
.dcw-live-input {
  display: block; width: 100%; box-sizing: border-box; margin: 0.4em 0;
  padding: 0.25em 0.4em; border: 0; outline: none; resize: none;
  overflow: hidden; border-radius: 4px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "PingFang SC", "Hiragino Sans GB", monospace;
  font-size: 0.94em; line-height: 1.6; tab-size: 2;
  white-space: pre-wrap; word-break: break-word;
}
.dcw-live-empty {
  padding: 1.2em 0.4em; border-radius: 4px; cursor: text;
  color: var(--dsw-alias-label-secondary); font-size: 0.95em;
}
.dcw-live-empty:hover { background: var(--dsw-alias-bg-layer-1); }

/* ---- search highlighting: solid yellow on black, as in the reference ---- */
.dcw-mark { background: #ffea00; color: #000; border-radius: 2px; padding: 0 1px; }
.dcw-mark-current { background: #ff8a00; }
.dcw-find {
  display: flex; align-items: center; gap: 4px; flex: none; min-width: 0; flex-wrap: wrap;
  padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.dcw-find-input {
  flex: 1; min-width: 0; height: 24px; padding: 0 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 12px; outline: none;
}
.dcw-find-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dcw-find-replace {
  display: flex; align-items: center; gap: 4px; flex: 1 0 100%; min-width: 0;
}
.dcw-find-count {
  flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums; min-width: 34px; text-align: right;
}

/* ---- outline: one em of indent per level, bold top level ---- */
.dcw-outline {
  position: absolute; top: 76px; right: 10px; z-index: 20;
  display: flex; flex-direction: column; min-width: 190px; max-width: 80%;
  max-height: 60%; overflow-y: auto; padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.dcw-outline-row { display: flex; align-items: center; }
.dcw-outline-expander {
  flex: none; width: 16px; height: 22px; padding: 0; border: 0;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 10px; line-height: 1; cursor: pointer;
}
.dcw-outline-children { padding-left: 10px; }
.dcw-outline-item {
  flex: 1; min-width: 0; padding: 3px 8px; border: 0; border-radius: 4px;
  background: transparent; color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px; line-height: 1.5;
  text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer;
}
.dcw-outline-item[data-level="1"] { font-weight: bold; }
.dcw-outline-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dcw-tabletools {
  display: flex; align-items: stretch; gap: 0; flex: none; overflow: hidden;
  padding: 0 10px 7px;
}
.dcw-tabletools .dcw-seg {
  border: 1px solid var(--dsw-alias-border-l2); border-left-width: 0;
  height: 24px;
}
.dcw-tabletools .dcw-seg:first-child { border-left-width: 1px; border-radius: 6px 0 0 6px; }
.dcw-tabletools .dcw-seg:last-child { border-radius: 0 6px 6px 0; }

`

    /* ------------------------------------------------------------------ *
     * Markdown core
     *
     * A hand-written CommonMark subset: a block parser that keeps every
     * block's source offsets, an inline tokenizer, and a React renderer.
     * Nothing here is copied from another markdown implementation; the
     * grammar choices follow the public CommonMark specification.
     * ------------------------------------------------------------------ */

    const INLINE_ESCAPABLE = '\\`*_{}[]()#+-.!~>|'
    const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*([^`~]*)$/
    const ATX_HEADING = /^[ \t]{0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/
    const THEMATIC_BREAK = /^[ \t]{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
    const QUOTE_LINE = /^[ \t]{0,3}>/
    const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/
    const SETEXT = /^[ \t]{0,3}(=+|-+)[ \t]*$/
    const TABLE_DELIMITER = /^[ \t]{0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
    const TASK_MARK = /^\[([ xX])\][ \t]+([\s\S]*)$/

    /** Whether a line holds nothing but whitespace. */
    function isBlankLine(text) {
      return /^[ \t]*$/.test(text)
    }

    /**
     * Split text into lines that carry their own source offsets.
     * @param text - the document.
     * @returns line records; a trailing newline yields one empty last line.
     */
    function listLines(text) {
      const lines = []
      let start = 0
      let index = text.indexOf('\n')
      while (index >= 0) {
        lines.push({ text: text.slice(start, index), start, end: index + 1 })
        start = index + 1
        index = text.indexOf('\n', start)
      }
      lines.push({ text: text.slice(start), start, end: text.length })
      return lines
    }

    /**
     * Split a table row into trimmed cells that remember where they start, so a
     * click inside a cell can place the caret in that cell's source.
     * @param line - the raw row.
     * @returns cells with `text` and offsets inside the line.
     */
    function splitTableRowCells(line) {
      const cells = []
      const pushCell = (from, to) => {
        let start = from
        let end = to
        while (start < end && (line[start] === ' ' || line[start] === '\t')) start += 1
        while (end > start && (line[end - 1] === ' ' || line[end - 1] === '\t')) end -= 1
        cells.push({ text: line.slice(start, end), from: start, to: end })
      }
      let index = 0
      let segmentStart = 0
      while (index <= line.length) {
        if (index === line.length) {
          pushCell(segmentStart, index)
          break
        }
        const char = line[index]
        if (char === '\\' && line[index + 1] === '|') {
          index += 2
          continue
        }
        if (char === '|') {
          pushCell(segmentStart, index)
          segmentStart = index + 1
        }
        index += 1
      }
      // Edge pipes produce an empty cell on each side; they are delimiters.
      if (cells.length > 0 && cells[0].text === '' && line.trimStart().startsWith('|')) cells.shift()
      if (cells.length > 0 && cells[cells.length - 1].text === '' && line.trimEnd().endsWith('|')) cells.pop()
      return cells
    }

    /** Split a table row into trimmed cell texts. */
    function splitTableRow(line) {
      return splitTableRowCells(line).map((cell) => cell.text)
    }

    /** Whether a line opens a block that cannot continue a paragraph. */
    function startsBlock(line) {
      return (
        FENCE_OPEN.test(line) ||
        ATX_HEADING.test(line) ||
        THEMATIC_BREAK.test(line) ||
        QUOTE_LINE.test(line) ||
        LIST_ITEM.test(line)
      )
    }

    /** Whether a table line is the `|---|---|` delimiter row. */
    function isTableDelimiter(line) {
      return /^[ \t]{0,3}\|?[ \t]*:?-+/.test(line)
    }

    /**
     * Rebuild one table line from cell texts, keeping its pipe style.
     * @param line - the original line, for indent and edge pipes.
     * @param cells - the cell texts to lay out.
     * @returns the rebuilt line.
     */
    function rebuildTableLine(line, cells) {
      const indent = /^[ \t]*/.exec(line)[0]
      const leading = line.trimStart().startsWith('|')
      const trailing = line.trimEnd().endsWith('|')
      const body = cells.map((cell) => ` ${cell} `).join('|')
      return `${indent}${leading ? '|' : ''}${body}${trailing ? '|' : ''}`
    }

    /**
     * Where a caret sits in a table: which row and which cell.
     * @param raw - the table block source.
     * @param caret - caret offset in `raw`.
     * @returns the row index and column index, both clamped into range.
     */
    function tablePosition(raw, caret) {
      const lines = raw.split('\n')
      const starts = []
      let cursor = 0
      for (const line of lines) {
        starts.push(cursor)
        cursor += line.length + 1
      }
      let row = lines.length - 1
      for (let index = 0; index < lines.length; index += 1) {
        if (caret <= starts[index] + lines[index].length) {
          row = index
          break
        }
      }
      const before = raw.slice(starts[row], Math.max(starts[row], caret))
      const column = Math.max(0, before.split('|').length - 2)
      return { row, column, lines, starts }
    }

    /**
     * Add or remove a table row or column around the caret.
     * @param raw - the table block source.
     * @param caret - caret offset in `raw`.
     * @param operation - `row-after`/`row-before`, `col-after`/`col-before`, `row-delete` or `col-delete`.
     * @returns the new source and caret, or null when the table cannot shrink.
     */
    function tableOperation(raw, caret, operation) {
      const position = tablePosition(raw, caret)
      const lines = position.lines.slice()
      const rowIndex = position.row
      const target = lines[rowIndex]
      if (target === undefined) return null
      const cells = splitTableRow(target).slice()
      const column = Math.min(position.column, Math.max(0, cells.length - 1))

      // The alignment a freshly inserted column should inherit.
      const neighbourAlignment = (line, at) => {
        const own = splitTableRowCells(line)
        const neighbour = own[Math.min(at, own.length - 1)]
        if (neighbour === undefined) return null
        if (/^\s*:.*:\s*$/.test(neighbour.text)) return 'center'
        if (/^\s*:/.test(neighbour.text)) return 'left'
        if (/:\s*$/.test(neighbour.text)) return 'right'
        return null
      }
      const insertColumn = (at) => {
        for (let index = 0; index < lines.length; index += 1) {
          const own = splitTableRow(lines[index])
          if (own.length === 0) continue
          const filler = isTableDelimiter(lines[index])
            ? alignmentCell(neighbourAlignment(lines[index], column), 3)
            : ''
          own.splice(Math.min(at, own.length), 0, filler)
          lines[index] = rebuildTableLine(lines[index], own)
        }
      }

      let caretRow = rowIndex
      let caretColumn = column
      if (operation === 'row-after' || operation === 'row-before') {
        const blank = cells.map(() => '')
        const at = operation === 'row-after' ? rowIndex + 1 : rowIndex
        lines.splice(at, 0, rebuildTableLine(target, blank))
        caretRow = at
      } else if (operation === 'col-after' || operation === 'col-before') {
        if (operation === 'col-after') insertColumn(column + 1)
        else insertColumn(column)
      } else if (operation === 'row-delete') {
        if (lines.length <= 2) return null
        lines.splice(rowIndex, 1)
      } else if (operation === 'col-delete') {
        if (cells.length <= 1) return null
        for (let index = 0; index < lines.length; index += 1) {
          const own = splitTableRow(lines[index])
          if (own.length === 0) continue
          own.splice(Math.min(column, own.length - 1), 1)
          lines[index] = rebuildTableLine(lines[index], own)
        }
      } else {
        return null
      }

      const value = lines.join('\n')
      // Put the caret in the same column on the row the edit left behind.
      const bounded = Math.max(0, Math.min(caretRow, lines.length - 1))
      const rowStart = lines.slice(0, bounded).reduce((sum, line) => sum + line.length + 1, 0)
      const line = lines[bounded] ?? ''
      let offset = 0
      let pipes = 0
      const wanted = Math.min(caretColumn, Math.max(0, splitTableRow(line).length - 1))
      while (offset < line.length && pipes <= wanted) {
        if (line[offset] === '|') pipes += 1
        offset += 1
      }
      while (offset < line.length && (line[offset] === ' ' || line[offset] === '\t')) offset += 1
      return { value, caret: rowStart + offset }
    }

    /**
     * A delimiter cell of the given alignment and dash width, mirroring the
     * reference's own builder so colons sit exactly where it puts them.
     * @param align - `left`, `center`, `right` or null.
     * @param width - wanted dash count, at least three.
     * @returns the cell text.
     */
    function alignmentCell(align, width) {
      const size = Math.max(3, width)
      if (align === 'right') return `${'-'.repeat(size - 1)}:`
      if (align === 'center') return `:${'-'.repeat(size - 2)}:`
      if (align === 'left') return `:${'-'.repeat(size - 1)}`
      return '-'.repeat(size)
    }

    /**
     * Re-aim one column's alignment by rewriting only the colons of its
     * delimiter cell. The dash run and the cell's outer padding are kept, so
     * the column does not shift while it is being re-aimed.
     * @param raw - the table block source.
     * @param caret - caret offset in `raw`.
     * @param align - `left`, `center` or `right`.
     * @returns the new source and caret, or null outside a table.
     */
    function setColumnAlignment(raw, caret, align) {
      const position = tablePosition(raw, caret)
      const lines = position.lines.slice()
      const delimiter = lines[1]
      if (delimiter === undefined || !isTableDelimiter(delimiter)) return null
      const cells = splitTableRowCells(delimiter)
      const column = Math.min(position.column, cells.length - 1)
      const cell = cells[column]
      if (cell === undefined) return null
      const original = delimiter.slice(cell.from, cell.to)
      const lead = /^[ \t]*/.exec(original)[0]
      const tail = /[ \t]*$/.exec(original)[0]
      const dashes = Math.max(3, (original.match(/-/g) ?? []).length)
      const body = alignmentCell(align, dashes)
      lines[1] = delimiter.slice(0, cell.from) + lead + body + tail + delimiter.slice(cell.to)
      const value = lines.join('\n')
      const rowStart = lines.slice(0, 1).reduce((sum, line) => sum + line.length + 1, 0)
      return { value, caret: rowStart + cell.from + lead.length + body.length }
    }

    /** Detect a pipe table whose delimiter row follows at `index`. */
    function tableAt(lines, index) {
      const head = lines[index].text
      if (!head.includes('|')) return null
      const next = lines[index + 1]
      if (next === undefined || !next.text.includes('-') || !TABLE_DELIMITER.test(next.text)) return null
      const align = splitTableRow(next.text).map((cell) => {
        const left = cell.startsWith(':')
        const right = cell.endsWith(':')
        return left && right ? 'center' : right ? 'right' : left ? 'left' : null
      })
      const rows = []
      const rowMeta = []
      let cursor = index + 2
      while (cursor < lines.length) {
        const text = lines[cursor].text
        if (isBlankLine(text) || !text.includes('|') || startsBlock(text)) break
        rows.push(splitTableRow(text))
        rowMeta.push({ from: lines[cursor].start, cells: splitTableRowCells(text) })
        cursor += 1
      }
      return {
        header: splitTableRow(head),
        align,
        rows,
        rowMeta: [{ from: lines[index].start, cells: splitTableRowCells(head) }, ...rowMeta],
        endIndex: cursor - 1,
      }
    }

    /**
     * Parse a document into blocks that reference their source range.
     * @param text - the document.
     * @returns block records in document order.
     */
    function parseBlocks(text) {
      const lines = listLines(text)
      const blocks = []
      const push = (type, from, to, extra) => blocks.push(Object.assign({ type, from, to }, extra))
      let index = 0

      while (index < lines.length) {
        const line = lines[index]
        const raw = line.text

        if (isBlankLine(raw)) {
          // A zero-width blank is the empty tail after a trailing newline; it
          // has no visual height and no source text of its own.
          if (line.end > line.start) push('blank', line.start, line.end)
          index += 1
          continue
        }

        const fence = FENCE_OPEN.exec(raw)
        if (fence) {
          const marker = fence[1]
          const lang = fence[2].trim().split(/[ \t]/)[0]
          const closer = new RegExp(`^[ \\t]{0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`)
          const body = []
          let cursor = index + 1
          let closed = false
          while (cursor < lines.length) {
            if (closer.test(lines[cursor].text)) {
              closed = true
              break
            }
            body.push(lines[cursor].text)
            cursor += 1
          }
          const lastLine = closed ? cursor : lines.length - 1
          push('code', line.start, lines[lastLine].end, { lang, value: body.join('\n') })
          index = lastLine + 1
          continue
        }

        if (index === 0 && /^[ \t]{0,3}---[ \t]*$/.test(raw)) {
          const body = []
          let cursor = index + 1
          let closed = false
          while (cursor < lines.length) {
            if (/^[ \t]{0,3}---[ \t]*$/.test(lines[cursor].text)) {
              closed = true
              break
            }
            body.push(lines[cursor].text)
            cursor += 1
          }
          if (closed) {
            push('meta', line.start, lines[cursor].end, { value: body.join('\n') })
            index = cursor + 1
            continue
          }
        }

        if (/^[ \t]{0,3}\$\$/.test(raw)) {
          const opening = raw.replace(/^[ \t]{0,3}/, '')
          const inline = /^\$\$([\s\S]*?)\$\$[ \t]*$/.exec(opening)
          if (inline !== null) {
            push('math', line.start, line.end, { value: inline[1].trim() })
            index += 1
            continue
          }
          const body = [opening.slice(2)]
          let cursor = index + 1
          let closed = false
          while (cursor < lines.length) {
            const text = lines[cursor].text
            const closing = text.indexOf('$$')
            if (closing >= 0) {
              body.push(text.slice(0, closing))
              closed = true
              break
            }
            body.push(text)
            cursor += 1
          }
          const lastLine = closed ? cursor : lines.length - 1
          push('math', line.start, lines[lastLine].end, { value: body.join('\n').trim() })
          index = lastLine + 1
          continue
        }

        const heading = ATX_HEADING.exec(raw)
        if (heading) {
          const value = (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '')
          push('heading', line.start, line.end, { level: heading[1].length, value })
          index += 1
          continue
        }

        if (THEMATIC_BREAK.test(raw)) {
          push('hr', line.start, line.end)
          index += 1
          continue
        }

        if (QUOTE_LINE.test(raw)) {
          const parts = []
          let cursor = index
          while (cursor < lines.length && QUOTE_LINE.test(lines[cursor].text)) {
            parts.push(lines[cursor].text.replace(/^[ \t]{0,3}>[ \t]?/, ''))
            cursor += 1
          }
          // `> [!NOTE]` on the first line turns the quote into a callout.
          const marker = /^[ \t]*\[!(note|tip|important|warning|caution)\][ \t]*$/i.exec(parts[0] ?? '')
          if (marker !== null) {
            parts.shift()
            push('alert', line.start, lines[cursor - 1].end, {
              alert: marker[1].toLowerCase(),
              lines: parts,
            })
          } else {
            push('quote', line.start, lines[cursor - 1].end, { lines: parts })
          }
          index = cursor
          continue
        }

        if (/^[ \t]{0,3}<[a-zA-Z][a-zA-Z0-9]*[\s/>]/.test(raw)) {
          // An HTML block runs to its closing tag, or to the first blank line.
          const body = [raw]
          let cursor = index + 1
          const opened = /^[ \t]{0,3}<([a-zA-Z][a-zA-Z0-9]*)/.exec(raw)
          const name = opened === null ? '' : opened[1].toLowerCase()
          const closes = name === '' ? null : new RegExp(`</${name}\\s*>`, 'i')
          const singleLine = closes === null || closes.test(raw)
          if (!singleLine) {
            while (cursor < lines.length) {
              const text = lines[cursor].text
              if (isBlankLine(text)) break
              body.push(text)
              if (closes !== null && closes.test(text)) {
                cursor += 1
                break
              }
              cursor += 1
            }
          }
          push('html', line.start, lines[cursor - 1].end, { value: body.join('\n'), name })
          index = cursor
          continue
        }

        if (/^[ \t]{0,3}\[TOC\][ \t]*$/.test(raw)) {
          push('toc', line.start, line.end)
          index += 1
          continue
        }

        const footnote = /^[ \t]{0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/.exec(raw)

        const firstItem = LIST_ITEM.exec(raw)
        if (firstItem) {
          const items = []
          const ordered = /\d/.test(firstItem[2])
          const start = ordered ? Number.parseInt(firstItem[2], 10) : 1
          let cursor = index
          while (cursor < lines.length) {
            const text = lines[cursor].text
            const match = LIST_ITEM.exec(text)
            if (match) {
              // A different marker family starts a different list, so an
              // ordered run after unordered items is not swallowed here.
              if (/\d/.test(match[2]) !== ordered) break
              const indent = match[1].replace(/\t/g, '    ').length
              let value = match[3] ?? ''
              let task = null
              let taskFrom = null
              const taskMatch = TASK_MARK.exec(value)
              if (taskMatch) {
                task = taskMatch[1].toLowerCase() === 'x' ? 'checked' : 'unchecked'
                value = taskMatch[2]
                const bracket = lines[cursor].text.indexOf('[', match[1].length + match[2].length)
                if (bracket >= 0) taskFrom = lines[cursor].start + bracket
              }
              items.push({ indent, ordered, value, task, taskFrom })
              cursor += 1
              continue
            }
            if (isBlankLine(text)) {
              const lookahead = cursor + 1 < lines.length ? LIST_ITEM.exec(lines[cursor + 1].text) : null
              if (lookahead !== null && /\d/.test(lookahead[2]) === ordered) {
                cursor += 1
                continue
              }
              break
            }
            if (/^[ \t]+/.test(text) && items.length > 0) {
              items[items.length - 1].value += `\n${text.trim()}`
              cursor += 1
              continue
            }
            break
          }
          push('list', line.start, lines[cursor - 1].end, { ordered, start, pattern: firstItem[2][0], items })
          index = cursor
          continue
        }

        if (footnote !== null) {
          const body = [footnote[2]]
          let cursor = index + 1
          while (cursor < lines.length && /^[ \t]{2,}\S/.test(lines[cursor].text)) {
            body.push(lines[cursor].text.trim())
            cursor += 1
          }
          push('footnote', line.start, lines[cursor - 1].end, {
            id: footnote[1],
            value: body.join('\n'),
          })
          index = cursor
          continue
        }

        const table = tableAt(lines, index)
        if (table !== null) {
          push('table', line.start, lines[table.endIndex].end, {
            header: table.header,
            align: table.align,
            rows: table.rows,
            rowMeta: table.rowMeta,
          })
          index = table.endIndex + 1
          continue
        }

        const parts = []
        let cursor = index
        let setextLevel = 0
        while (cursor < lines.length) {
          const text = lines[cursor].text
          if (isBlankLine(text)) break
          if (parts.length > 0) {
            const setext = SETEXT.exec(text)
            if (setext) {
              setextLevel = setext[1][0] === '=' ? 1 : 2
              cursor += 1
              break
            }
            if (startsBlock(text) || tableAt(lines, cursor) !== null) break
          }
          parts.push(text)
          cursor += 1
        }
        const value = parts.join('\n')
        if (setextLevel > 0) {
          push('heading', line.start, lines[cursor - 1].end, { level: setextLevel, value: value.trim() })
        } else {
          push('paragraph', line.start, lines[cursor - 1].end, { value })
        }
        index = cursor
      }

      return blocks
    }

    /** Find an unescaped occurrence of `token` at or after `from`. */
    function findDelimiter(source, from, token) {
      let index = source.indexOf(token, from)
      while (index >= 0) {
        if (source[index - 1] !== '\\') return index
        index = source.indexOf(token, index + token.length)
      }
      return -1
    }

    /** Parse `[label](destination)` starting at the opening bracket. */
    function parseLinkAt(source, open) {
      let depth = 0
      let cursor = open
      while (cursor < source.length) {
        const char = source[cursor]
        if (char === '\\') {
          cursor += 2
          continue
        }
        if (char === '[') depth += 1
        else if (char === ']') {
          depth -= 1
          if (depth === 0) break
        }
        cursor += 1
      }
      if (cursor >= source.length || source[cursor] !== ']') return null
      if (source[cursor + 1] !== '(') return null
      const label = source.slice(open + 1, cursor)
      let close = cursor + 2
      let nesting = 1
      let destination = ''
      let quote = null
      while (close < source.length) {
        const char = source[close]
        if (quote !== null) {
          if (char === quote) quote = null
          destination += char
          close += 1
          continue
        }
        if (char === '"' || char === "'") {
          quote = char
          destination += char
          close += 1
          continue
        }
        if (char === '(') nesting += 1
        if (char === ')') {
          nesting -= 1
          if (nesting === 0) break
        }
        destination += char
        close += 1
      }
      if (close >= source.length) return null
      return { label, destination: destination.trim(), end: close + 1 }
    }

    /**
     * Resolve a relative path against the document's directory.
     * @param directory - directory of the open document, '' at the root.
     * @param relative - the reference as written in the document.
     * @returns a workspace-relative path.
     */
    function joinRelative(directory, relative) {
      const parts = directory === '' ? [] : directory.split('/')
      for (const segment of relative.split('/')) {
        if (segment === '' || segment === '.') continue
        if (segment === '..') parts.pop()
        else parts.push(segment)
      }
      return parts.join('/')
    }

    /**
     * Point one image at the host's raw route, so a workspace picture renders
     * in the preview instead of a broken icon.
     * @param source - the image source as written.
     * @param images - workspace root and document directory, or null.
     * @returns the URL to use.
     */
    function imageSource(source, images) {
      if (images === null || images === undefined) return source
      if (typeof images.root !== 'string' || images.root === '') return source
      let value = String(source)
      if (/^data:/i.test(value)) return value
      // `//host/x` is protocol-relative, not a workspace path.
      if (value.startsWith('//')) return `http:${value}`
      if (/^(https?|ftp):/i.test(value)) return value

      // The fragment stays a fragment; only the path part is looked up.
      const fragmentAt = value.indexOf('#')
      const fragment = fragmentAt >= 0 ? value.slice(fragmentAt) : ''
      if (fragmentAt >= 0) value = value.slice(0, fragmentAt)
      if (value === '') return source

      // Windows separators and a `file://` URL inside the workspace both have
      // to land on the same relative path.
      value = value.replace(/\\/g, '/')
      let rootRelative = false
      const fileScheme = /^file:\/\//i.exec(value)
      if (fileScheme !== null) {
        const absolute = decodeURIComponent(value.slice(fileScheme[0].length))
        const root = images.root.endsWith('/') ? images.root : `${images.root}/`
        if (!absolute.startsWith(root)) return `file:${absolute}${fragment}`
        value = absolute.slice(root.length)
        // Already root-relative: joining the document folder would double it.
        rootRelative = true
      }

      const relative = rootRelative
        ? value
        : value.startsWith('/')
          ? value.replace(/^\/+/, '')
          : joinRelative(typeof images.dir === 'string' ? images.dir : '', value)
      if (relative === '') return source
      const query = new URLSearchParams({ root: images.root, path: relative })
      return `${RAW_ROUTE}?${query.toString()}${fragment}`
    }

    /**
     * Split one text run around the current search query.
     * @param value - the rendered text.
     * @param highlight - query, current index and the running counter.
     * @param key - key prefix for this fragment.
     * @returns matched pieces, or null when nothing matches.
     */
    function highlightPieces(value, highlight, key) {
      if (highlight === null || highlight === undefined || highlight.query === '') return null
      const needle = highlight.query.toLowerCase()
      const haystack = value.toLowerCase()
      if (!haystack.includes(needle)) return null
      const out = []
      let cursor = 0
      let ordinal = 0
      while (cursor < value.length) {
        const found = haystack.indexOf(needle, cursor)
        if (found < 0) break
        if (found > cursor) out.push(value.slice(cursor, found))
        const current = highlight.counter.seen === highlight.index
        highlight.counter.seen += 1
        out.push(
          h(
            'mark',
            {
              key: `${key}-m${ordinal}`,
              className: current ? 'dcw-mark dcw-mark-current' : 'dcw-mark',
              'data-dcw-current': current ? 'true' : undefined,
            },
            value.slice(found, found + needle.length),
          ),
        )
        ordinal += 1
        cursor = found + needle.length
      }
      if (cursor < value.length) out.push(value.slice(cursor))
      return out
    }

    /** Unicode math alphabets: base code points plus the letters outside them. */
    const MATH_ALPHABETS = {
      bb: {
        upper: 0x1d538, lower: 0x1d552, digits: 0x1d7d8,
        overrides: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
      },
      cal: {
        upper: 0x1d49c, lower: 0x1d4b6,
        overrides: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
      },
      frak: {
        upper: 0x1d504, lower: 0x1d51e,
        overrides: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
      },
    }

    /**
     * Map one run of letters onto a Unicode maths alphabet.
     * @param text - the letters to transform.
     * @param alphabet - `bb`, `cal` or `frak`.
     * @returns the transformed text; letters without a glyph are left alone.
     */
    function mathAlphabet(text, alphabet) {
      const spec = MATH_ALPHABETS[alphabet]
      if (spec === undefined) return text
      let out = ''
      for (const char of String(text)) {
        const override = spec.overrides[char]
        if (override !== undefined) {
          out += String.fromCodePoint(override)
          continue
        }
        const upper = char >= 'A' && char <= 'Z'
        const lower = char >= 'a' && char <= 'z'
        const digit = char >= '0' && char <= '9'
        if (upper) out += String.fromCodePoint(spec.upper + (char.charCodeAt(0) - 65))
        else if (lower) out += String.fromCodePoint(spec.lower + (char.charCodeAt(0) - 97))
        else if (digit && spec.digits !== undefined) out += String.fromCodePoint(spec.digits + Number(char))
        else out += char
      }
      return out
    }

    /** Font commands and the class each one renders with. */
    const TEX_FONTS = {
      mathbb: { alphabet: 'bb', className: 'dcw-tex-bb' },
      Bbb: { alphabet: 'bb', className: 'dcw-tex-bb' },
      mathcal: { alphabet: 'cal', className: 'dcw-tex-cal' },
      mathscr: { alphabet: 'cal', className: 'dcw-tex-cal' },
      cal: { alphabet: 'cal', className: 'dcw-tex-cal' },
      scr: { alphabet: 'cal', className: 'dcw-tex-cal' },
      mathfrak: { alphabet: 'frak', className: 'dcw-tex-frak' },
      frak: { alphabet: 'frak', className: 'dcw-tex-frak' },
      mathsf: { className: 'dcw-tex-sf' },
      sf: { className: 'dcw-tex-sf' },
      mathtt: { className: 'dcw-tex-tt' },
      tt: { className: 'dcw-tex-tt' },
      mathbf: { className: 'dcw-tex-bold' },
      boldsymbol: { className: 'dcw-tex-bold' },
      bm: { className: 'dcw-tex-bold' },
      pmb: { className: 'dcw-tex-bold' },
      mathit: { className: 'dcw-tex-it' },
      mathnormal: { className: 'dcw-tex-it' },
      mathrm: { className: 'dcw-tex-up' },
      mathup: { className: 'dcw-tex-up' },
      rm: { className: 'dcw-tex-up' },
      it: { className: 'dcw-tex-it' },
    }

    /** Text-mode commands: upright with a weight or style. */
    const TEX_TEXT_FONTS = {
      text: '',
      textrm: 'dcw-tex-up',
      textnormal: 'dcw-tex-up',
      textup: 'dcw-tex-up',
      textbf: 'dcw-tex-bold',
      textit: 'dcw-tex-textit',
      textsf: 'dcw-tex-sf',
      texttt: 'dcw-tex-tt',
      mbox: 'dcw-tex-up',
      hbox: 'dcw-tex-up',
    }

    /**
     * Accept only colours a formula may use: hex literals and CSS names.
     * Anything else (a URL, a function call) is refused so a formula cannot
     * smuggle style out of the document.
     * @param value - the colour token from the source.
     * @returns a safe colour, or null.
     */
    function safeColor(value) {
      const text = String(value ?? '').trim()
      if (text === '') return null
      if (/^#[0-9a-f]{3,8}$/i.test(text)) return text
      if (/^[a-z]{3,20}$/i.test(text)) return text
      if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(text)) return text
      return null
    }

    /** Colours registered with `\\definecolor` inside one formula. */
    const TEX_COLORS = new Map()

    /** Arrows a chemistry formula may carry. */
    const CHEM_ARROWS = {
      '<=>': '⇌',
      '->>': '⟶',
      '-->': '⟶',
      '->': '→',
      '<-': '←',
      '=': '=',
    }

    /**
     * Render one `\ce{…}` formula: element digits become subscripts, `^`
     * charges become superscripts and arrow tokens become arrow glyphs.
     * @param source - the chemistry source.
     * @returns React children.
     */
    function renderChem(source) {
      const text = String(source ?? '')
      const out = []
      let index = 0
      let key = 0
      while (index < text.length) {
        const rest = text.slice(index)
        const arrow = Object.keys(CHEM_ARROWS).find((token) => rest.startsWith(token))
        if (arrow !== undefined) {
          out.push(h('span', { key: `a${key}`, className: 'dcw-tex-g' }, CHEM_ARROWS[arrow]))
          key += 1
          index += arrow.length
          continue
        }
        const char = text[index]
        if (char === '^') {
          // `^2+` or `^{2+}` becomes a superscript charge.
          const braced = /^\^\{([^}]*)\}/.exec(rest)
          if (braced !== null) {
            out.push(h('sup', { key: `s${key}` }, braced[1]))
            key += 1
            index += braced[0].length
            continue
          }
          const plain = /^\^([0-9+\-]+)/.exec(rest)
          if (plain !== null) {
            out.push(h('sup', { key: `s${key}` }, plain[1]))
            key += 1
            index += plain[0].length
            continue
          }
          out.push(h('sup', { key: `s${key}` }, '^'))
          key += 1
          index += 1
          continue
        }
        if (char === '_') {
          const braced = /^_\{([^}]*)\}/.exec(rest)
          if (braced !== null) {
            out.push(h('sub', { key: `b${key}` }, braced[1]))
            key += 1
            index += braced[0].length
            continue
          }
          out.push(h('sub', { key: `b${key}` }, ' '))
          key += 1
          index += 1
          continue
        }
        if (/[0-9]/.test(char) && index > 0 && /[A-Za-z)]/.test(text[index - 1])) {
          const digits = /^[0-9]+/.exec(rest)[0]
          out.push(h('sub', { key: `d${key}` }, digits))
          key += 1
          index += digits.length
          continue
        }
        if (char === '*') {
          out.push(h('span', { key: `t${key}`, className: 'dcw-tex-g' }, '·'))
          key += 1
          index += 1
          continue
        }
        // Letters run upright, the way chemistry is typeset.
        let end = index
        while (end < text.length && /[A-Za-z]/.test(text[end])) end += 1
        if (end > index) {
          out.push(h('span', { key: `l${key}`, className: 'dcw-tex-up' }, text.slice(index, end)))
          key += 1
          index = end
          continue
        }
        out.push(h('span', { key: `o${key}` }, char))
        key += 1
        index += 1
      }
      return out
    }

    /** Delimiters that `\big` and friends scale up. */
    const BIG_FENCES = { big: 'big', Big: 'big2', bigg: 'big3', Bigg: 'big4', bigl: 'big', bigr: 'big', Bigl: 'big2', Bigr: 'big2', biggl: 'big3', biggr: 'big3', Biggl: 'big4', Biggr: 'big4', bigm: 'big2', Bigm: 'big2' }

    /** Relations and symbols the reference defines that we render as glyphs. */
    const TEX_RELATIONS = {
      iff: '⟺',
      implies: '⟹',
      impliedby: '⟸',
      lnot: '¬',
      neg: '¬',
      colon: ':',
      bmod: 'mod',
      mod: 'mod',
      dots: '…',
      ldots: '…',
      cdots: '⋯',
      vdots: '⋮',
      ddots: '⋱',
      ldotp: '.',
      cdotp: '·',
      ast: '∗',
      flat: '♭',
      sharp: '♯',
      clubsuit: '♣',
      diamondsuit: '♦',
      heartsuit: '♥',
      spadesuit: '♠',
    }

    /** Accents the reference exposes beyond the ones we already had. */
    const TEX_EXTRA_ACCENTS = { breve: '\u0306', dddot: '\u20db', ddddot: '\u20dc', mathring: '\u030a' }

    /* ---- a TeX subset: enough for luminance, ratios and Greek symbols ---- */

    /** Control sequences that become one Unicode glyph. */
    const TEX_GLYPHS = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
      zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
      nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
      phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
      Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
      times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤',
      ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼', propto: '∝',
      infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫',
      to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
      Rightarrow: '⇒', in: '∈', notin: '∉', forall: '∀', exists: '∃',
      degree: '°', prime: '′', ell: 'ℓ', hbar: 'ℏ', ldots: '…', cdots: '⋯',
      angle: '∠', perp: '⊥', parallel: '∥', circ: '∘', star: '⋆',
    }

    /**
     * Split TeX into tokens: commands, braces, scripts, numbers and characters.
     * @param source - the formula source.
     * @returns tokens in order.
     */
    function texTokens(source) {
      const tokens = []
      let index = 0
      while (index < source.length) {
        const char = source[index]
        if (char === '\\') {
          const command = /^\\[a-zA-Z]+/.exec(source.slice(index))
          if (command !== null) {
            tokens.push({ kind: 'command', name: command[0].slice(1) })
            index += command[0].length
            continue
          }
          if (source[index + 1] === '\\') {
            tokens.push({ kind: 'rowbreak' })
            index += 2
            continue
          }
          // `\,` `\;` `\:` `\!` are spacing commands, `\{` `\$` are literals.
          if (',;:! '.includes(source[index + 1] ?? '')) {
            tokens.push({ kind: 'command', name: source[index + 1] })
            index += 2
            continue
          }
          tokens.push({ kind: 'text', value: source[index + 1] ?? '\\' })
          index += 2
          continue
        }
        if (char === '{' || char === '}' || char === '^' || char === '_') {
          tokens.push({ kind: char })
          index += 1
          continue
        }
        if (/\s/.test(char)) {
          tokens.push({ kind: 'space' })
          index += 1
          continue
        }
        const number = /^[0-9]+(?:\.[0-9]+)?/.exec(source.slice(index))
        if (number !== null) {
          tokens.push({ kind: 'text', value: number[0] })
          index += number[0].length
          continue
        }
        tokens.push({ kind: 'text', value: char })
        index += 1
      }
      return tokens
    }

    /**
     * Parse one formula into a node tree. Unknown commands degrade to their
     * own name so nothing silently disappears.
     * @param source - the formula source.
     * @returns nodes for the renderer.
     */
    function parseTex(source) {
      const tokens = texTokens(source)
      let position = 0

      const parseArgument = (textMode = false) => {
        const token = tokens[position]
        if (token === undefined) return []
        if (token.kind === '{') {
          position += 1
          const nodes = parseList(true)
          // Inside a text command, spaces must survive as spaces.
          return textMode ? nodes.map((node) => (node.kind === 'gap' ? { kind: 'space' } : node)) : nodes
        }
        position += 1
        if (token.kind === 'command') return [parseCommand(token)]
        return [{ kind: 'text', value: token.value ?? '' }]
      }

      const ACCENTS = { hat: '\u0302', bar: '\u0304', vec: '\u20d7', tilde: '\u0303', dot: '\u0307', ddot: '\u0308', check: '\u030c', acute: '\u0301', grave: '\u0300' }
      const SPACES = { ',': '0.17em', ':': '0.22em', ';': '0.28em', '!': '-0.17em', quad: '1em', qquad: '2em', enspace: '0.5em' }
      const FENCES = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': '', '{': '{', '}': '}', '<': '⟨', '>': '⟩' }

      /**
       * Parse `\begin{env} … \end{env}` into rows of cells.
       * `&` ends a cell, `\\` ends a row.
       * @param name - the environment name.
       * @returns an environment node.
       */
      const parseEnvironment = (name) => {
        const rows = []
        let row = []
        let cell = []
        const pushCell = () => {
          row.push(cell)
          cell = []
        }
        const pushRow = () => {
          pushCell()
          rows.push(row)
          row = []
        }
        while (position < tokens.length) {
          const token = tokens[position]
          if (token.kind === 'command' && token.name === 'end') {
            position += 1
            if (tokens[position] !== undefined && tokens[position].kind === '{') {
              position += 1
              while (position < tokens.length && tokens[position].kind !== '}') position += 1
              position += 1
            }
            break
          }
          if (token.kind === 'rowbreak') {
            position += 1
            pushRow()
            continue
          }
          if (token.kind === 'text' && token.value === '&') {
            position += 1
            pushCell()
            continue
          }
          if (token.kind === '{') {
            position += 1
            cell.push({ kind: 'group', children: parseList(true) })
            continue
          }
          if (token.kind === 'command') {
            position += 1
            cell.push(parseCommand(token))
            continue
          }
          position += 1
          if (token.kind === 'space') continue
          cell.push({ kind: 'text', value: token.value ?? '' })
        }
        pushRow()
        // Drop the empty row a trailing `\\` leaves behind.
        if (rows.length > 1 && rows[rows.length - 1][0].length === 0) rows.pop()
        return { kind: 'env', name: name.toLowerCase(), rows }
      }

      /**
       * Read one braced argument as raw source text, without TeX semantics.
       * `\ce{H2O^2-}` must keep its carets instead of becoming scripts.
       * @returns the raw text inside the braces.
       */
      const parseRawArgument = () => {
        if (tokens[position] === undefined || tokens[position].kind !== '{') return ''
        position += 1
        let raw = ''
        let depth = 1
        while (position < tokens.length) {
          const token = tokens[position]
          if (token.kind === '{') {
            depth += 1
            raw += '{'
            position += 1
            continue
          }
          if (token.kind === '}') {
            depth -= 1
            position += 1
            if (depth === 0) break
            raw += '}'
            continue
          }
          position += 1
          if (token.kind === 'command') raw += `\\${token.name}`
          else if (token.kind === 'space') raw += ' '
          else if (token.kind === 'rowbreak') raw += '\\\\'
          else raw += token.value ?? token.kind
        }
        return raw
      }

      /**
       * Read one `{colour}` argument and resolve it through \definecolor.
       * @returns a safe colour or null.
       */
      const parseColorArgument = () => {
        const raw = parseArgument().map((node) => node.value ?? '').join('').trim()
        const resolved = TEX_COLORS.get(raw) ?? safeColor(raw)
        return resolved
      }

      const parseCommand = (token) => {
        const name = token.name
        if (TEX_GLYPHS[name] !== undefined) return { kind: 'glyph', value: TEX_GLYPHS[name] }
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          return { kind: 'frac', numerator: parseArgument(), denominator: parseArgument() }
        }
        if (name === 'sqrt') {
          // `\sqrt[3]{x}` keeps the index as a small prefix.
          if (tokens[position] !== undefined && tokens[position].kind === 'text' && tokens[position].value === '[') {
            position += 1
            const index = []
            while (position < tokens.length && !(tokens[position].kind === 'text' && tokens[position].value === ']')) {
              const token = tokens[position]
              position += 1
              if (token.kind === 'command') index.push(parseCommand(token))
              else if (token.kind !== 'space') index.push({ kind: 'text', value: token.value ?? '' })
            }
            position += 1
            return { kind: 'sqrt', index, children: parseArgument() }
          }
          return { kind: 'sqrt', children: parseArgument() }
        }
        if (TEX_FONTS[name] !== undefined) {
          const spec = TEX_FONTS[name]
          return { kind: 'texfont', spec, children: parseArgument() }
        }
        if (TEX_TEXT_FONTS[name] !== undefined) {
          return { kind: 'textrun', className: TEX_TEXT_FONTS[name], children: parseArgument(true) }
        }
        if (name === 'operatorname') {
          const star = tokens[position] !== undefined && tokens[position].kind === 'text' && tokens[position].value === '*'
          if (star) position += 1
          return { kind: 'upright', children: parseArgument() }
        }
        if (BIG_FENCES[name] !== undefined) {
          const next = tokens[position]
          if (next !== undefined && next.kind === 'text') {
            position += 1
            return { kind: 'bigfence', size: BIG_FENCES[name], value: FENCES[next.value] ?? next.value }
          }
          return { kind: 'none' }
        }
        if (TEX_RELATIONS[name] !== undefined) {
          return { kind: 'glyph', value: TEX_RELATIONS[name] }
        }
        if (TEX_EXTRA_ACCENTS[name] !== undefined) {
          return { kind: 'accent', mark: TEX_EXTRA_ACCENTS[name], children: parseArgument() }
        }
        if (name === 'textcolor') {
          const colour = parseColorArgument()
          return { kind: 'colored', color: colour, children: parseArgument() }
        }
        if (name === 'color') {
          const colour = parseColorArgument()
          return { kind: 'colorSwitch', color: colour }
        }
        if (name === 'colorbox') {
          const colour = parseColorArgument()
          return { kind: 'colorbox', color: colour, children: parseArgument() }
        }
        if (name === 'fcolorbox') {
          const border = parseColorArgument()
          const background = parseColorArgument()
          return { kind: 'colorbox', color: background, border, children: parseArgument() }
        }
        if (name === 'definecolor') {
          // \definecolor{name}{model}{value} — remember it for later references.
          const named = parseArgument().map((node) => node.value ?? '').join('').trim()
          parseArgument()
          const raw = parseArgument().map((node) => node.value ?? '').join('').trim()
          const parts = raw.split(',').map((part) => Number.parseInt(part, 10))
          if (named !== '' && parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
            const clamp = (part) => Math.max(0, Math.min(255, part))
            const hex = `#${parts.map((part) => clamp(part).toString(16).padStart(2, '0')).join('')}`
            TEX_COLORS.set(named, hex)
          }
          return { kind: 'none' }
        }
        if (name === 'ce' || name === 'pu') {
          return { kind: 'chem', value: parseRawArgument() }
        }
        if (name === 'tag') {
          return { kind: 'tag', value: parseArgument().map((node) => node.value ?? '').join('').trim() }
        }
        if (name === 'notag' || name === 'nonumber') {
          return { kind: 'notag' }
        }
        if (name === 'boxed' || name === 'fbox' || name === 'framebox') {
          return { kind: 'boxed', children: parseArgument() }
        }
        if (name === 'overbrace' || name === 'underbrace' || name === 'overparen' || name === 'underparen') {
          return { kind: name, children: parseArgument() }
        }
        if (name === 'substack') {
          // `\substack{a \\ b}` is a centred single-column stack.
          const rows = []
          let row = []
          if (tokens[position] !== undefined && tokens[position].kind === '{') position += 1
          while (position < tokens.length) {
            const token = tokens[position]
            if (token.kind === '}') {
              position += 1
              break
            }
            if (token.kind === 'rowbreak') {
              position += 1
              rows.push(row)
              row = []
              continue
            }
            if (token.kind === '{') {
              position += 1
              row.push({ kind: 'group', children: parseList(true) })
              continue
            }
            if (token.kind === 'command') {
              position += 1
              row.push(parseCommand(token))
              continue
            }
            position += 1
            if (token.kind === 'space') continue
            row.push({ kind: 'text', value: token.value ?? '' })
          }
          rows.push(row)
          return { kind: 'substack', rows }
        }
        if (name === 'mathclap' || name === 'mathllap' || name === 'mathrlap' || name === 'clap' || name === 'llap' || name === 'rlap') {
          const align = name.endsWith('llap') ? 'left' : name.endsWith('rlap') ? 'right' : 'center'
          return { kind: 'lap', align, children: parseArgument() }
        }
        if (name === 'stackrel') {
          return { kind: 'overset', over: parseArgument(), children: parseArgument() }
        }
        if (name === 'overunderset') {
          const over = parseArgument()
          const under = parseArgument()
          return { kind: 'overunderset', over, under, children: parseArgument() }
        }
        if (name === 'smash' || name === 'strut' || name === 'mathstrut') {
          return { kind: name === 'smash' ? 'smash' : 'phantom', children: name === 'smash' ? parseArgument() : [] }
        }
        if (name === 'hspace' || name === 'kern' || name === 'mkern' || name === 'mspace' || name === 'mskip' || name === 'hskip') {
          const amount = parseArgument()
          const text = amount.map((node) => node.value ?? '').join('')
          return { kind: 'gap', width: /^[0-9.]+(em|ex|pt|mu)$/.test(text) ? text : '0.5em' }
        }
        if (name === 'thinspace' || name === 'negthinspace' || name === 'enspace') {
          return { kind: 'gap', width: name === 'enspace' ? '0.5em' : name === 'negthinspace' ? '-0.17em' : '0.17em' }
        }
        if (name === 'pmod') {
          return { kind: 'pmod', children: parseArgument() }
        }
        if (name === 'text' || name === 'mathrm') {
          return { kind: 'upright', children: parseArgument() }
        }
        if (ACCENTS[name] !== undefined) {
          return { kind: 'accent', mark: ACCENTS[name], children: parseArgument() }
        }
        if (name === 'mathbf' || name === 'bm' || name === 'boldsymbol') {
          return { kind: 'bold', children: parseArgument() }
        }
        if (name === 'begin') {
          const group = parseArgument()
          const envName = group.map((node) => node.value ?? '').join('')
          return parseEnvironment(envName)
        }
        if (name === 'binom' || name === 'choose' || name === 'dbinom' || name === 'tbinom') {
          // The reference defines these as Genfrac with thickness 0, i.e. no bar.
          return {
            kind: 'binom',
            top: parseArgument(),
            bottom: parseArgument(),
            size: name === 'tbinom' ? 'small' : name === 'dbinom' ? 'normal' : 'normal',
          }
        }
        if (name === 'genfrac') {
          // \genfrac{left}{right}{thickness}{style}{num}{den}
          const left = parseArgument()
          const right = parseArgument()
          const thickness = parseArgument()
          const style = parseArgument()
          const text = (nodes) => nodes.map((node) => node.value ?? '').join('')
          const thick = text(thickness).trim()
          return {
            kind: 'binom',
            open: text(left),
            close: text(right),
            rule: thick === '' ? true : thick !== '0' && thick !== '0pt',
            size: text(style).trim() === '0' ? 'normal' : text(style).trim() === '1' ? 'small' : 'normal',
            top: parseArgument(),
            bottom: parseArgument(),
          }
        }
        if (name === 'overline' || name === 'underline' || name === 'cancel' || name === 'sout') {
          return { kind: name, children: parseArgument() }
        }
        if (name === 'phantom' || name === 'hphantom' || name === 'vphantom') {
          return { kind: 'phantom', children: parseArgument() }
        }
        if (name === 'overset' || name === 'underset') {
          const over = parseArgument()
          return { kind: name, over, children: parseArgument() }
        }
        if (name === 'left' || name === 'right') {
          const next = tokens[position]
          if (next !== undefined && next.kind === 'text' && FENCES[next.value] !== undefined) {
            position += 1
            return { kind: 'fence', value: FENCES[next.value] }
          }
          return { kind: 'fence', value: '' }
        }
        if (SPACES[name] !== undefined) return { kind: 'gap', width: SPACES[name] }
        if (name === 'displaystyle' || name === 'textstyle') return { kind: 'none' }
        return { kind: 'upright', children: [{ kind: 'text', value: name }] }
      }

      const parseList = (stopAtBrace) => {
        const nodes = []
        while (position < tokens.length) {
          const token = tokens[position]
          if (token.kind === '}') {
            position += 1
            if (stopAtBrace) return nodes
            continue
          }
          if (token.kind === '{') {
            position += 1
            nodes.push({ kind: 'group', children: parseList(true) })
            continue
          }
          if (token.kind === '^' || token.kind === '_') {
            position += 1
            const base = nodes.pop()
            const children = parseArgument()
            nodes.push({ kind: token.kind === '^' ? 'sup' : 'sub', base: base ?? { kind: 'none' }, children })
            continue
          }
          if (token.kind === 'command') {
            position += 1
            nodes.push(parseCommand(token))
            continue
          }
          if (token.kind === 'space') {
            position += 1
            nodes.push({ kind: 'space' })
            continue
          }
          position += 1
          nodes.push({ kind: 'text', value: token.value ?? '' })
        }
        return nodes
      }

      return parseList(false)
    }

    /**
     * Render parsed TeX to React children.
     * @param nodes - output of parseTex.
     * @param prefix - key prefix.
     * @returns React children.
     */
    function renderTex(nodes, prefix) {
      const out = []
      let activeColor = null
      nodes.forEach((node, index) => {
        const key = `${prefix}-${index}`
        if (node.kind === 'colorSwitch') {
          // `\color{red}` tints everything after it in this list.
          activeColor = node.color
          return
        }
        if (node.kind === 'chem') {
          out.push(h('span', { key, className: 'dcw-tex-chem' }, renderChem(node.value)))
          return
        }
        if (node.kind === 'colored') {
          out.push(
            node.color === null
              ? h('span', { key }, renderTex(node.children, key))
              : h('span', { key, style: { color: node.color } }, renderTex(node.children, key)),
          )
          return
        }
        if (node.kind === 'colorbox') {
          const style = {}
          if (node.color !== null) style.background = node.color
          if (node.border !== undefined && node.border !== null) style.border = `1px solid ${node.border}`
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-colorbox', style: Object.keys(style).length === 0 ? undefined : style },
              renderTex(node.children, key),
            ),
          )
          return
        }
        if (node.kind === 'none') return
        if (activeColor !== null) {
          const inner = renderTex([node], `${key}-c`)
          out.push(h('span', { key, style: { color: activeColor } }, inner))
          return
        }
        if (node.kind === 'text') {
          out.push(h('span', { key, className: 'dcw-tex-t' }, node.value))
        } else if (node.kind === 'glyph') {
          out.push(h('span', { key, className: 'dcw-tex-g' }, node.value))
        } else if (node.kind === 'space') {
          out.push(h('span', { key, className: 'dcw-tex-sp' }, '\u2009'))
        } else if (node.kind === 'group') {
          out.push(h('span', { key }, renderTex(node.children, key)))
        } else if (node.kind === 'upright') {
          out.push(h('span', { key, className: 'dcw-tex-up' }, renderTex(node.children, key)))
        } else if (node.kind === 'bold') {
          out.push(h('span', { key, className: 'dcw-tex-bold' }, renderTex(node.children, key)))
        } else if (node.kind === 'sup' || node.kind === 'sub') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-script' },
              renderTex([node.base], `${key}-b`),
              h(node.kind === 'sup' ? 'sup' : 'sub', { key: `${key}-s` }, renderTex(node.children, `${key}-c`)),
            ),
          )
        } else if (node.kind === 'frac') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-frac' },
              h('span', { key: 'n', className: 'dcw-tex-num' }, renderTex(node.numerator, `${key}-n`)),
              h('span', { key: 'd', className: 'dcw-tex-den' }, renderTex(node.denominator, `${key}-d`)),
            ),
          )
        } else if (node.kind === 'rowbreak') {
          out.push(h('br', { key }))
        } else if (node.kind === 'gap') {
          out.push(h('span', { key, className: 'dcw-tex-gap', style: { width: node.width } }))
        } else if (node.kind === 'fence') {
          out.push(h('span', { key, className: 'dcw-tex-fence' }, node.value))
        } else if (node.kind === 'accent') {
          out.push(
            h('span', { key, className: 'dcw-tex-accent' }, renderTex(node.children, key), h('span', { key: 'm' }, node.mark)),
          )
        } else if (node.kind === 'overline' || node.kind === 'underline' || node.kind === 'cancel' || node.kind === 'sout') {
          const cls = { overline: 'dcw-tex-over', underline: 'dcw-tex-under', cancel: 'dcw-tex-cancel', sout: 'dcw-tex-cancel' }[node.kind]
          out.push(h('span', { key, className: cls }, renderTex(node.children, key)))
        } else if (node.kind === 'phantom') {
          out.push(h('span', { key, className: 'dcw-tex-phantom' }, renderTex(node.children, key)))
        } else if (node.kind === 'overset' || node.kind === 'underset') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-stack' },
              node.kind === 'overset' ? h('span', { key: 'o', className: 'dcw-tex-stacktop' }, renderTex(node.over, `${key}-o`)) : null,
              h('span', { key: 'b' }, renderTex(node.children, `${key}-b`)),
              node.kind === 'underset' ? h('span', { key: 'u', className: 'dcw-tex-stacktop' }, renderTex(node.over, `${key}-u`)) : null,
            ),
          )
        } else if (node.kind === 'binom') {
          const open = node.open === undefined ? '(' : node.open
          const close = node.close === undefined ? ')' : node.close
          const rule = node.rule === undefined ? false : node.rule
          out.push(
            h(
              'span',
              { key, className: `dcw-tex-binom${node.size === 'small' ? ' dcw-tex-small' : ''}` },
              open === '' ? null : h('span', { key: 'l', className: 'dcw-tex-fence' }, open),
              h(
                'span',
                { key: 'f', className: 'dcw-tex-stack' },
                h(
                  'span',
                  { key: 'n', className: rule ? 'dcw-tex-num' : 'dcw-tex-nobar' },
                  renderTex(node.top, `${key}-n`),
                ),
                h('span', { key: 'd', className: 'dcw-tex-den' }, renderTex(node.bottom, `${key}-d`)),
              ),
              close === '' ? null : h('span', { key: 'r', className: 'dcw-tex-fence' }, close),
            ),
          )
        } else if (node.kind === 'substack') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-substack' },
              node.rows.map((row, rowIndex) =>
                h('span', { key: `r${rowIndex}` }, renderTex(row, `${key}-r${rowIndex}`)),
              ),
            ),
          )
        } else if (node.kind === 'lap') {
          out.push(h('span', { key, className: `dcw-tex-lap dcw-tex-lap-${node.align}` }, renderTex(node.children, key)))
        } else if (node.kind === 'env') {
          const fence = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'] }[node.name]
          const inner = h(
            'table',
            { key: 't', className: 'dcw-tex-matrix' },
            h(
              'tbody',
              null,
              node.rows.map((row, rowIndex) =>
                h(
                  'tr',
                  { key: `r${rowIndex}` },
                  row.map((cell, cellIndex) =>
                    h('td', { key: `c${cellIndex}` }, renderTex(cell, `${key}-r${rowIndex}c${cellIndex}`)),
                  ),
                ),
              ),
            ),
          )
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-env' },
              fence === undefined ? null : h('span', { key: 'l', className: 'dcw-tex-fence' }, fence[0]),
              inner,
              fence === undefined ? null : h('span', { key: 'r', className: 'dcw-tex-fence' }, fence[1]),
            ),
          )
        } else if (node.kind === 'texfont') {
          const transformed = node.spec.alphabet === undefined
            ? renderTex(node.children, key)
            : node.children.map((child) =>
                child.kind === 'text'
                  ? h('span', { key: `${key}-f`, className: node.spec.className }, mathAlphabet(child.value, node.spec.alphabet))
                  : h('span', { key: `${key}-f` }, renderTex([child], `${key}-f`)),
              )
          out.push(h('span', { key, className: node.spec.className }, transformed))
        } else if (node.kind === 'textrun') {
          out.push(h('span', { key, className: node.className }, renderTex(node.children, key)))
        } else if (node.kind === 'boxed') {
          out.push(h('span', { key, className: 'dcw-tex-boxed' }, renderTex(node.children, key)))
        } else if (node.kind === 'overbrace' || node.kind === 'overparen' || node.kind === 'underbrace' || node.kind === 'underparen') {
          const glyph = node.kind.endsWith('paren') ? '⏜' : '⏞'
          const under = node.kind.startsWith('under')
          const label = h('span', { key: 'l', className: 'dcw-tex-brace' }, under ? '⏟' : glyph)
          out.push(
            h(
              'span',
              { key, className: under ? 'dcw-tex-understack' : 'dcw-tex-overstack' },
              under ? h('span', { key: 'b' }, renderTex(node.children, `${key}-b`)) : label,
              under ? label : h('span', { key: 'b' }, renderTex(node.children, `${key}-b`)),
            ),
          )
        } else if (node.kind === 'overunderset') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-stack' },
              h('span', { key: 'o', className: 'dcw-tex-stacktop' }, renderTex(node.over, `${key}-o`)),
              h('span', { key: 'b' }, renderTex(node.children, `${key}-b`)),
              h('span', { key: 'u', className: 'dcw-tex-stackbot' }, renderTex(node.under, `${key}-u`)),
            ),
          )
        } else if (node.kind === 'bigfence') {
          out.push(h('span', { key, className: `dcw-tex-fence dcw-tex-${node.size}` }, node.value))
        } else if (node.kind === 'pmod') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-pmod' },
              h('span', { key: 'l', className: 'dcw-tex-up' }, ' (mod '),
              renderTex(node.children, `${key}-c`),
              h('span', { key: 'r', className: 'dcw-tex-up' }, ')'),
            ),
          )
        } else if (node.kind === 'smash') {
          out.push(h('span', { key, className: 'dcw-tex-smash' }, renderTex(node.children, key)))
        } else if (node.kind === 'space') {
          out.push(h('span', { key, className: 'dcw-tex-sp' }, ' '))
        } else if (node.kind === 'sqrt') {
          out.push(
            h(
              'span',
              { key, className: 'dcw-tex-sqrt' },
              node.index === undefined
                ? null
                : h('span', { key: 'i', className: 'dcw-tex-rootindex' }, renderTex(node.index, `${key}-i`)),
              h('span', { key: 'r', className: 'dcw-tex-radical' }, '√'),
              h('span', { key: 'b', className: 'dcw-tex-radicand' }, renderTex(node.children, `${key}-b`)),
            ),
          )
        }
      })
      return out
    }

    /**
     * Pull `\tag{}` out of a formula and drop `\notag` markers.
     * @param nodes - parsed formula nodes.
     * @returns the remaining nodes and the tag text, if any.
     */
    function splitMathTag(nodes) {
      let tag = null
      let suppressed = false
      const walk = (list) =>
        list.flatMap((node) => {
          if (node.kind === 'tag') {
            if (tag === null) tag = node.value
            return []
          }
          if (node.kind === 'notag') {
            suppressed = true
            return []
          }
          if (Array.isArray(node.children)) {
            return [{ ...node, children: walk(node.children) }]
          }
          return [node]
        })
      const content = walk(nodes)
      return { content, tag: suppressed ? null : tag }
    }

    /**
     * Render one display formula with its number.
     * @param source - the formula source.
     * @returns the rendered body and the tag text.
     */
    function renderMathDisplay(source) {
      try {
        const parsed = parseTex(String(source))
        const split = splitMathTag(parsed)
        return { content: renderTex(split.content, 'tex'), tag: split.tag }
      } catch {
        return { content: [String(source)], tag: null }
      }
    }

    /**
     * Render one formula, falling back to its source when it cannot parse.
     * @param source - the formula source.
     * @returns React children.
     */
    function renderMath(source) {
      try {
        return renderTex(parseTex(String(source)), 'tex')
      } catch {
        return [String(source)]
      }
    }

    /** An `{width=…}` size group sits after an image and is not rendered. */
    const IMAGE_ATTRS = /^\{([^}]*)\}$/

    /** Inline HTML tags we render, mapped to the element they become. */
    const INLINE_TAGS = new Set([
      'a', 'abbr', 'b', 'br', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'ins', 'kbd',
      'mark', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup',
      'time', 'tt', 'u', 'var', 'wbr',
    ])

    /**
     * Parse one whitelisted inline tag starting at `index`.
     * @param source - the inline text.
     * @param index - offset of the `<`.
     * @returns the tag, its content end and the inner text, or null.
     */
    function inlineTagAt(source, index) {
      const match = /^<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\/?>/.exec(source.slice(index))
      if (match === null) return null
      const name = match[1].toLowerCase()
      if (!INLINE_TAGS.has(name)) return null
      const openEnd = index + match[0].length
      if (name === 'br' || name === 'wbr' || /\/>$/.test(match[0])) {
        return { name, attributes: match[2], inner: '', end: openEnd, selfClosing: true }
      }
      const close = new RegExp(`</${name}\\s*>`, 'i').exec(source.slice(openEnd))
      if (close === null) return null
      return {
        name,
        attributes: match[2],
        inner: source.slice(openEnd, openEnd + close.index),
        end: openEnd + close.index + close[0].length,
        selfClosing: false,
      }
    }

    /**
     * Keep only the attributes worth passing through.
     * @param raw - the attribute string.
     * @returns a props object.
     */
    function tagAttributes(raw) {
      const props = {}
      const pattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
      let match = pattern.exec(String(raw ?? ''))
      while (match !== null) {
        const name = match[1].toLowerCase()
        const value = match[3] ?? match[4] ?? ''
        if (name === 'class') props.className = value
        else if (name === 'title') props.title = value
        else if (name === 'href') props.href = value
        match = pattern.exec(raw)
      }
      return props
    }

    /**
     * Drop scripts and inline handlers from a raw HTML block.
     * @param html - the raw block source.
     * @returns the reduced HTML.
     */
    function sanitizeHtml(html) {
      return String(html ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    }

    /** Allow only schemes a document viewer can follow. */
    function safeUrl(value) {
      const url = String(value).trim()
      if (url === '') return null
      const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url)
      if (scheme === null) return url
      // `data:` covers inline images, `file:` local ones the host may resolve.
      return /^(https?|mailto|data|file|ftp)$/i.test(scheme[1]) ? url : null
    }

    /**
     * Tokenize one block's inline markdown.
     * @param source - the block's text, newlines included.
     * @param base - offset of `source` inside the block's raw text, so text
     *   nodes can report the caret position a click maps to.
     * @returns flat inline nodes; emphasis carries nested children.
     */
    function parseInline(source, base = 0) {
      const nodes = []
      let buffer = ''
      let index = 0
      const flush = () => {
        if (buffer !== '') {
          // A text run ends where the raw scanner stands; escapes make the
          // rendered run shorter, so the end is the exact anchor.
          nodes.push({ kind: 'text', value: buffer, from: base + index - buffer.length, to: base + index })
          buffer = ''
        }
      }

      while (index < source.length) {
        const char = source[index]

        if (char === '\\' && source[index + 1] === '\n') {
          flush()
          nodes.push({ kind: 'break' })
          index += 2
          continue
        }
        if (char === '\\' && index + 1 < source.length && INLINE_ESCAPABLE.includes(source[index + 1])) {
          buffer += source[index + 1]
          index += 2
          continue
        }
        if (char === '\n') {
          flush()
          nodes.push({ kind: 'softbreak' })
          index += 1
          continue
        }

        if (char === '`') {
          const run = /^`+/.exec(source.slice(index))[0]
          const close = source.indexOf(run, index + run.length)
          if (close > 0) {
            flush()
            nodes.push({ kind: 'code', value: source.slice(index + run.length, close), from: index, to: close + run.length, weight: run.length })
            index = close + run.length
            continue
          }
          buffer += run
          index += run.length
          continue
        }

        if (char === '!' && source[index + 1] === '[') {
          const image = parseLinkAt(source, index + 1)
          if (image !== null) {
            const src = safeUrl(image.destination)
            if (src !== null) {
              flush()
              // `{width=300 height=200}` after the image sizes it; the group is
              // hidden, the way the reference's `.md-attr` rule hides it.
              const attrs = /^\{([^}]*)\}/.exec(source.slice(image.end))
              let width
              let height
              let end = image.end
              if (attrs !== null) {
                const widthMatch = /(?:^|\s)width\s*=\s*"?([0-9.]+(?:px|em|%)?)"?/.exec(attrs[1])
                const heightMatch = /(?:^|\s)height\s*=\s*"?([0-9.]+(?:px|em|%)?)"?/.exec(attrs[1])
                if (widthMatch !== null) width = widthMatch[1]
                if (heightMatch !== null) height = heightMatch[1]
                end = image.end + attrs[0].length
              }
              nodes.push({ kind: 'image', alt: image.label, src, width, height, from: index, to: end, weight: 2 })
              index = end
              continue
            }
          }
          buffer += char
          index += 1
          continue
        }

        if (char === '[' && source[index + 1] === '^') {
          const ref = /^\[\^([^\]\s]+)\]/.exec(source.slice(index))
          if (ref !== null) {
            flush()
            nodes.push({ kind: 'fnref', id: ref[1], from: index, to: index + ref[0].length, weight: 1 })
            index += ref[0].length
            continue
          }
        }

        if (char === '[') {
          const link = parseLinkAt(source, index)
          if (link !== null) {
            const href = safeUrl(link.destination)
            if (href !== null) {
              flush()
              nodes.push({ kind: 'link', href, children: parseInline(link.label, base + index + 1), from: index, to: link.end, weight: 1 })
              index = link.end
              continue
            }
          }
          buffer += char
          index += 1
          continue
        }

        if (char === '<') {
          const tag = inlineTagAt(source, index)
          if (tag !== null) {
            flush()
            const span = { from: index, to: tag.end, weight: 1 }
            if (tag.name === 'kbd') {
              nodes.push({ kind: 'kbd', value: tag.inner, ...span })
            } else if (tag.selfClosing) {
              nodes.push({ kind: 'html', tag: tag.name, attributes: tag.attributes, children: [], selfClosing: true, ...span })
            } else {
              nodes.push({
                kind: 'html',
                tag: tag.name,
                attributes: tag.attributes,
                children: parseInline(tag.inner, base + index),
                ...span,
              })
            }
            index = tag.end
            continue
          }
          const auto = /^<(https?:\/\/[^\s>]+|mailto:[^\s>]+)>/.exec(source.slice(index))
          if (auto !== null) {
            flush()
            nodes.push({
              kind: 'link',
              href: auto[1],
              children: [{ kind: 'text', value: auto[1] }],
            })
            index += auto[0].length
            continue
          }
          buffer += char
          index += 1
          continue
        }

        if (source.startsWith('**', index) || source.startsWith('__', index)) {
          const token = source.slice(index, index + 2)
          const close = findDelimiter(source, index + 2, token)
          if (close > index + 2) {
            flush()
            nodes.push({ kind: 'strong', children: parseInline(source.slice(index + 2, close), base + index + 2), from: index, to: close + 2, weight: 2 })
            index = close + 2
            continue
          }
          buffer += token
          index += 2
          continue
        }

        if (source.startsWith('~~', index)) {
          const close = findDelimiter(source, index + 2, '~~')
          if (close > index + 2) {
            flush()
            nodes.push({ kind: 'del', children: parseInline(source.slice(index + 2, close), base + index + 2), from: index, to: close + 2, weight: 2 })
            index = close + 2
            continue
          }
          buffer += '~~'
          index += 2
          continue
        }

        if (char === '*' || char === '_') {
          const previous = index === 0 ? ' ' : source[index - 1]
          const next = source[index + 1] ?? ' '
          const intraword = /[A-Za-z0-9]/.test(previous) && /[A-Za-z0-9]/.test(next)
          if (!intraword && !/\s/.test(next)) {
            const close = findDelimiter(source, index + 1, char)
            if (close > index + 1 && !/\s/.test(source[close - 1])) {
              flush()
              nodes.push({ kind: 'em', children: parseInline(source.slice(index + 1, close), base + index + 1), from: index, to: close + 1, weight: 1 })
              index = close + 1
              continue
            }
          }
          buffer += char
          index += 1
          continue
        }

        if (char === '$') {
          if (source.startsWith('$$', index)) {
            const close = source.indexOf('$$', index + 2)
            if (close > index + 2) {
              flush()
              nodes.push({ kind: 'mathblock', value: source.slice(index + 2, close).trim() })
              index = close + 2
              continue
            }
          }
          const close = source.indexOf('$', index + 1)
          if (close > index + 1) {
            const body = source.slice(index + 1, close)
            if (!/^\s|\s$/.test(body)) {
              flush()
              nodes.push({ kind: 'math', value: body, from: index, to: close + 1, weight: 1 })
              index = close + 1
              continue
            }
          }
          buffer += char
          index += 1
          continue
        }

        buffer += char
        index += 1
      }

      flush()
      return nodes
    }

    /**
     * Render inline nodes to React children.
     * @param nodes - output of parseInline.
     * @param prefix - key prefix for this fragment.
     * @param clickMap - wrap text runs so a click can be mapped back to source.
     * @returns React children.
     */
    function renderInline(nodes, prefix, clickMap = false, highlight = null, images = null, footnoteState = null, anchors = null, onAnchor = null) {
      const out = []
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index]
        const key = `${prefix}-${index}`
        if (node.kind === 'text') {
          const marked = highlightPieces(node.value, highlight, key)
          if (marked !== null) {
            // A search hit is rendered as its own marks, so the caret mapping
            // is dropped for that run rather than pointing at the wrong text.
            out.push(...marked)
          } else {
            out.push(
              clickMap && typeof node.from === 'number'
                ? h('span', { key, 'data-dcw-f': String(node.from) }, node.value)
                : node.value,
            )
          }
        } else if (node.kind === 'code') {
          out.push(h('code', { key, className: 'dcw-md-code' }, node.value))
        } else if (node.kind === 'math') {
          out.push(h('span', { key, className: 'dcw-md-math' }, renderMath(node.value)))
        } else if (node.kind === 'mathblock') {
          out.push(h('span', { key, className: 'dcw-md-mathblock' }, renderMath(node.value)))
        } else if (node.kind === 'strong' || node.kind === 'em' || node.kind === 'del') {
          out.push(h(node.kind, { key }, renderInline(node.children, key, clickMap, highlight, images, footnoteState, anchors, onAnchor)))
        } else if (node.kind === 'break') {
          out.push(h('br', { key }))
        } else if (node.kind === 'softbreak') {
          out.push(' ')
        } else if (node.kind === 'link') {
          const hash =
            node.href.startsWith('#') && anchors !== null ? node.href.slice(1) : null
          const target = hash === null || anchors === null ? undefined : anchors.get(hash)
          out.push(
            h(
              'a',
              {
                key,
                href: node.href,
                ...(target === undefined
                  ? { target: '_blank', rel: 'noreferrer noopener' }
                  : {
                      onClick: (event) => {
                        event.preventDefault()
                        if (onAnchor !== null) onAnchor(target)
                      },
                    }),
              },
              renderInline(node.children, key, clickMap, highlight, images, footnoteState, anchors, onAnchor),
            ),
          )
        } else if (node.kind === 'kbd') {
          out.push(h('kbd', { key }, node.value))
        } else if (node.kind === 'html') {
          out.push(
            h(
              node.tag,
              {
                key,
                ...tagAttributes(node.attributes),
                ...(node.tag === 'a' ? { target: '_blank', rel: 'noreferrer noopener' } : {}),
              },
              renderInline(node.children, key, clickMap, highlight, images, footnoteState),
            ),
          )
        } else if (node.kind === 'fnref') {
          // Repeated references to one note get a suffix, as the reference does,
          // so every back-link has a unique target.
          const seen = footnoteState === null ? undefined : (footnoteState.seen.get(node.id) ?? 0)
          const ordinal = typeof seen === 'number' ? seen + 1 : 1
          const suffix = ordinal > 1 ? `-${ordinal - 1}` : ''
          const anchor = `${node.id}${suffix}`
          if (footnoteState !== null) {
            footnoteState.seen.set(node.id, ordinal)
            if (!footnoteState.order.includes(node.id)) footnoteState.order.push(node.id)
          }
          out.push(
            h(
              'sup',
              { key, className: 'dcw-md-fn' },
              h('a', { href: `#dcw-fn-${node.id}`, id: `dcw-fnref-${anchor}` }, node.id),
            ),
          )
        } else if (node.kind === 'image') {
          out.push(
            h('img', {
              key,
              className: 'dcw-md-img',
              src: imageSource(node.src, images),
              alt: node.alt,
              ...(node.width === undefined ? {} : { width: node.width }),
              ...(node.height === undefined ? {} : { height: node.height }),
              ...(node.width !== undefined || node.height !== undefined
                ? { style: { width: node.width, height: node.height, maxWidth: node.width === undefined ? '100%' : undefined } }
                : {}),
            }),
          )
        }
      }
      return out
    }

    /**
     * Where a block's inline text starts inside its own raw source.
     * @param block - the parsed block.
     * @param source - the whole document.
     * @returns the offset, or null when the block has no single inline value.
     */
    function blockShift(block, source) {
      if (typeof block.value !== 'string' || block.value === '') return null
      const raw = source.slice(block.from, block.to)
      const shift = raw.indexOf(block.value)
      return shift >= 0 ? shift : null
    }

    /** Comment and quote shapes per syntax family. */
    const CODE_FAMILIES = {
      slash: { line: '//', block: ['/*', '*/'], quotes: ['"', "'", '`'], rawStrings: true },
      hash: { line: '#', quotes: ['"', "'"] },
      percent: { line: '%', quotes: ['"', "'"] },
      dash: { line: '--', block: ['--[[', ']]'], quotes: ['"', "'"] },
      semi: { line: ';', quotes: ['"'] },
      markup: { block: ['<!--', '-->'], quotes: ['"', "'"] },
      css: { block: ['/*', '*/'], quotes: ['"', "'"] },
      json: { quotes: ['"'] },
      text: {},
    }

    /**
     * Every mode name the reference ships, grouped by family. The names come
     * from its bundled CodeMirror mode table, so a fence language that works
     * there gets at least family-level colouring here.
     */
    const LANGUAGE_FAMILY = (() => {
      const groups = {
        slash:
          'javascript js jsx mjs cjs typescript ts tsx java c cpp c++ cc h hpp cs csharp clike go rust rustsrc swift kotlin dart scala php groovy haxe glsl solidity objectivec objc d v verilog systemverilog gas webidl protobuf nsis yara aspx jsp ejs erb velocity smarty twig django',
        hash: 'python py ruby shell sh bash zsh fish perl perl6 r julia coffeescript coffee crystal elixir dockerfile makefile ini toml cmake properties nginx nix cython livescript rsrc yaml yml tcl expect',
        percent: 'matlab octave erlang latex stex rsrc prolog',
        dash: 'sql mysql pgsql mariadb mssql plsql hive sparksql sqlite gpsql sparql lua haskell ada vhdl elm haddock purescript asn1 asn',
        semi: 'commonlisp clojure scheme assembly fortran smalltalk cobol q',
        markup: 'html htm xml vue svelte handlebars hbs pug jade twig-django xquery turtle dtd',
        css: 'css scss less stylus styl gss',
        text: 'diff markdown md rst tiddlywiki tiki http apl mathematica yacas sas stata forth oz dylan spreadsheet tlvb',
      }
      const table = new Map()
      for (const [family, names] of Object.entries(groups)) {
        for (const name of names.split(/\s+/).filter(Boolean)) table.set(name, family)
      }
      return table
    })()

    /** Hand-written keyword sets for the languages the shipped modes do not carry. */
    const CODE_KEYWORDS_HAND = {
      js: 'const let var function return if else for while do break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of delete void yield switch case static get set null undefined true false',
      ts: 'const let var function return if else for while do break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of delete void yield switch case interface type enum implements readonly public private protected declare as satisfies null undefined true false',
      // The bundle's shared C-like definition is too polluted to extract, so the
      // C family keeps this hand-written set; the aliases fan it out.
      c: 'int char float double void long short unsigned signed const static struct union enum typedef extern return if else for while do break continue switch case default sizeof goto inline volatile register NULL true false',
      py: 'def class return if elif else for while break continue import from as pass raise try except finally with lambda yield global nonlocal assert del not and or in is None True False async await match case',
      r: 'function return if else for while repeat break next library require c true false null na',
      sh: 'if then else elif fi for while do done case esac function return local export readonly declare echo cd set unset source alias',
      sql: 'select from where join inner left right full outer on group by order having limit offset insert into values update set delete create table view index drop alter add column primary key foreign references not null default distinct as union all and or in exists like between case when then else end',
      perl: 'my our local sub return if elsif else unless while for foreach last next redo package use no require eval die warn print',
      matlab: 'function return if elseif else end for while break continue switch case otherwise try catch global persistent classdef properties methods',
      json: 'true false null',
      yaml: 'true false null yes no',
      latex: '',
      html: '',
    }

    /**
     * Keyword lists read out of the reference's bundled CodeMirror modes.
     * Only modes whose harvested words pass a per-language anchor check are
     * kept, so a table always belongs to the language it is filed under;
     * regenerate from mode.min.js rather than editing by hand.
     */
    const CODE_KEYWORDS_EXTRACTED = {
      asn1: 'accessible-for-notify current deprecated mandatory not-accessible obsolete read-create read-only read-write ACTION ACTIONS ADD ANY APPLICATION AS ATTRIBUTE ATTRIBUTES AUGMENTS AUTOMATIC BEGIN BEHAVIOUR BIT BITS BMPString BOOLEAN BY CHARACTERIZED CHOICE CLASS CMIP-Attribute COMPONENTS CONDITIONAL CONFIRMED CONSTRAINED Counter Counter32 Counter64 DEFAULT DEFINED DEFINITIONS DERIVED DESCRIPTION DisplayString DistinguishedName ELEMENTS END ENUMERATED EQUALITY EXPLICIT EXPORTS EXTENSIBILITY FALSE FROM GET GROUP GROUPS Gauge Gauge32 GeneralString GraphicString IA5String IANAifType IDENTIFIED IDENTIFIER IF IMPLICIT IMPLIED IMPORTS INDEX INFORMATION INTEGER ISO646String Integer32 InterfaceIndex IpAddress MANAGED MANDATORY-GROUP MANDATORY-GROUPS MAX-ACCESS MAXACCESS MIN-ACCESS MINACCESS MODE MODULE MODULE-COMPLIANCE MODULE-TYPE MODULE_IDENTITY NAMED NOTIFICATIONS NULL NetworkAddress NumericString OBJECT OBJECT-COMPLIANCE OBJECT-IDENTITY OBJECT-TYPE OBJECTS OCTET OF OPTIONAL ORDERING PACKAGE PACKAGES PRESENT PRIVATE PhysAddress PrintableString REAL REGISTERED REMOVE REPLACE REPLY REVISION RowStatus SEQUENCE SET SIZE STATUS STRING SUBORDINATE SUBSTRINGS SUPERIOR SYNTAX SnmpAdminAtring StringStore T61String TAGS TEXTUAL-CONVENTION TRUE TeletexString TimeStamp TimeTicks TruthValue UNITS UNIVERSAL UTCTime UTF8String UniversalString Unsigned32 VideotexString VisibleString WITH',
      clojure: 'accessor aclone add-classpath add-watch agent agent-error agent-errors aget alength alias all-ns alter alter-meta! alter-var-root amap ancestors and apply areduce array-map aset aset-boolean aset-byte aset-char aset-double aset-float aset-int aset-long aset-short assert assoc assoc! assoc-in associative? atom await await-for await1 bases bean bigdec bigint biginteger binding bit-and bit-and-not bit-clear bit-flip bit-not bit-or bit-set bit-shift-left bit-shift-right bit-test bit-xor boolean boolean-array booleans bound-fn bound-fn* bound? butlast byte byte-array bytes case cast cat catch char char-array char-escape-string char-name-string char? chars chunk chunk-append chunk-buffer chunk-cons chunk-first chunk-next chunk-rest chunked-seq? class class? clear-agent-errors clojure-version coll? comment commute comp comparator compare compare-and-set! compile complement completing concat cond condp conj conj! cons constantly construct-proxy contains? count counted? create-ns create-struct cycle dec decimal? declare dedupe def def- defalias default-data-readers defhinted definline definterface defmacro defmacro- defmethod defmulti defn defn- defn-memo defnk defonce defonce- defproject defprotocol defrecord defstruct deftest deftrace deftype defunbound defunbound- defvar defvar- delay delay? deliver denominator deref derive descendants destructure disj disj! dissoc dissoc! distinct distinct? do doall dorun doseq dosync dotimes doto dotrace double double-array doubles drop drop-last drop-while eduction empty empty? ensure enumeration-seq error-handler error-mode eval even? every-pred every? ex-data ex-info extend extend-protocol extend-type extenders extends? false false? ffirst file-seq filter filterv finally find find-keyword find-ns find-protocol-impl find-protocol-method find-var first flatten float float-array float? floats flush fn fn? fnext fnil for force format frequencies future future-call future-cancel',
      cobol: 'ACCEPT ACCESS ACQUIRE ADD ADDRESS ADVANCING AFTER ALIAS ALL ALPHABET ALPHABETIC ALPHABETIC-LOWER ALPHABETIC-UPPER ALPHANUMERIC ALPHANUMERIC-EDITED ALSO ALTER ALTERNATE AND ANY ARE AREA AREAS ARITHMETIC ASCENDING ASSIGN AT ATTRIBUTE AUTHOR AUTO AUTO-SKIP AUTOMATIC B-AND B-EXOR B-LESS B-NOT B-OR BACKGROUND-COLOR BACKGROUND-COLOUR BEEP BEFORE BELL BINARY BIT BITS BLANK BLINK BLOCK BOOLEAN BOTTOM BY CALL CANCEL CD CF CH CHARACTER CHARACTERS CLASS CLOCK-UNITS CLOSE COBOL CODE CODE-SET COL COLLATING COLUMN COMMA COMMIT COMMITMENT COMMON COMMUNICATION COMP COMP-0 COMP-1 COMP-2 COMP-3 COMP-4 COMP-5 COMP-6 COMP-7 COMP-8 COMP-9 COMPUTATIONAL COMPUTATIONAL-0 COMPUTATIONAL-1 COMPUTATIONAL-2 COMPUTATIONAL-3 COMPUTATIONAL-4 COMPUTATIONAL-5 COMPUTATIONAL-6 COMPUTATIONAL-7 COMPUTATIONAL-8 COMPUTATIONAL-9 COMPUTE CONFIGURATION CONNECT CONSOLE CONTAINED CONTAINS CONTENT CONTINUE CONTROL CONTROL-AREA CONTROLS CONVERTING COPY CORR CORRESPONDING COUNT CRT CRT-UNDER CURRENCY CURRENT CURSOR DATA DATE DATE-COMPILED DATE-WRITTEN DAY DAY-OF-WEEK DB DB-ACCESS-CONTROL-KEY DB-DATA-NAME DB-EXCEPTION DB-FORMAT-NAME DB-RECORD-NAME DB-SET-NAME DB-STATUS DBCS DBCS-EDITED DE DEBUG-CONTENTS DEBUG-ITEM DEBUG-LINE DEBUG-NAME DEBUG-SUB-1 DEBUG-SUB-2 DEBUG-SUB-3 DEBUGGING DECIMAL-POINT DECLARATIVES DEFAULT DELETE DELIMITED DELIMITER DEPENDING DESCENDING DESCRIBED DESTINATION DETAIL DISABLE DISCONNECT DISPLAY DISPLAY-1 DISPLAY-2 DISPLAY-3 DISPLAY-4 DISPLAY-5 DISPLAY-6 DISPLAY-7 DISPLAY-8 DISPLAY-9 DIVIDE DIVISION DOWN DROP DUPLICATE DUPLICATES DYNAMIC EBCDIC EGI EJECT ELSE EMI EMPTY EMPTY-CHECK ENABLE END END-ACCEPT END-ACCEPT. END-ADD END-CALL END-COMPUTE END-DELETE END-DISPLAY END-DIVIDE END-EVALUATE END-IF END-INVOKE END-MULTIPLY END-OF-PAGE END-PERFORM END-READ END-RECEIVE END-RETURN END-REWRITE END-SEARCH END-START END-STRING END-SUBTRACT END-UNSTRING END-WRITE END-XML END. ENTER ENTRY ENVIRONMENT EOP EQUAL EQUALS ERASE ERROR ESI EVALUATE EVERY EXCEEDS EXCEPTION EXCLUSIVE EXIT',
      groovy: 'abstract as assert boolean break byte case catch char class const continue def default do double else enum extends false final finally float for goto if implements import in instanceof int interface long native new null package private protected public return short static strictfp super switch synchronized this threadsafe throw throws trait transient true try void volatile while',
      nginx: 'accept_mutex accept_mutex_delay access_log add_after_body add_before_body add_header addition_types aio alias allow ancient_browser ancient_browser_value auth_basic auth_basic_user_file auth_http auth_http_header auth_http_timeout autoindex autoindex_exact_size autoindex_localtime break charset charset_map charset_types client_body_buffer_size client_body_in_file_only client_body_temp_path client_body_timeout client_header_timeout client_max_body_size connection_pool_size create_full_put_path daemon dav_access dav_methods debug_connection debug_points default_type degradation degrade deny devpoll_changes devpoll_events directio directio_alignment empty_gif env epoll_events error_log eventport_events events expires fastcgi_bind fastcgi_buffer_size fastcgi_buffers fastcgi_cache fastcgi_cache_key fastcgi_cache_methods fastcgi_cache_min_uses fastcgi_cache_path fastcgi_cache_use_stale fastcgi_cache_valid fastcgi_catch_stderr fastcgi_connect_timeout fastcgi_hide_header fastcgi_ignore_headers fastcgi_index fastcgi_intercept_errors fastcgi_next_upstream fastcgi_param fastcgi_pass fastcgi_pass_header fastcgi_read_timeout fastcgi_send_lowat fastcgi_send_timeout fastcgi_split_path_info fastcgi_store fastcgi_store_access fastcgi_temp_path flv geo geoip_city geoip_country gzip gzip_buffers gzip_comp_level gzip_disable gzip_hash gzip_http_version gzip_min_length gzip_no_buffer gzip_proxied gzip_static gzip_types gzip_vary gzip_window http if if_modified_since ignore_invalid_headers image_filter image_filter_buffer imap_auth imap_capabilities imap_client_buffer include index internal ip_hash keepalive_requests keepalive_timeout kqueue_changes kqueue_events limit_conn limit_conn_log_level limit_except limit_rate limit_rate_after limit_req limit_req_log_level limit_req_zone limit_zone lingering_time lingering_timeout listen location lock_file log_format log_not_found log_subrequest mail map map_hash_bucket_size map_hash_max_size master_process memcached_bind memcached_buffer_size memcached_next_upstream memcached_pass memcached_read_timeout memcached_send_timeout merge_slashes min_delete_depth modern_browser modern_browser_value msie_padding msie_refresh multi_accept open_file_cache open_file_cache_errors open_file_cache_events open_file_cache_min_uses open_file_cache_valid open_log_file_cache output_buffers override_charset perl perl_modules perl_require perl_set pid pop3_auth pop3_capabilities port_in_redirect postpone_gzipping postpone_output protocol proxy proxy_bind proxy_buffer proxy_buffer_size proxy_buffering proxy_buffers proxy_busy_buffers_size proxy_cache proxy_cache_key proxy_cache_methods proxy_cache_min_uses proxy_cache_path proxy_cache_use_stale proxy_cache_valid proxy_connect_timeout proxy_hide_header proxy_ignore_headers proxy_intercept_errors proxy_max_temp_file_size proxy_method proxy_next_upstream proxy_pass proxy_pass_error_message proxy_pass_header proxy_pass_request_body proxy_read_timeout proxy_redirect proxy_send_lowat proxy_send_timeout proxy_set_body proxy_set_header proxy_ssl_session_reuse proxy_store proxy_store_access proxy_temp_path proxy_timeout proxy_upstream_max_fails random_index read_ahead real_ip_header recursive_error_pages request_pool_size resolver resolver_timeout return rewrite rewrite_log root rtsig_overflow_events rtsig_overflow_test rtsig_overflow_threshold rtsig_signo satisfy',
      py: 'by cdef cimport cpdef ctypedef enum except extern gil include nogil property public readonly struct union DEF ELIF ELSE IF',
      r: 'bquote break call deparse else eval for function if in list next parse quote repeat return while Inf NA NA_character_ NA_complex_ NA_integer_ NA_real_ NULL NaN',
      sh: 'ab awk bash beep cat cc cd chmod chown chroot clear cp curl cut diff do done echo elif else esac exit export fi fil fin find for function gawk gcc get git grep if in kill killall ln ls make mkdir mv nc node npm openssl ping ps restart rm rmdir sed service set sh shopt shred sleep sort source ssh start stop su sudo tee telnet then top touch unset until vi vim wall wc wget while who write yes zsh',
      sql: '$elem$ $key$ $partition $value$ __key__ abort abs absolute accept access acos acosh action active add add_months admin after aggregate all allow also alter always analyse analyze ancestor and anti any appinfo apply approx_count_distinct approx_percentile archive array array_contains array_distinct array_except array_intersect array_join array_max array_min array_position array_remove array_repeat array_sort array_union arraylen arrays_overlap arrays_zip arraysize as asc ascii asin asinh assert assert_true assertion assign assignment asymmetric at atan atan2 atanh attributes audit auth authorization authorize autocommit autoprint autorecovery autotrace avedev average avg backup backward bail base64 base_table batch before begin between bfile bfilename bigint bigserial bin binary binary_checksum binary_integer bit bit_and bit_count bit_get bit_length bit_or bit_xor blob blockterminator body bool bool_and bool_or boolean both box break bround btitle btrim bucket buckets by bytea cache called cardinality cascade cascaded case cast cbrt ceil ceiling chain change changes char char_base char_length character character_length characteristics charset chartorowid check checkpoint checksum chr cidr circle class clear clob clone close cluster clustered clustering clusters clusterstatus cmdsep coalesce codegen colauth collate collect_list collect_set collection colsep column columnfamily columns comment commit committed compact compactions compatibility compress compute concat concat_ws concatenate concurrency concurrently conf configuration connect connected connection connectionproperty consistency constant constraint constraints contains content context_info continue conv conversion convert copy copycommit copytypecheck corr cos cosh cost cot count count_if count_min_sketch counter covar_pop covar_samp cpu_rate_limit crash crc32 create createdb createexttable createrole',
      tcl: 'after and append array auto_execok auto_import auto_load auto_mkindex auto_mkindex_old auto_qualify auto_reset bgerror binary break catch cd close concat continue dde else elseif encoding eof eq error eval exec exit expr fblocked fconfigure fcopy file fileevent filename flush for foreach format gets glob global history http if in incr info interp join lappend lindex linsert list llength load lrange lreplace lsearch lset lsort memory msgcat namespace ne ni not open or package parray pid proc puts pwd re_syntax read regex regexp registry regsub rename resource return safe scan seek set socket source split string subst switch tcltest tclvars tell time trace unknown unset update uplevel upvar variable vwait while Tcl pkg_mkIndex tcl_endOfWord tcl_findLibrary tcl_startOfNextWord tcl_startOfPreviousWord tcl_wordBreakAfter tcl_wordBreakBefore',
      verilog: 'accept_on alias always always_comb always_ff always_latch and assert assign assume automatic before begin bind bins binsof bit break buf bufif0 bufif1 byte case casex casez cell chandle checker class clocking cmos config const constraint context continue cover covergroup coverpoint cross deassign default defparam design disable dist do edge else end endcase endchecker endclass endclocking endconfig endfunction endgenerate endgroup endinterface endmodule endpackage endprimitive endprogram endproperty endsequence endspecify endtable endtask enum event eventually expect export extends extern final first_match for force foreach forever fork forkjoin function generate genvar global highz0 highz1 if iff ifnone ignore_bins illegal_bins implements implies import incdir include initial inout input inside instance int integer interconnect interface intersect join join_any join_none large let liblist library local localparam logic longint macromodule matches medium modport module nand negedge nettype new nexttime nmos nor noshowcancelled not notif0 notif1 null or output package packed parameter pmos posedge primitive priority program property protected pull0 pull1 pulldown pullup pulsestyle_ondetect pulsestyle_onevent pure rand randc randcase randsequence rcmos real realtime ref reg reject_on release repeat restrict return rnmos rpmos rtran rtranif0 rtranif1 s_always s_eventually s_nexttime s_until s_until_with scalared sequence shortint shortreal showcancelled signed small soft solve specify specparam static string strong strong0 strong1 struct super supply0 supply1 sync_accept_on sync_reject_on table tagged task this throughout time timeprecision timeunit tran tranif0 tranif1 tri tri0 tri1 triand trior trireg type',
      vhdl: 'architecture begin case else elsif end entity for function if port',
    }

    /** Union of both sources, so a language is never worse off than before. */
    const CODE_KEYWORDS = (() => {
      const merged = {}
      for (const source of [CODE_KEYWORDS_EXTRACTED, CODE_KEYWORDS_HAND]) {
        for (const [lang, words] of Object.entries(source)) {
          const parts = String(words ?? '').split(/\s+/).filter(Boolean)
          const set = new Set((merged[lang] ?? '').split(/\s+/).filter(Boolean))
          for (const part of parts) set.add(part)
          merged[lang] = [...set].join(' ')
        }
      }
      return merged
    })()

    /** Aliases seen in the wild, mapped onto a family-bearing name. */
    const CODE_ALIASES = {
      // names whose extracted table lives under the mode's own id
      perl6: 'perl', bash: 'sh', zsh: 'sh', ksh: 'sh', console: 'sh',
      postgres: 'sql', psql: 'sql', mysql: 'sql', plsql: 'sql',
      systemverilog: 'verilog', vhd: 'vhdl', scheme: 'clojure',
      'asn.1': 'asn1', asn: 'asn1', yacc: 'c', bison: 'c',
      javascript: 'js', jscript: 'js', node: 'js', typescript: 'ts', tsx: 'ts',
      python: 'py', python3: 'py', cpp: 'c', 'c++': 'c', h: 'c', hpp: 'c',
      java: 'c', cs: 'c', csharp: 'c', go: 'c', rust: 'c', kotlin: 'c',
      swift: 'c', objc: 'c', dart: 'c', scala: 'c', php: 'c', glsl: 'c',
      solidity: 'c', protobuf: 'c', d: 'c', haxe: 'c', v: 'c', objectivec: 'c',
      bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
      xml: 'html', svg: 'html', vue: 'html', scss: 'css', less: 'css',
      yml: 'yaml', tex: 'latex', mysql: 'sql', psql: 'sql', sqlite: 'sql',
      text: 'text', txt: 'text', plaintext: 'text',
    }

    /** Multi-line constructs a family's modes really support. */
    const CODE_EXTRA = {
      py: { tripleQuotes: ['"""', "'''"] },
      elixir: { tripleQuotes: ['"""'] },
      ruby: { heredoc: true },
      sh: { heredoc: true },
      php: { heredoc: true },
      js: { templateNesting: true, regexLiterals: true },
      ts: { templateNesting: true, regexLiterals: true },
      ruby: { heredoc: true, percentLiterals: true },
      perl: { perlLiterals: true },
      sh: { heredoc: true },
      julia: { nestedBlockComments: true },
      rust: { nestedBlockComments: true },
      swift: { nestedBlockComments: true },
    }

    /**
     * Resolve one fence language to a tokenised grammar.
     * @param lang - the fence info string.
     * @returns the grammar, or null when we cannot highlight it.
     */
    function codeGrammar(lang) {
      const raw = String(lang ?? '').toLowerCase().trim()
      if (raw === '') return null
      const name = CODE_ALIASES[raw] ?? raw
      const family =
        LANGUAGE_FAMILY.get(name) ??
        LANGUAGE_FAMILY.get(raw) ??
        // A language with its own keyword table is worth colouring even when
        // the family table has no row for it; the common `//` shape applies.
        (CODE_KEYWORDS[name] !== undefined || CODE_KEYWORDS[raw] !== undefined ? 'slash' : undefined)
      if (family === undefined || family === 'text') return null
      const shape = CODE_FAMILIES[family]
      if (shape === undefined) return null
      const keywords = CODE_KEYWORDS[name] ?? CODE_KEYWORDS[raw] ?? ''
      const extra = CODE_EXTRA[name] ?? CODE_EXTRA[raw] ?? {}
      return { ...shape, keywords, extra }
    }

    /**
     * Resolve one fence language to a tokenised grammar.
     * @param lang - the fence info string.
     * @returns the grammar, or null when we cannot highlight it.
     */
    /** Delimiter pairs a quoted literal may use. */
    const DELIMITER_PAIRS = { '(': ')', '[': ']', '{': '}', '<': '>' }

    /**
     * Scan a literal delimited by a pair of characters, honouring nesting and
     * backslash escapes.
     * @param code - the whole block body.
     * @param start - index of the first character after the opening delimiter.
     * @param open - the opening delimiter.
     * @returns the index just past the closing delimiter.
     */
    function scanDelimited(code, start, open) {
      const close = DELIMITER_PAIRS[open] ?? open
      let depth = 1
      let index = start
      while (index < code.length) {
        const char = code[index]
        if (char === '\\') {
          index += 2
          continue
        }
        if (char === open && close !== open) depth += 1
        if (char === close) {
          depth -= 1
          if (depth === 0) return index + 1
        }
        index += 1
      }
      return code.length
    }

    /** After these characters a `/` starts a regular expression, not a division. */
    const REGEX_PRECEDING_CHARS = '(,=:[!&|?{};+-*%<>~^'

    /** After these words a `/` starts a regular expression. */
    const REGEX_PRECEDING_WORDS = new Set([
      'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do',
      'else', 'yield', 'await', 'throw',
    ])

    /**
     * Split one code block into typed tokens.
     * @param code - the block body.
     * @param lang - the fence language.
     * @returns tokens, or null when the language is unknown.
     */
    function codeTokens(code, lang) {
      const grammar = codeGrammar(lang)
      if (grammar === null) return null
      const keywords = new Set(String(grammar.keywords ?? '').split(/\s+/).filter(Boolean))
      const quotes = new Set(grammar.quotes ?? [])
      const tokens = []
      let buffer = ''
      let index = 0
      const flush = () => {
        if (buffer !== '') {
          tokens.push({ kind: 'text', value: buffer })
          buffer = ''
        }
      }
      const readWhile = (test) => {
        const start = index
        while (index < code.length && test(code[index])) index += 1
        return code.slice(start, index)
      }

      const extra = grammar.extra ?? {}
      const tripleQuotes = extra.tripleQuotes ?? []

      while (index < code.length) {
        const char = code[index]

        // Heredocs run to their own terminator line, not to a quote.
        if (extra.heredoc === true && code.startsWith('<<', index)) {
          const marker = /^<<([-~]?)(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(code.slice(index))
          if (marker !== null) {
            flush()
            const terminator = marker[3]
            let cursor = index + marker[0].length
            let stop = code.length
            while (cursor < code.length) {
              const lineEnd = code.indexOf('\n', cursor)
              const end = lineEnd < 0 ? code.length : lineEnd
              const line = code.slice(cursor, end).trim()
              cursor = end + 1
              if (line === terminator) {
                stop = Math.min(cursor, code.length)
                break
              }
            }
            tokens.push({ kind: 'str', value: code.slice(index, stop) })
            index = stop
            continue
          }
        }

        // Python-style triple quotes may span lines.
        const triple = tripleQuotes.find((quote) => code.startsWith(quote, index))
        if (triple !== undefined) {
          flush()
          const end = code.indexOf(triple, index + triple.length)
          const stop = end < 0 ? code.length : end + triple.length
          tokens.push({ kind: 'str', value: code.slice(index, stop) })
          index = stop
          continue
        }

        if (grammar.block !== undefined && code.startsWith(grammar.block[0], index)) {
          flush()
          let stop
          if (extra.nestedBlockComments === true) {
            // Rust/Swift/Julia nest their block comments.
            let depth = 0
            let cursor = index
            while (cursor < code.length) {
              if (code.startsWith(grammar.block[0], cursor)) {
                depth += 1
                cursor += grammar.block[0].length
                continue
              }
              if (code.startsWith(grammar.block[1], cursor)) {
                depth -= 1
                cursor += grammar.block[1].length
                if (depth === 0) break
                continue
              }
              cursor += 1
            }
            stop = cursor
          } else {
            const end = code.indexOf(grammar.block[1], index + grammar.block[0].length)
            stop = end < 0 ? code.length : end + grammar.block[1].length
          }
          tokens.push({ kind: 'com', value: code.slice(index, stop) })
          index = stop
          continue
        }
        if (grammar.line !== undefined && code.startsWith(grammar.line, index)) {
          flush()
          const end = code.indexOf('\n', index)
          const stop = end < 0 ? code.length : end
          tokens.push({ kind: 'com', value: code.slice(index, stop) })
          index = stop
          continue
        }
        // A C++ raw string may hold anything between its own delimiters.
        if (grammar.rawStrings === true && (char === 'R' || char === 'r') && code[index + 1] === '"') {
          const head = /^[Rr]"([^()\\ ]{0,16})\(/.exec(code.slice(index))
          if (head !== null) {
            const terminator = `)${head[1]}"`
            const end = code.indexOf(terminator, index + head[0].length)
            if (end >= 0) {
              flush()
              tokens.push({ kind: 'str', value: code.slice(index, end + terminator.length) })
              index = end + terminator.length
              continue
            }
          }
        }

        // Ruby `%w[…]`, `%i{…}`, `%q(…)`, `%r{…}` style literals.
        if (extra.percentLiterals === true && char === '%' && /[wWiIqQrs]/.test(code[index + 1] ?? '')) {
          const open = code[index + 2] ?? ''
          if (open !== '' && !/[A-Za-z0-9\s]/.test(open)) {
            flush()
            const stop = scanDelimited(code, index + 3, open)
            tokens.push({ kind: 'str', value: code.slice(index, stop) })
            index = stop
            continue
          }
        }

        // Perl `q//`, `qq{}`, `qw()`, `qr//`, `m//`, `s///`, `tr///`.
        if (extra.perlLiterals === true && /[a-z]/.test(char)) {
          const word = /^(qq|qw|qr|tr|q|m|s|y)(?![A-Za-z0-9_])/.exec(code.slice(index))
          const after = word === null ? '' : code[index + word[1].length] ?? ''
          if (word !== null && after !== '' && !/[A-Za-z0-9_\s]/.test(after)) {
            flush()
            let stop = scanDelimited(code, index + word[1].length + 1, after)
            // `s///` and `tr///` close the replacement with the same delimiter.
            if (word[1] === 's' || word[1] === 'tr' || word[1] === 'y') {
              let cursor = stop
              while (cursor < code.length) {
                if (code[cursor] === '\\') {
                  cursor += 2
                  continue
                }
                if (code[cursor] === after) {
                  cursor += 1
                  break
                }
                cursor += 1
              }
              stop = Math.min(cursor, code.length)
              // s/// may carry trailing flags.
              while (stop < code.length && /[a-z]/.test(code[stop])) stop += 1
            }
            tokens.push({ kind: 'str', value: code.slice(index, stop) })
            index = stop
            continue
          }
        }

        // A JavaScript regular expression literal, told apart from division by
        // what came before it.
        if (extra.regexLiterals === true && char === '/' && code[index + 1] !== '/' && code[index + 1] !== '*') {
          const before = code.slice(0, index).replace(/\s+$/, '')
          const lastChar = before.slice(-1)
          const lastWord = /([A-Za-z_$][\w$]*)$/.exec(before)?.[1] ?? ''
          const startsRegex =
            before === '' ||
            REGEX_PRECEDING_CHARS.includes(lastChar) ||
            REGEX_PRECEDING_WORDS.has(lastWord)
          if (startsRegex) {
            let cursor = index + 1
            let inClass = false
            while (cursor < code.length) {
              const inner = code[cursor]
              if (inner === '\\') {
                cursor += 2
                continue
              }
              if (inner === '[') inClass = true
              else if (inner === ']') inClass = false
              else if (inner === '/' && !inClass) break
              else if (inner === '\n') break
              cursor += 1
            }
            if (code[cursor] === '/') {
              cursor += 1
              while (cursor < code.length && /[a-z]/.test(code[cursor])) cursor += 1
              flush()
              tokens.push({ kind: 'str', value: code.slice(index, cursor) })
              index = cursor
              continue
            }
          }
        }

        if (quotes.has(char)) {
          flush()
          let cursor = index + 1
          // A template literal may hold `${…}` with its own quotes inside.
          let braces = 0
          while (cursor < code.length) {
            const inner = code[cursor]
            if (inner === '\\') {
              cursor += 2
              continue
            }
            if (extra.templateNesting === true && char === '`') {
              if (inner === '$' && code[cursor + 1] === '{') {
                braces += 1
                cursor += 2
                continue
              }
              if (inner === '}' && braces > 0) {
                braces -= 1
                cursor += 1
                continue
              }
              if (inner === '`' && braces === 0) break
              cursor += 1
              continue
            }
            if (inner === char) break
            cursor += 1
          }
          tokens.push({ kind: 'str', value: code.slice(index, Math.min(cursor + 1, code.length)) })
          index = cursor + 1
          continue
        }
        if (/[0-9]/.test(char)) {
          flush()
          tokens.push({ kind: 'num', value: readWhile((c) => /[0-9a-fx._]/.test(c)) })
          continue
        }
        if (/[A-Za-z_$@]/.test(char)) {
          const word = readWhile((c) => /[A-Za-z0-9_$-]/.test(c))
          if (word === '') {
            // `@` and `$` start an identifier but do not continue one, so a
            // bare one must still advance the scan.
            buffer += char
            index += 1
            continue
          }
          if (keywords.has(word)) {
            flush()
            tokens.push({ kind: 'kw', value: word })
          } else {
            buffer += word
          }
          continue
        }
        buffer += char
        index += 1
      }
      flush()
      return tokens
    }

    /**
     * Render code, with tokens when the language is known.
     * @param code - the block body.
     * @param lang - the fence language.
     * @param lineNumbers - whether to number the lines.
     * @returns React children for the `pre`.
     */
    function renderCode(code, lang, lineNumbers) {
      const tokens = codeTokens(code, lang)
      const plain = tokens === null
      if (!lineNumbers) {
        if (plain) return [code]
        return tokens.map((token, index) =>
          token.kind === 'text'
            ? token.value
            : h('span', { key: `t${index}`, className: `dcw-tok-${token.kind}` }, token.value),
        )
      }
      // With numbers each line becomes its own element so the counter can run.
      // Tokenise the whole block first, otherwise a multi-line string would be
      // re-lexed per line and lose its span.
      const rawLines = code.split('\n')
      if (plain || tokens === null) {
        return rawLines.map((line, lineIndex) =>
          h(
            'span',
            { key: `l${lineIndex}`, className: 'dcw-md-line' },
            line,
            lineIndex < rawLines.length - 1 ? '\n' : '',
          ),
        )
      }
      const segments = [[]]
      for (const token of tokens) {
        const parts = token.value.split('\n')
        parts.forEach((part, partIndex) => {
          if (partIndex > 0) segments.push([])
          if (part === '') return
          segments[segments.length - 1].push(
            token.kind === 'text' ? part : { kind: token.kind, value: part },
          )
        })
      }
      return segments.map((parts, lineIndex) =>
        h(
          'span',
          { key: `l${lineIndex}`, className: 'dcw-md-line' },
          parts.map((part, partIndex) =>
            typeof part === 'string'
              ? part
              : h('span', { key: `t${partIndex}`, className: `dcw-tok-${part.kind}` }, part.value),
          ),
          lineIndex < segments.length - 1 ? '\n' : '',
        ),
      )
    }

    /* ---- a mermaid subset: flowcharts, sequence diagrams and pies ---- */

    /** Node shapes the reference accepts, keyed by their brackets. */
    const MERMAID_SHAPES = [
      { open: '((', close: '))', shape: 'circle' },
      { open: '([', close: '])', shape: 'stadium' },
      { open: '[[', close: ']]', shape: 'subroutine' },
      { open: '[(', close: ')]', shape: 'cylinder' },
      { open: '[', close: ']', shape: 'square' },
      { open: '(', close: ')', shape: 'round' },
      { open: '{', close: '}', shape: 'diamond' },
    ]

    /** Resolve an arrow head from the connector's last character. */
    function MERID_HEAD(first, last) {
      return MERMAID_HEADS[last] ?? 'none'
    }

    /** Edge arrow heads, keyed by the character the reference reads. */
    const MERMAID_HEADS = { '>': 'arrow', x: 'cross', o: 'circle', '-': 'none' }

    /** Strip a trailing `%%` comment. */
    function stripMermaidComment(line) {
      const at = line.indexOf('%%')
      return (at < 0 ? line : line.slice(0, at)).trim()
    }

    /**
     * Parse one node token such as `A[text]`.
     * @param token - the source token.
     * @returns the node, or null when the token is not a node.
     */
    function parseMermaidNode(token) {
      const match = /^([A-Za-z0-9_.-]+)\s*(.*)$/.exec(token.trim())
      if (match === null) return null
      const id = match[1]
      const rest = match[2]
      if (rest === '') return { id, label: id, shape: 'square' }
      for (const candidate of MERMAID_SHAPES) {
        if (!rest.startsWith(candidate.open)) continue
        const inner = rest.slice(candidate.open.length)
        const closeAt = inner.lastIndexOf(candidate.close)
        if (closeAt < 0) continue
        return {
          id,
          label: inner.slice(0, closeAt).replace(/^["']|["']$/g, ''),
          shape: candidate.shape,
        }
      }
      return { id, label: id, shape: 'square' }
    }

    /**
     * Parse a mermaid source into a diagram description.
     * @param source - the fence body.
     * @returns the diagram, or null when nothing is understood.
     */
    function parseMermaid(source) {
      const lines = String(source ?? '')
        .split('\n')
        .map(stripMermaidComment)
        .filter((line) => line !== '')
      if (lines.length === 0) return null

      const head = lines[0]
      const flow = /^(?:graph|flowchart)\s*(TD|TB|LR|RL|BT)?/i.exec(head)
      if (flow !== null) {
        const direction = (flow[1] ?? 'TD').toUpperCase().replace('TB', 'TD')
        const nodes = new Map()
        const edges = []
        const remember = (node) => {
          if (node === null) return null
          if (!nodes.has(node.id)) nodes.set(node.id, node)
          return nodes.get(node.id)
        }
        const groups = new Map()
        const groupOrder = []
        const classStyles = new Map()
        const nodeClasses = new Map()
        let currentGroup = null
        for (const line of lines.slice(1)) {
          // `subgraph id[Title]` … `end` groups the nodes declared inside it.
          const open = /^subgraph\s+([^\[\s]+)\s*(?:\[([^\]]*)\])?/i.exec(line)
          if (open !== null) {
            currentGroup = { id: open[1], label: (open[2] ?? open[1]).trim(), members: [] }
            groups.set(currentGroup.id, currentGroup)
            groupOrder.push(currentGroup.id)
            continue
          }
          if (/^end\s*$/i.test(line)) {
            currentGroup = null
            continue
          }
          // `classDef name fill:#f96,stroke:#333` styles a class of nodes.
          const classDef = /^classDef\s+([\w-]+)\s+(.+)$/i.exec(line)
          if (classDef !== null) {
            const style = {}
            for (const declaration of classDef[2].split(',')) {
              const [key, value] = declaration.split(':').map((part) => part.trim())
              if (value === undefined) continue
              if (key === 'fill' && safeColor(value) !== null) style.background = value
              else if (key === 'stroke' && safeColor(value) !== null) style.borderColor = value
              else if (key === 'color' && safeColor(value) !== null) style.color = value
            }
            classStyles.set(classDef[1], style)
            continue
          }
          // `class A,B name` assigns nodes to a class.
          const classAssign = /^class\s+([\w,\s-]+?)\s+([\w-]+)$/i.exec(line)
          if (classAssign !== null) {
            for (const id of classAssign[1].split(',').map((part) => part.trim()).filter(Boolean)) {
              nodeClasses.set(id, classAssign[2])
            }
            continue
          }
          const attach = (node) => {
            if (node === null) return null
            const stored = remember(node)
            if (currentGroup !== null && !currentGroup.members.includes(stored.id)) {
              currentGroup.members.push(stored.id)
            }
            return stored
          }
          // Split an edge into its left and right side; the connector token
          // carries the stroke style and the arrow head.
          const edge = /^(.*?)\s*([<xo]?[-.=]+[>xo]?)\s*(?:\|([^|]*)\|)?\s*(.+)$/.exec(line)
          if (edge === null) {
            attach(parseMermaidNode(line))
            continue
          }
          const left = attach(parseMermaidNode(edge[1]))
          const right = attach(parseMermaidNode(edge[4]))
          if (left === null || right === null) continue
          const connector = edge[2]
          const style = /[=]/.test(connector) ? 'thick' : /[.]/.test(connector) ? 'dotted' : 'normal'
          const last = connector[connector.length - 1]
          const firstChar = connector[0]
          const headChar = last === '>' || last === 'x' || last === 'o' ? last : '-'
          edges.push({
            from: left.id,
            to: right.id,
            label: edge[3] ?? '',
            style,
            head: MERID_HEAD(firstChar, headChar),
          })
        }
        if (nodes.size === 0) return null
        // A node belongs to the first group that claimed it.
        const membership = new Map()
        for (const id of groupOrder) {
          for (const member of groups.get(id).members) {
            if (!membership.has(member)) membership.set(member, id)
          }
        }
        return {
          kind: 'flowchart',
          direction,
          nodes: [...nodes.values()].map((node) => ({
            ...node,
            ...(membership.has(node.id) ? { group: membership.get(node.id) } : {}),
          })),
          edges,
          groups: groupOrder.map((id) => ({ id, label: groups.get(id).label })),
          classes: [...classStyles.entries()].map(([name, style]) => ({ name, style })),
          nodeClasses: [...nodeClasses.entries()].map(([id, name]) => ({ id, name })),
        }
      }

      if (/^sequenceDiagram/i.test(head)) {
        const actors = []
        const messages = []
        const remember = (name) => {
          const clean = name.trim().replace(/;$/, '')
          if (clean !== '' && !actors.includes(clean)) actors.push(clean)
          return clean
        }
        for (const line of lines.slice(1)) {
          const declare = /^(?:participant|actor)\s+(.+)$/i.exec(line)
          if (declare !== null) {
            remember(declare[1])
            continue
          }
          // `->>` solid arrow, `-->>` dotted, `-x` cross, `-)` open head.
          const message = /^([^:]+?)\s*(-{1,2})(>>|>|x|\))\s*([^:]+?)\s*:\s*(.*)$/.exec(line)
          if (message === null) continue
          const from = remember(message[1])
          const to = remember(message[4])
          if (from === '' || to === '') continue
          messages.push({
            from,
            to,
            text: message[5],
            style: message[2] === '--' ? 'dotted' : 'solid',
            head: message[3] === 'x' ? 'cross' : message[3] === ')' ? 'open' : 'arrow',
          })
        }
        if (actors.length === 0) return null
        return { kind: 'sequence', actors, messages }
      }

      if (/^pie\b/i.test(head)) {
        const slices = []
        for (const line of lines.slice(1)) {
          const slice = /^"([^"]*)"\s*:\s*([0-9.]+)$/.exec(line)
          if (slice !== null) slices.push({ label: slice[1], value: Number.parseFloat(slice[2]) })
        }
        if (slices.length === 0) return null
        return { kind: 'pie', slices }
      }

      return null
    }

    /** A short, stable colour per pie slice. */
    const PIE_COLOURS = ['#4c78a8', '#f58518', '#54a24b', '#e45756', '#72b7b2', '#eeca3b', '#b279a2', '#ff9da6']

    /**
     * Lay a flowchart out by depth from its roots.
     * @param diagram - parsed flowchart.
     * @returns positions per node id and the canvas size.
     */
    /**
     * Lay a flowchart out by depth, then order each depth to cut crossings.
     * One barycentre sweep per depth is enough for the diagram sizes a fence
     * usually holds; the shapes stay on a fixed grid so lines can be ortho.
     * @param diagram - parsed flowchart.
     * @returns positions per node id and the canvas size.
     */
    function layoutMermaid(diagram) {
      const incoming = new Map(diagram.nodes.map((node) => [node.id, 0]))
      for (const edge of diagram.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
      const depth = new Map()
      const queue = diagram.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id)
      for (const id of queue) depth.set(id, 0)
      // Nodes inside a cycle start at depth 1 so they still get placed.
      for (const node of diagram.nodes) if (!depth.has(node.id)) depth.set(node.id, 1)
      let guard = 0
      while (queue.length > 0 && guard < 2000) {
        guard += 1
        const id = queue.shift()
        for (const edge of diagram.edges.filter((candidate) => candidate.from === id)) {
          const next = Math.max(depth.get(edge.to) ?? 0, (depth.get(id) ?? 0) + 1)
          if (next !== depth.get(edge.to)) {
            depth.set(edge.to, next)
            queue.push(edge.to)
          }
        }
      }

      // Group by depth, then sweep depths top-down and bottom-up ordering each
      // row by the average position of its neighbours.
      const rows = new Map()
      for (const node of diagram.nodes) {
        const column = depth.get(node.id) ?? 0
        if (!rows.has(column)) rows.set(column, [])
        rows.get(column).push(node)
      }
      const order = new Map()
      for (const [column, list] of rows) {
        list.forEach((node, index) => order.set(node.id, index))
      }
      const neighbours = (id) => [
        ...diagram.edges.filter((edge) => edge.to === id).map((edge) => edge.from),
        ...diagram.edges.filter((edge) => edge.from === id).map((edge) => edge.to),
      ]
      const sweep = (columns) => {
        for (const column of columns) {
          const list = rows.get(column)
          if (list === undefined || list.length < 2) continue
          const scored = list.map((node) => {
            const links = neighbours(node.id).filter((other) => order.has(other))
            const sum = links.reduce((total, other) => total + order.get(other), 0)
            const groupRank =
              diagram.groups === undefined || node.group === undefined
                ? 0
                : diagram.groups.findIndex((group) => group.id === node.group)
            // Members of one subgraph stay together; the barycentre orders the
            // groups against each other.
            return {
              node,
              score: links.length === 0 ? order.get(node.id) : sum / links.length,
              groupRank,
            }
          })
          scored.sort((a, b) => a.groupRank - b.groupRank || a.score - b.score)
          scored.forEach((entry, index) => order.set(entry.node.id, index))
          rows.set(column, scored.map((entry) => entry.node))
        }
      }
      const columnsAscending = [...rows.keys()].sort((a, b) => a - b)
      sweep(columnsAscending)
      sweep([...columnsAscending].reverse())
      sweep(columnsAscending)

      const horizontal = diagram.direction === 'LR' || diagram.direction === 'RL'
      const stepX = 190
      const stepY = 84
      const positions = new Map()
      for (const column of columnsAscending) {
        const list = rows.get(column) ?? []
        const span = Math.max(0, ...list.map((_, index) => index))
        list.forEach((node, row) => {
          // Centre a short row against the widest one so the picture stays tidy.
          const widest = Math.max(0, ...[...rows.values()].map((entry) => entry.length - 1))
          const offset = ((widest - span) * stepX) / 2
          positions.set(node.id, {
            x: 30 + (horizontal ? column * stepX : offset + row * stepX),
            y: 30 + (horizontal ? offset + row * stepY : column * stepY),
          })
        })
      }
      const points = [...positions.values()]
      const maxX = Math.max(...points.map((point) => point.x)) + 180
      const maxY = Math.max(...points.map((point) => point.y)) + 80
      return { positions, width: Math.max(240, maxX), height: Math.max(120, maxY) }
    }

    /**
     * A right-angled connector between two node centres.
     * @param from - source position.
     * @param to - target position.
     * @param horizontal - whether the flow runs left to right.
     * @returns the path data.
     */
    /**
     * Pick a lane between two rows (or columns) that no node box blocks.
     * @param ideal - the midpoint the simple route would use.
     * @param low - the start of the allowed range.
     * @param high - the end of the allowed range.
     * @param spans - the crossing axis span the lane must clear.
     * @param boxes - obstacle boxes as `{ low, high, from, to }` on that axis.
     * @returns the lane coordinate.
     */
    function clearLane(ideal, low, high, spans, boxes) {
      const blocking = boxes.filter(
        (box) => box.from < spans.high && box.to > spans.low && ideal > box.low - 4 && ideal < box.high + 4,
      )
      if (blocking.length === 0) return ideal
      const margin = 8
      const candidates = []
      for (const box of blocking) {
        const above = Math.round(box.low - margin)
        const below = Math.round(box.high + margin)
        if (above > low && above < high) candidates.push(above)
        if (below > low && below < high) candidates.push(below)
      }
      if (candidates.length === 0) return ideal
      // Prefer the lane nearest the ideal one and free of every blocker.
      candidates.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))
      for (const candidate of candidates) {
        const stillBlocked = boxes.some(
          (box) =>
            box.from < spans.high && box.to > spans.low && candidate > box.low - 4 && candidate < box.high + 4,
        )
        if (!stillBlocked) return candidate
      }
      return candidates[0]
    }

    /**
     * A right-angled connector between two node centres, routed through a lane
     * that does not run through another node.
     * @param from - source position.
     * @param to - target position.
     * @param horizontal - whether the flow runs left to right.
     * @param obstacles - node boxes as `{ x, y, w, h }`.
     * @returns the path data.
     */
    function orthogonalEdge(from, to, horizontal, obstacles) {
      const boxes = Array.isArray(obstacles) ? obstacles : []
      const x1 = from.x + 70
      const y1 = from.y + 20
      const x2 = to.x + 70
      const y2 = to.y + 20

      if (horizontal) {
        if (Math.abs(y1 - y2) < 1) {
          const span = { low: Math.min(x1, x2) + 4, high: Math.max(x1, x2) - 4 }
          const blockers = boxes
            .map((box) => ({ low: box.y - 4, high: box.y + box.h + 4, from: box.x, to: box.x + box.w }))
            .filter((box) => box.from < span.high && box.to > span.low && y1 > box.low && y1 < box.high)
          if (blockers.length === 0) return `M ${x1} ${y1} H ${x2}`
          // Detour above or below the first blocker that sits in the way.
          const blocker = blockers[0]
          const lane = Math.round(
            Math.abs(blocker.low - y1) < Math.abs(blocker.high - y1) ? blocker.low - 8 : blocker.high + 8,
          )
          const midX = Math.round((x1 + x2) / 2)
          return `M ${x1} ${y1} V ${lane} H ${midX} V ${y1} H ${x2}`
        }
        const low = Math.min(x1, x2) + 6
        const high = Math.max(x1, x2) - 6
        const midX = clearLane(
          Math.round((x1 + x2) / 2),
          low,
          high,
          { low: Math.min(y1, y2), high: Math.max(y1, y2) },
          boxes.map((box) => ({ low: box.x - 4, high: box.x + box.w + 4, from: box.y, to: box.y + box.h })),
        )
        return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
      }

      if (Math.abs(x1 - x2) < 1) {
        const blockers = boxes
          .map((box) => ({ low: box.y - 4, high: box.y + box.h + 4, from: box.x, to: box.x + box.w }))
          .filter((box) => box.from < x1 && box.to > x1 && box.low > Math.min(y1, y2) && box.high < Math.max(y1, y2))
        if (blockers.length === 0) return `M ${x1} ${y1} V ${y2}`
        const blocker = blockers[0]
        const lane = x1 + 18
        const midY = Math.round(blocker.low - 8)
        return `M ${x1} ${y1} V ${midY} H ${lane} V ${blocker.high + 8} H ${x1} V ${y2}`
      }

      const low = Math.min(y1, y2) + 6
      const high = Math.max(y1, y2) - 6
      const midY = clearLane(
        Math.round((y1 + y2) / 2),
        low,
        high,
        { low: Math.min(x1, x2), high: Math.max(x1, x2) },
        boxes.map((box) => ({ low: box.y - 4, high: box.y + box.h + 4, from: box.x, to: box.x + box.w })),
      )
      return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`
    }

    /**
     * Render one parsed diagram to SVG children.
     * @param diagram - output of parseMermaid.
     * @returns the diagram element.
     */
    function renderMermaid(diagram) {
      if (diagram.kind === 'sequence') {
        const width = Math.max(320, diagram.actors.length * 150)
        const rows = diagram.messages.length + 1
        return h(
          'svg',
          { className: 'dcw-mmd', viewBox: `0 0 ${width} ${40 + rows * 34}`, role: 'img' },
          diagram.actors.map((actor, index) =>
            h('rect', { key: `a${index}`, x: 20 + index * 150, y: 8, width: 130, height: 26, rx: 4, className: 'dcw-mmd-actor' }),
          ),
          diagram.actors.map((actor, index) =>
            h('text', { key: `t${index}`, x: 85 + index * 150, y: 26, className: 'dcw-mmd-actorlabel' }, actor),
          ),
          diagram.actors.map((_, index) =>
            h('line', { key: `l${index}`, x1: 85 + index * 150, y1: 34, x2: 85 + index * 150, y2: 40 + rows * 34, className: 'dcw-mmd-lifeline' }),
          ),
          diagram.messages.map((message, index) => {
            const from = diagram.actors.indexOf(message.from)
            const to = diagram.actors.indexOf(message.to)
            const y = 60 + index * 34
            return h(
              'g',
              { key: `m${index}` },
              h('text', { x: (85 + from * 150 + 85 + to * 150) / 2, y: y - 6, className: 'dcw-mmd-msg' }, message.text),
              h('line', {
                x1: 85 + from * 150,
                y1: y,
                x2: 85 + to * 150,
                y2: y,
                className: `dcw-mmd-edge dcw-mmd-${message.style}`,
                markerEnd: message.head === 'arrow' ? 'url(#dcw-mmd-arrow)' : undefined,
              }),
            )
          }),
        )
      }

      if (diagram.kind === 'pie') {
        const total = diagram.slices.reduce((sum, slice) => sum + slice.value, 0) || 1
        let angle = -Math.PI / 2
        const radius = 70
        const centre = 90
        const arcs = diagram.slices.map((slice, index) => {
          const sweep = (slice.value / total) * Math.PI * 2
          const start = angle
          const end = angle + sweep
          angle = end
          const large = sweep > Math.PI ? 1 : 0
          const x1 = centre + radius * Math.cos(start)
          const y1 = centre + radius * Math.sin(start)
          const x2 = centre + radius * Math.cos(end)
          const y2 = centre + radius * Math.sin(end)
          return h('path', {
            key: `s${index}`,
            d: `M ${centre} ${centre} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
            fill: PIE_COLOURS[index % PIE_COLOURS.length],
          })
        })
        return h(
          'svg',
          { className: 'dcw-mmd', viewBox: '0 0 360 180', role: 'img' },
          arcs,
          diagram.slices.map((slice, index) =>
            h(
              'g',
              { key: `k${index}` },
              h('rect', { x: 200, y: 24 + index * 20, width: 10, height: 10, fill: PIE_COLOURS[index % PIE_COLOURS.length] }),
              h('text', { x: 216, y: 33 + index * 20, className: 'dcw-mmd-msg' }, `${slice.label} ${Math.round((slice.value / total) * 100)}%`),
            ),
          ),
        )
      }

      const { positions, width, height } = layoutMermaid(diagram)
      const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]))
      // One box per subgraph, drawn behind its members.
      const boxes = []
      for (const group of diagram.groups ?? []) {
        const members = diagram.nodes.filter((node) => node.group === group.id)
        const points = members.map((node) => positions.get(node.id)).filter((point) => point !== undefined)
        if (points.length === 0) continue
        const left = Math.min(...points.map((point) => point.x)) - 12
        const top = Math.min(...points.map((point) => point.y)) - 26
        const right = Math.max(...points.map((point) => point.x)) + 152
        const bottom = Math.max(...points.map((point) => point.y)) + 52
        boxes.push({ group, left, top, right, bottom })
      }
      return h(
        'svg',
        { className: 'dcw-mmd', viewBox: `0 0 ${width} ${height}`, role: 'img' },
        boxes.map((box) =>
          h(
            'g',
            { key: `g${box.group.id}` },
            h('rect', {
              x: box.left,
              y: box.top,
              width: box.right - box.left,
              height: box.bottom - box.top,
              rx: 6,
              className: 'dcw-mmd-cluster',
            }),
            h('text', { x: box.left + 8, y: box.top + 14, className: 'dcw-mmd-clusterlabel' }, box.group.label),
          ),
        ),
        h(
          'defs',
          null,
          h(
            'marker',
            { id: 'dcw-mmd-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' },
            h('path', { d: 'M0 0 L8 4 L0 8 z', fill: 'currentColor' }),
          ),
        ),
        diagram.edges.map((edge, index) => {
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (from === undefined || to === undefined) return null
          // Boxes of every other node, so the connector can dodge them.
          const obstacles = [...positions.entries()]
            .filter(([id]) => id !== edge.from && id !== edge.to)
            .map(([, point]) => ({ x: point.x, y: point.y, w: 140, h: 40 }))
          const x1 = from.x + 70
          const y1 = from.y + 20
          const x2 = to.x + 70
          const y2 = to.y + 20
          const horizontal = diagram.direction === 'LR' || diagram.direction === 'RL'
          return h(
            'g',
            { key: `e${index}` },
            h('path', {
              d: orthogonalEdge(from, to, horizontal, obstacles),
              className: `dcw-mmd-edge dcw-mmd-${edge.style}`,
              markerEnd: edge.head === 'arrow' ? 'url(#dcw-mmd-arrow)' : undefined,
            }),
            edge.label === ''
              ? null
              : h('text', { x: (x1 + x2) / 2 + 4, y: (y1 + y2) / 2 - 5, className: 'dcw-mmd-edgelabel' }, edge.label),
          )
        }),
        diagram.nodes.map((node) => {
          const point = positions.get(node.id)
          if (point === undefined) return null
          const shape =
            node.shape === 'diamond'
              ? h('path', {
                  d: `M ${point.x + 70} ${point.y} L ${point.x + 140} ${point.y + 20} L ${point.x + 70} ${point.y + 40} L ${point.x} ${point.y + 20} Z`,
                  className: 'dcw-mmd-node',
                })
              : h('rect', {
                  x: point.x,
                  y: point.y,
                  width: 140,
                  height: 40,
                  rx: node.shape === 'circle' || node.shape === 'round' || node.shape === 'stadium' ? 18 : 3,
                  className: 'dcw-mmd-node',
                })
          // A node may inherit a class style declared with `classDef`.
          const className = (diagram.nodeClasses ?? []).find((entry) => entry.id === node.id)?.name
          const style = (diagram.classes ?? []).find((entry) => entry.name === className)?.style
          const shapeStyled =
            style === undefined
              ? shape
              : { ...shape, props: { ...shape.props, style } }
          return h(
            'g',
            { key: `n${node.id}` },
            shapeStyled,
            h(
              'text',
              {
                x: point.x + 70,
                y: point.y + 24,
                className: 'dcw-mmd-label',
                ...(style !== undefined && style.color !== undefined ? { style: { fill: style.color } } : {}),
              },
              node.label,
            ),
          )
        }),
      )
    }

    /**
     * Render a mermaid fence, falling back to its source when unparsable.
     * @param source - the fence body.
     * @returns React children.
     */
    function renderMermaidSource(source) {
      try {
        const diagram = parseMermaid(source)
        if (diagram === null) return null
        return renderMermaid(diagram)
      } catch {
        return null
      }
    }

    /** Elements that must not get a closing tag when serialising. */
    const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'col', 'source', 'track'])

    /** Escape text for HTML output. */
    function escapeHtml(text) {
      return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    /**
     * Serialise a React child tree to an HTML string.
     * @param children - React children.
     * @returns the markup.
     */
    function nodeToHtml(children) {
      const parts = []
      for (const child of Array.isArray(children) ? children : [children]) {
        if (child === null || child === undefined || typeof child === 'boolean') continue
        if (typeof child === 'string' || typeof child === 'number') {
          parts.push(escapeHtml(child))
          continue
        }
        if (Array.isArray(child)) {
          parts.push(nodeToHtml(child))
          continue
        }
        const tag = child.type
        if (typeof tag !== 'string' || tag === 'Fragment') {
          parts.push(nodeToHtml(child.children ?? []))
          continue
        }
        const attributes = []
        for (const [name, value] of Object.entries(child.props ?? {})) {
          if (name === 'key' || name === 'children' || value === undefined || value === null) continue
          if (name === 'dangerouslySetInnerHTML') continue
          if (name === 'checked') {
            if (value === true) attributes.push('checked')
            continue
          }
          if (name === 'style' && typeof value === 'object') {
            const inline = Object.entries(value)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; ')
            if (inline !== '') attributes.push(`style="${escapeHtml(inline)}"`)
            continue
          }
          // React names become HTML names on the way out.
          const outName = name === 'className' ? 'class' : name === 'htmlFor' ? 'for' : name
          attributes.push(`${outName}="${escapeHtml(value)}"`)
        }
        const open = `<${tag}${attributes.length === 0 ? '' : ` ${attributes.join(' ')}`}>`
        if (VOID_TAGS.has(tag)) {
          parts.push(open)
          continue
        }
        const inner =
          child.props !== undefined && child.props.dangerouslySetInnerHTML !== undefined
            ? String(child.props.dangerouslySetInnerHTML.__html ?? '')
            : nodeToHtml(child.children ?? [])
        parts.push(`${open}${inner}</${tag}>`)
      }
      return parts.join('')
    }

    /**
     * Wrap rendered markup in a standalone document.
     * @param options - title, body markup and stylesheet.
     * @returns a complete HTML document.
     */
    function buildExportDocument(options) {
      const title = String(options.title ?? '文档').replace(/\.(md|markdown|txt)$/i, '')
      return [
        '<!doctype html>',
        '<html lang="zh">',
        '<head>',
        '<meta charset="utf-8">',
        `<title>${escapeHtml(title)}</title>`,
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<style>${options.css ?? ''}</style>`,
        '</head>',
        '<body class="typora-export">',
        '<div id="write">',
        options.body ?? '',
        '</div>',
        '</body>',
        '</html>',
        '',
      ].join('\n')
    }

    /**
     * Export one document as a downloadable HTML file.
     * @param options - title, body markup and stylesheet.
     */
    function downloadHtml(options) {
      const html = buildExportDocument(options)
      const name = `${String(options.title ?? 'document')
        .replace(/\.(md|markdown|txt)$/i, '')
        .replace(/[\\\\/:*?"<>|]/g, '-')}.html`
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }

    /** Render one list block, honouring task items and visual indentation. */
    function renderList(block, key, inlineOf, onToggleTask) {
      const tag = block.ordered ? 'ol' : 'ul'
      const props = { key, className: 'dcw-md-list' }
      if (block.ordered) {
        if (block.start !== 1) props.start = block.start
      } else if (typeof block.pattern === 'string' && block.pattern !== '') {
        props['data-mark'] = block.pattern
      }
      const items = block.items.map((item, index) => {
        const itemKey = `${key}-${index}`
        const children = []
        if (item.task !== null) {
          children.push(
            h('input', {
              key: 'mark',
              type: 'checkbox',
              checked: item.task === 'checked',
              ...(onToggleTask === null || onToggleTask === undefined
                ? { readOnly: true, tabIndex: -1 }
                : { onChange: () => onToggleTask(item) }),
            }),
          )
        }
        const lines = String(item.value).split('\n')
        lines.forEach((line, lineIndex) => {
          children.push(...inlineOf(line, `${itemKey}-${lineIndex}`))
          if (lineIndex < lines.length - 1) children.push(h('br', { key: `${itemKey}-br${lineIndex}` }))
        })
        const indent = Math.min(6, Math.floor(item.indent / 2))
        return h(
          'li',
          {
            key: itemKey,
            className: 'dcw-md-li',
            style: indent > 0 ? { marginLeft: `${indent * 1.1}em` } : undefined,
          },
          children,
        )
      })
      return h(tag, props, items)
    }

    /** Render one pipe table. */
    function renderTable(block, key, inlineOf) {
      const cellStyle = (column) => {
        const align = block.align[column]
        return align ? { textAlign: align } : undefined
      }
      /**
       * Where one cell's text starts inside the block's raw source, so clicking
       * it puts the caret in that cell instead of at the table's end.
       * @param rowIndex - 0 is the header row.
       * @param column - the column index.
       * @returns the offset, or undefined when the block carries no metadata.
       */
      const cellBase = (rowIndex, column) => {
        const row = block.rowMeta === undefined ? undefined : block.rowMeta[rowIndex]
        const cell = row === undefined ? undefined : row.cells[column]
        if (row === undefined || cell === undefined) return undefined
        return row.from + cell.from - block.from
      }
      const head = h(
        'thead',
        { key: 'head' },
        h(
          'tr',
          null,
          block.header.map((cell, column) =>
            h(
              'th',
              { key: `h${column}`, style: cellStyle(column) },
              inlineOf(cell, `${key}-h${column}`, cellBase(0, column)),
            ),
          ),
        ),
      )
      const body =
        block.rows.length === 0
          ? null
          : h(
              'tbody',
              { key: 'body' },
              block.rows.map((row, rowIndex) =>
                h(
                  'tr',
                  { key: `r${rowIndex}` },
                  block.header.map((_, column) =>
                    h(
                      'td',
                      { key: `c${column}`, style: cellStyle(column) },
                      inlineOf(row[column] ?? '', `${key}-r${rowIndex}c${column}`, cellBase(rowIndex + 1, column)),
                    ),
                  ),
                ),
              ),
            )
      return h('div', { key, className: 'dcw-md-tablewrap' }, h('table', null, head, body))
    }

    /**
     * Render parsed blocks to React children.
     * @param blocks - output of parseBlocks.
     * @param options - `clickMap` marks each text run with its source offset;
     *   `source` is the document those offsets refer to.
     * @returns React children for a document container.
     */
    function renderBlocks(blocks, options) {
      const clickMap = options !== undefined && options.clickMap === true
      const source = options !== undefined && typeof options.source === 'string' ? options.source : ''
      const highlight = options !== undefined && options.highlight !== undefined ? options.highlight : null
      const images = options !== undefined && options.images !== undefined ? options.images : null
      const taskToggle = options !== undefined && options.taskToggle !== undefined ? options.taskToggle : null
      const footnoteState =
        options !== undefined && options.footnoteState !== undefined ? options.footnoteState : null
      const headings = options !== undefined && Array.isArray(options.headings) ? options.headings : []
      const lineNumbers = options !== undefined && options.lineNumbers === true
      const anchors = options !== undefined && options.anchors !== undefined ? options.anchors : null
      const onAnchor = options !== undefined && typeof options.onAnchor === 'function' ? options.onAnchor : null
      const flashAnchor = options !== undefined && typeof options.flashAnchor === 'function' ? options.flashAnchor : null
      const copyCode = options !== undefined && typeof options.copyCode === 'function' ? options.copyCode : () => {}
      const languageFor = options !== undefined && typeof options.commitLanguage === 'function' ? options.commitLanguage : null
      const languageEditing = options !== undefined ? options.languageEdit : null
      const openLanguage = options !== undefined && typeof options.openLanguage === 'function' ? options.openLanguage : () => {}
      const scrollTo = options !== undefined && typeof options.scrollTo === 'function' ? options.scrollTo : () => {}
      const t = options !== undefined && typeof options.t === 'function' ? options.t : (key) => key
      return blocks.map((block, index) => {
        const key = `b${index}`
        const shift = clickMap ? blockShift(block, source) : null
        const mapped = clickMap && shift !== null
        const inlineOf = (value, prefix, base) => {
          const origin = typeof base === 'number' ? base : shift ?? 0
          const mappable = typeof base === 'number' || mapped
          return renderInline(parseInline(value, origin), prefix, clickMap && mappable, highlight, images, footnoteState, anchors, onAnchor)
        }
        if (block.type === 'blank') return h('div', { key, className: 'dcw-md-blank' })
        if (block.type === 'heading') {
          const slug = headings.length === 0 ? '' : headingSlug(block.value)
          return h(
            `h${block.level}`,
            {
              key,
              className: `dcw-md-h dcw-md-h${block.level}`,
              ...(slug === '' ? {} : { id: `dcw-h-${slug}` }),
            },
            inlineOf(block.value, key),
          )
        }
        if (block.type === 'paragraph') {
          return h('p', { key, className: 'dcw-md-p' }, inlineOf(block.value, key))
        }
        if (block.type === 'hr') return h('hr', { key, className: 'dcw-md-hr' })
        if (block.type === 'math') {
          const display = renderMathDisplay(block.value)
          return h(
            'div',
            { key, className: 'dcw-md-mathblock' },
            h('span', { key: 'body', className: 'dcw-md-mathbody' }, display.content),
            display.tag === null
              ? null
              : h('span', { key: 'tag', className: 'dcw-md-mathtag' }, `(${display.tag})`),
          )
        }
        if (block.type === 'toc') {
          // The list is derived from the current parse, so editing a heading
          // refreshes the table of contents on the next keystroke.
          if (headings.length === 0) {
            return h('div', { key, className: 'dcw-md-toc dcw-md-toc-empty' }, t('toc.empty'))
          }
          return h(
            'div',
            { key, className: 'dcw-md-toc', role: 'list' },
            headings.map((heading, index) =>
              h(
                'button',
                {
                  key: `${key}-${index}`,
                  type: 'button',
                  role: 'listitem',
                  className: `dcw-md-toc-inner dcw-md-toc-h${heading.level}`,
                  onClick: () => scrollTo(heading.from),
                },
                heading.value,
              ),
            ),
          )
        }
        if (block.type === 'html') {
          return h('div', {
            key,
            className: 'dcw-md-html',
            dangerouslySetInnerHTML: { __html: sanitizeHtml(block.value) },
          })
        }
        if (block.type === 'meta') {
          return h('pre', { key, className: 'dcw-md-meta' }, block.value)
        }
        if (block.type === 'alert') {
          const kind = block.alert
          return h(
            'div',
            { key, className: `dcw-md-alert dcw-md-alert-${kind}`, 'data-kind': kind },
            h('div', { key: 'label', className: 'dcw-md-alert-label' }, kind),
            block.lines.map((line, lineIndex) =>
              h(
                'p',
                { key: `${key}-${lineIndex}` },
                renderInline(parseInline(line), `${key}-${lineIndex}`, false, highlight, images, footnoteState, anchors, onAnchor),
              ),
            ),
          )
        }
        if (block.type === 'footnote') {
          return h(
            'div',
            { key, className: 'dcw-md-fn-def', id: `dcw-fn-${block.id}` },
            h('span', { key: 'label', className: 'dcw-md-fn-label' }, block.id),
            inlineOf(block.value, key),
            h(
              'a',
              {
                key: 'back',
                className: 'dcw-md-fn-back',
                href: `#dcw-fnref-${block.id}`,
                title: 'return',
                ...(flashAnchor === null
                  ? {}
                  : {
                      onClick: (event) => {
                        event.preventDefault()
                        flashAnchor(`dcw-fnref-${block.id}`)
                      },
                    }),
              },
              '↩',
            ),
          )
        }
        if (block.type === 'quote') {
          // Quote lines lose their markers, so a click maps to the block end.
          return h(
            'blockquote',
            { key, className: 'dcw-md-quote' },
            block.lines.map((line, lineIndex) =>
              h(
                'p',
                { key: `${key}-${lineIndex}` },
                renderInline(parseInline(line), `${key}-${lineIndex}`, false, highlight, images),
              ),
            ),
          )
        }
        if (block.type === 'code') {
          // A ```math fence is rendered as display math, like the reference.
          if (/^(math|latex|tex)$/i.test(block.lang)) {
            const fenceDisplay = renderMathDisplay(block.value)
            return h(
              'div',
              { key, className: 'dcw-md-mathblock', lang: block.lang },
              h('span', { key: 'body', className: 'dcw-md-mathbody' }, fenceDisplay.content),
              fenceDisplay.tag === null
                ? null
                : h('span', { key: 'tag', className: 'dcw-md-mathtag' }, `(${fenceDisplay.tag})`),
            )
          }
          // Diagram fences render as a picture; unparsable ones stay code.
          if (/^(mermaid|flow|flowchart)$/i.test(block.lang)) {
            const drawn = renderMermaidSource(block.value)
            if (drawn !== null) {
              return h('div', { key, className: 'dcw-md-diagram', lang: block.lang }, drawn)
            }
          }
          const label = block.lang === '' ? null : block.lang
          return h(
            'div',
            {
              key,
              className: 'dcw-md-codeblock',
              lang: block.lang,
              'data-lineno': lineNumbers ? 'true' : 'false',
            },
            label === null
              ? null
              : h(
                  'div',
                  { key: 'panel', className: 'dcw-md-fencepanel' },
                  languageEditing === block.from && languageFor !== null
                    ? h('input', {
                        key: 'langinput',
                        className: 'dcw-md-langinput',
                        defaultValue: label,
                        autoFocus: true,
                        'aria-label': 'language',
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            languageFor(block, event.target.value)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setLanguageEdit(null)
                          }
                        },
                        onBlur: (event) => languageFor(block, event.target.value),
                      })
                    : h(
                        'button',
                        {
                          key: 'lang',
                          type: 'button',
                          className: 'dcw-md-lang dcw-md-langbtn',
                          title: t('code.language'),
                          onMouseDown: (event) => event.preventDefault(),
                          onClick: () => openLanguage(block.from),
                        },
                        label,
                      ),
                  h(
                    'button',
                    {
                      key: 'copy',
                      type: 'button',
                      className: 'dcw-md-fencebtn',
                      title: 'copy',
                      onMouseDown: (event) => event.preventDefault(),
                      onClick: () => copyCode(block.value),
                    },
                    '⧉',
                  ),
                ),
            h(
              'pre',
              { key: 'pre' },
              mapped && !lineNumbers
                ? h('code', null, h('span', { 'data-dcw-f': String(shift) }, block.value))
                : h(
                    'code',
                    null,
                    mapped
                      ? h('span', { 'data-dcw-f': String(shift) }, renderCode(block.value, block.lang, lineNumbers))
                      : renderCode(block.value, block.lang, lineNumbers),
                  ),
            ),
          )
        }
        if (block.type === 'list') return renderList(block, key, inlineOf, taskToggle)
        if (block.type === 'table') return renderTable(block, key, inlineOf)
        return h('p', { key, className: 'dcw-md-p' }, block.value ?? '')
      })
    }

    /**
     * Wrap the selection in an inline marker, or insert an empty pair and put
     * the caret between them.
     * @param value - the text being edited.
     * @param start - selection start.
     * @param end - selection end.
     * @param marker - the marker, such as `**` or a backtick.
     * @returns the new text and where the caret belongs.
     */
    function applyFormatting(value, start, end, marker) {
      const from = Math.max(0, Math.min(start, value.length))
      const to = Math.max(from, Math.min(end, value.length))
      const selected = value.slice(from, to)
      if (from === to) {
        return {
          value: value.slice(0, from) + marker + marker + value.slice(from),
          caret: from + marker.length,
        }
      }
      return {
        value: value.slice(0, from) + marker + selected + marker + value.slice(to),
        caret: from + marker.length + selected.length + marker.length,
      }
    }

    /** The inline marker a formatting shortcut stands for, or null. */
    function markerForKey(event) {
      if (!event.metaKey && !event.ctrlKey) return null
      const key = String(event.key ?? '').toLowerCase()
      if (key === 'b') return '**'
      if (key === 'i') return '*'
      if (key === 'e') return '`'
      return null
    }

    /**
     * Collect the source ranges of inline nodes that carry hidden markers.
     * The reference expands such a node when the caret sits on it and pushes
     * the caret to the node's outer edge; here the caret alone can move.
     * @param nodes - parsed inline nodes.
     * @param out - accumulator.
     * @returns the ranges.
     */
    function markerRanges(nodes, out = []) {
      for (const node of nodes) {
        if (typeof node.from === 'number' && typeof node.to === 'number' && node.weight > 0) {
          out.push({ from: node.from, to: node.to, weight: node.weight })
        }
        if (node.children !== undefined) markerRanges(node.children, out)
      }
      return out
    }

    /**
     * Snap a caret that landed inside a marker run to that node's outer edge.
     * @param caret - the raw caret offset.
     * @param ranges - marker ranges from markerRanges.
     * @returns the snapped caret.
     */
    function snapToBoundary(caret, ranges) {
      let best = caret
      let tightest = Number.POSITIVE_INFINITY
      for (const range of ranges) {
        const span = range.to - range.from
        if (span >= tightest) continue
        if (caret >= range.from && caret <= range.from + range.weight) {
          best = range.from
          tightest = span
        } else if (caret >= range.to - range.weight && caret <= range.to) {
          best = range.to
          tightest = span
        }
      }
      return best
    }

    /**
     * Indent or outdent the caret's line by one two-space step.
     * @param value - the block source.
     * @param caret - caret offset.
     * @param outdent - remove indentation instead of adding it.
     * @returns the new source and caret, or null when there is nothing to remove.
     */
    function indentLine(value, caret, outdent) {
      const lineStart = value.lastIndexOf('\n', caret - 1) + 1
      let lineEnd = value.indexOf('\n', caret)
      if (lineEnd < 0) lineEnd = value.length
      const line = value.slice(lineStart, lineEnd)
      if (!outdent) {
        return { value: value.slice(0, lineStart) + '  ' + value.slice(lineStart), caret: caret + 2 }
      }
      const strip = /^ {1,2}/.exec(line)
      if (strip === null) return null
      const next = value.slice(0, lineStart) + line.slice(strip[0].length) + value.slice(lineEnd)
      return { value: next, caret: Math.max(lineStart, caret - strip[0].length) }
    }

    /**
     * The line range around a caret.
     * @param value - the block source.
     * @param caret - caret offset.
     * @returns the start, end and caret offset inside the line.
     */
    function lineRange(value, caret) {
      const text = String(value ?? '')
      const position = Math.max(0, Math.min(caret, text.length))
      const start = text.lastIndexOf('\n', position - 1) + 1
      const nextBreak = text.indexOf('\n', position)
      const end = nextBreak < 0 ? text.length : nextBreak
      return { start, end, column: position - start }
    }

    /**
     * Move, duplicate or delete the caret's line.
     * @param value - the block source.
     * @param caret - caret offset.
     * @param operation - `up`, `down`, `duplicate` or `delete`.
     * @returns the new source and caret, or null when nothing can move.
     */
    function lineOperation(value, caret, operation) {
      const text = String(value ?? '')
      const range = lineRange(text, caret)
      const line = text.slice(range.start, range.end)
      const lines = text.split('\n')
      let index = 0
      let cursor = 0
      while (cursor < range.start) {
        cursor += lines[index].length + 1
        index += 1
      }

      if (operation === 'duplicate') {
        const next = [...lines.slice(0, index + 1), line, ...lines.slice(index + 1)]
        const value2 = next.join('\n')
        return { value: value2, caret: range.start + line.length + 1 + range.column }
      }

      if (operation === 'delete') {
        if (lines.length === 1) return { value: '', caret: 0 }
        const next = lines.filter((_, position) => position !== index)
        const caret2 = Math.min(
          next.join('\n').length,
          index === 0 ? 0 : next.slice(0, index).reduce((sum, entry) => sum + entry.length + 1, 0),
        )
        return { value: next.join('\n'), caret: caret2 }
      }

      const target = operation === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= lines.length) return null
      const next = [...lines]
      const swap = next[index]
      next[index] = next[target]
      next[target] = swap
      const value2 = next.join('\n')
      // Follow the line so the caret stays on the text the user was editing.
      const starts = []
      let running = 0
      for (const entry of next) {
        starts.push(running)
        running += entry.length + 1
      }
      return { value: value2, caret: starts[target] + range.column }
    }

    /**
     * Set the heading level of the caret's line, toggling off when it is
     * already at that level.
     * @param value - the block source.
     * @param caret - caret offset.
     * @param level - 0..6, where 0 means a plain paragraph.
     * @returns the new source and caret.
     */
    function setHeadingLevel(value, caret, level) {
      const text = String(value ?? '')
      const range = lineRange(text, caret)
      const line = text.slice(range.start, range.end)
      const existing = /^(#{1,6})[ \t]+/.exec(line)
      const current = existing === null ? 0 : existing[1].length
      const target = level === current ? 0 : Math.max(0, Math.min(6, level))
      const body = existing === null ? line : line.slice(existing[0].length)
      const prefix = target === 0 ? '' : `${'#'.repeat(target)} `
      const nextLine = prefix + body
      const next = text.slice(0, range.start) + nextLine + text.slice(range.end)
      const delta = nextLine.length - line.length
      const floor = range.start + prefix.length
      const nextCaret = Math.max(floor, Math.min(next.length, caret + delta))
      return { value: next, caret: nextCaret }
    }

    /**
     * Toggle an inline marker: wrap the selection, or unwrap when the markers
     * are already hugging it.
     * @param value - the block source.
     * @param start - selection start.
     * @param end - selection end.
     * @param marker - the marker such as `**`.
     * @returns the new source and the range to select.
     */
    function toggleMarker(value, start, end, marker) {
      const text = String(value ?? '')
      const from = Math.max(0, Math.min(start, text.length))
      const to = Math.max(from, Math.min(end, text.length))
      const size = marker.length
      const before = text.slice(Math.max(0, from - size), from)
      const after = text.slice(to, to + size)
      if (before === marker && after === marker) {
        const value2 = text.slice(0, from - size) + text.slice(from, to) + text.slice(to + size)
        return { value: value2, start: from - size, end: to - size }
      }
      if (from === to) {
        const value2 = text.slice(0, from) + marker + marker + text.slice(from)
        return { value: value2, start: from + size, end: from + size }
      }
      const value2 = text.slice(0, from) + marker + text.slice(from, to) + marker + text.slice(to)
      return { value: value2, start: from + size, end: to + size }
    }

    /**
     * Wrap the selection in a link, leaving the URL slot ready to type over.
     * @param value - the block or document source.
     * @param start - selection start.
     * @param end - selection end.
     * @returns the new source, the URL range and where the caret belongs.
     */
    function insertLink(value, start, end) {
      const text = String(value ?? '')
      const from = Math.max(0, Math.min(start, text.length))
      const to = Math.max(from, Math.min(end, text.length))
      const label = text.slice(from, to)
      const url = 'https://'
      const inserted = `[${label}](${url})`
      const next = text.slice(0, from) + inserted + text.slice(to)
      const urlStart = from + 1 + label.length + 2
      return { value: next, start: urlStart, end: urlStart + url.length, caret: urlStart + url.length }
    }

    /** Every case-insensitive occurrence of a needle, as source offsets. */
    function findMatches(haystack, needle) {
      const text = String(haystack ?? '')
      const query = String(needle ?? '')
      if (query === '') return []
      const lower = text.toLowerCase()
      const target = query.toLowerCase()
      const hits = []
      let cursor = 0
      while (cursor <= lower.length) {
        const at = lower.indexOf(target, cursor)
        if (at < 0) break
        hits.push({ from: at, to: at + target.length })
        cursor = at + Math.max(1, target.length)
      }
      return hits
    }

    /**
     * Replace one occurrence, or every occurrence, of a query.
     * @param value - the source text.
     * @param query - what to look for, case-insensitively.
     * @param replacement - what to put in its place.
     * @param index - which occurrence to replace; omit to replace all.
     * @returns the new text and the caret, plus how many were replaced.
     */
    function replaceMatches(value, query, replacement, index) {
      const text = String(value ?? '')
      const hits = findMatches(text, query)
      if (hits.length === 0) return null
      const target = replacement === undefined || replacement === null ? '' : String(replacement)
      if (index === undefined || index === null) {
        let out = ''
        let cursor = 0
        for (const hit of hits) {
          out += text.slice(cursor, hit.from) + target
          cursor = hit.to
        }
        out += text.slice(cursor)
        return { value: out, caret: null, count: hits.length }
      }
      const hit = hits[Math.max(0, Math.min(index, hits.length - 1))]
      const next = text.slice(0, hit.from) + target + text.slice(hit.to)
      return { value: next, caret: hit.from + target.length, count: 1 }
    }

    /**
     * A GitHub-style anchor slug for one heading.
     * @param text - the heading text.
     * @returns the slug.
     */
    function headingSlug(text) {
      return String(text ?? '')
        .trim()
        .toLowerCase()
        .replace(/[`~!@#$%^&*()+=[\]{}\\|;:'",.<>/?]/g, '')
        // Full-width punctuation is dropped too, so Chinese headings slug cleanly.
        .replace(/[\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    /**
     * Map every heading's slug to its source offset, numbering duplicates the
     * way the reference does.
     * @param blocks - parsed blocks.
     * @returns slug → offset.
     */
    function headingAnchors(blocks) {
      const anchors = new Map()
      const seen = new Map()
      for (const block of blocks) {
        if (block.type !== 'heading') continue
        const base = headingSlug(block.value)
        if (base === '') continue
        const count = seen.get(base) ?? 0
        seen.set(base, count + 1)
        anchors.set(count === 0 ? base : `${base}-${count}`, block.from)
      }
      return anchors
    }

    /**
     * A workspace path for a pasted picture: `assets/` beside the document, with
     * a timestamped name the way the reference names pasted images.
     * @param directory - the document's directory, '' at the workspace root.
     * @param extension - file extension without the dot.
     * @param now - timestamp to build the name from.
     * @returns a workspace-relative path.
     */
    function imagePath(directory, extension, now) {
      const stamp = new Date(now === undefined ? Date.now() : now)
      const pad = (value) => (value < 10 ? `0${value}` : String(value))
      const name = `image-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(
        stamp.getHours(),
      )}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`
      const safe = String(extension ?? 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png'
      // Pictures always live in an `assets/` folder beside the document.
      return joinRelative(directory === '' ? 'assets' : `${directory}/assets`, `${name}.${safe}`)
    }

    /**
     * Insert an image reference at the caret.
     * @param value - the block or document source.
     * @param start - caret offset.
     * @param end - selection end.
     * @param relativePath - the workspace-relative picture path.
     * @returns the new source and caret.
     */
    function insertImage(value, start, end, relativePath) {
      const text = String(value ?? '')
      const from = Math.max(0, Math.min(start, text.length))
      const to = Math.max(from, Math.min(end, text.length))
      const markdown = `![](${relativePath})`
      return {
        value: text.slice(0, from) + markdown + text.slice(to),
        caret: from + markdown.length,
      }
    }

    /**
     * Base64 bytes of a pasted blob.
     * @param blob - the file from the clipboard or a drop.
     * @returns base64 without the data URL prefix.
     */
    async function blobToBase64(blob) {
      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
      return btoa(binary)
    }

    /** Entities worth decoding from a pasted fragment. */
    const HTML_ENTITIES = {
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ',
      hellip: '…', mdash: '—', ndash: '–', middot: '·', times: '×', copy: '©', reg: '®',
      laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', deg: '°',
    }

    /** Decode the entities a clipboard fragment normally carries. */
    function decodeEntities(text) {
      return String(text ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (whole, hex) => {
          const code = Number.parseInt(hex, 16)
          return Number.isFinite(code) ? String.fromCodePoint(code) : whole
        })
        .replace(/&#(\d+);/g, (whole, digits) => {
          const code = Number.parseInt(digits, 10)
          return Number.isFinite(code) ? String.fromCodePoint(code) : whole
        })
        .replace(/&([a-z]+);/gi, (whole, name) => HTML_ENTITIES[name.toLowerCase()] ?? whole)
    }

    /** Trim trailing spaces and collapse the blank lines between blocks. */
    function tidyMarkdown(text) {
      return String(text ?? '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+|\n+$/g, '')
    }

    /** Marker that wraps an inline element's text on close. */
    const HTML_MARKERS = {
      strong: '**', b: '**', em: '*', i: '*', del: '~~', s: '~~', strike: '~~', code: '`', tt: '`',
    }

    /**
     * Convert a pasted HTML fragment to Markdown.
     * Handles the block and inline tags a browser or word processor really puts
     * on the clipboard; unknown tags keep their text and lose their markup.
     * @param html - the HTML fragment.
     * @returns markdown, or an empty string when there is no markup to convert.
     */
    function htmlToMarkdown(html) {
      const source = String(html ?? '')
      if (!/<[a-zA-Z][^>]*>/.test(source)) return ''
      const cleaned = source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|head|meta|link)[\s\S]*?<\/\1>/gi, '')

      const frames = [{ tag: 'root', body: '', href: null }]
      const top = () => frames[frames.length - 1]
      const lists = []
      const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g
      let match = pattern.exec(cleaned)

      /** Append to the current frame, collapsing blank lines at the join. */
      const write = (text, blank) => {
        const current = top()
        if (blank) {
          current.body = current.body.replace(/[ \t]+$/, '')
          if (current.body !== '' && !current.body.endsWith('\n\n')) current.body += '\n\n'
        }
        current.body += text
      }

      while (match !== null) {
        const [, closing, rawTag, rawAttributes, selfClosing, rawText] = match
        if (rawText !== undefined) {
          const inPre = frames.some((frame) => frame.tag === 'pre')
          const text = decodeEntities(rawText)
          write(inPre ? text : text.replace(/\s+/g, ' '), false)
          match = pattern.exec(cleaned)
          continue
        }
        const tag = rawTag.toLowerCase()
        const attributes = rawAttributes ?? ''
        const attribute = (name) => {
          const found = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attributes)
          return found === null ? null : decodeEntities(found[2] ?? found[3] ?? '')
        }

        if (closing === '/') {
          const frame = frames.pop()
          if (frame === undefined) {
            match = pattern.exec(cleaned)
            continue
          }
          const parent = top()
          const inner = tidyMarkdown(frame.body)
          if (HTML_MARKERS[tag] !== undefined) {
            if (inner !== '') write(`${HTML_MARKERS[tag]}${inner.replace(/\n+/g, ' ')}${HTML_MARKERS[tag]}`, false)
          } else if (tag === 'a') {
            if (inner !== '') write(frame.href === null ? inner : `[${inner}](${frame.href})`, false)
          } else if (/^h[1-6]$/.test(tag)) {
            if (inner !== '') write(`${'#'.repeat(Number(tag.slice(1)))} ${inner.replace(/\n+/g, ' ')}`, true)
          } else if (['p', 'div', 'section', 'article', 'header', 'footer', 'main'].includes(tag)) {
            if (inner !== '') write(inner, true)
          } else if (tag === 'li') {
            const list = lists[lists.length - 1]
            const marker = list !== undefined && list.ordered ? `${(list.count += 1)}. ` : '- '
            const indent = '  '.repeat(Math.max(0, lists.length - 1))
            const current = top()
            // Items stay one per line; only the list itself is spaced out.
            if (current.body !== '' && !current.body.endsWith('\n')) current.body += '\n'
            const lines = inner.split('\n').filter((line) => line !== '')
            const [first, ...rest] = lines.length === 0 ? [''] : lines
            write(`${indent}${marker}${first}`, false)
            for (const line of rest) {
              // A nested list or continuation is indented under the marker.
              write(`\n${indent}  ${line}`, false)
            }
          } else if (tag === 'ul' || tag === 'ol') {
            lists.pop()
            if (inner !== '') write(inner, true)
          } else if (tag === 'blockquote') {
            if (inner !== '') {
              const quoted = inner
                .split('\n')
                .map((line) => (line === '' ? '>' : `> ${line}`))
                .join('\n')
              write(quoted, true)
            }
          } else if (tag === 'pre') {
            write(`\`\`\`\n${frame.body.replace(/^\n+|\n+$/g, '')}\n\`\`\``, true)
          } else if (tag === 'tr') {
            const cells = inner
              .split('|')
              .map((cell) => cell.trim())
              .filter((cell, index, all) => !(cell === '' && (index === 0 || index === all.length - 1)))
            write(`| ${cells.join(' | ')} |\n`, false)
          } else if (tag === 'th' || tag === 'td') {
            // Each cell opens its own pipe; the row closes the last one.
            write(`| ${frame.body.trim()} `, false)
          } else if (tag === 'table') {
            const rows = inner.split('\n').filter((line) => line.trim() !== '')
            if (rows.length > 0) {
              // A pipe table needs its delimiter row right after the header.
              const columns = rows[0].split('|').length - 2
              const delimiter = `|${' --- |'.repeat(Math.max(1, columns))}`
              const body = rows.length === 1 ? [rows[0], delimiter] : [rows[0], delimiter, ...rows.slice(1)]
              write(body.join('\n'), true)
            }
          } else {
            if (frame.body !== '') write(frame.body, false)
          }
          match = pattern.exec(cleaned)
          continue
        }

        if (tag === 'br') {
          write('\n', false)
          match = pattern.exec(cleaned)
          continue
        }
        if (tag === 'hr') {
          write('---', true)
          match = pattern.exec(cleaned)
          continue
        }
        if (tag === 'img') {
          const src = attribute('src')
          if (src !== null) write(`![${attribute('alt') ?? ''}](${src})`, false)
          match = pattern.exec(cleaned)
          continue
        }

        if (tag === 'ul' || tag === 'ol') lists.push({ ordered: tag === 'ol', count: 0 })
        frames.push({ tag, body: '', href: tag === 'a' ? attribute('href') : null })
        if (selfClosing === '/') {
          frames.pop()
        }
        match = pattern.exec(cleaned)
      }

      while (frames.length > 1) {
        const frame = frames.pop()
        top().body += frame.body
      }
      return tidyMarkdown(frames[0].body)
    }

    /** Openers that get a matching closer, and their closers. */
    const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`', '*': '*', '_': '_', '~': '~', '$': '$' }
    /** Closers that are skipped when already present. */
    const CLOSERS = new Set([')', ']', '}', '`', '*', '_', '~', '$'])

    /**
     * Pair a typed character, or step over a closer already in the way.
     * @param value - the text being edited.
     * @param start - selection start.
     * @param end - selection end.
     * @param char - the typed character.
     * @returns the new text and caret, or null when nothing should happen.
     */
    function autoPair(value, start, end, char) {
      const from = Math.max(0, Math.min(start, value.length))
      const to = Math.max(from, Math.min(end, value.length))
      const selected = value.slice(from, to)

      if (PAIRS[char] !== undefined) {
        const closer = PAIRS[char]
        if (from !== to) {
          return {
            value: value.slice(0, from) + char + selected + closer + value.slice(to),
            caret: from + selected.length + 2,
          }
        }
        // Never double up a quote that closes one and a marker inside a word.
        if (char === '*' || char === '_' || char === '~' || char === '$') {
          const before = value[from - 1] ?? ''
          const after = value[from] ?? ''
          if (/[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after)) return null
        }
        if (char === '"' || char === "'") {
          const before = value[from - 1] ?? ''
          if (/[A-Za-z0-9]/.test(before)) return null
        }
        return { value: value.slice(0, from) + char + closer + value.slice(from), caret: from + 1 }
      }

      if (CLOSERS.has(char) && from === to && value[from] === char) {
        return { value, caret: from + 1 }
      }
      return null
    }

    /**
     * Decide what Enter does inside one block's source: continue a list or
     * quote marker, or start a new block.
     * @param value - the block source being edited.
     * @param caret - selection start inside `value`.
     * @returns the edit to apply: `inline` inserts text, `block` splits.
     */
    function splitOnEnter(value, caret) {
      const position = Math.max(0, Math.min(caret, value.length))
      const lineStart = value.lastIndexOf('\n', position - 1) + 1
      let lineEnd = value.indexOf('\n', position)
      if (lineEnd < 0) lineEnd = value.length
      const beforeCaret = value.slice(lineStart, position)
      const item = /^([ \t]*)([-*+]|\d+[.)])([ \t]+)(.*)$/.exec(beforeCaret)

      if (item !== null) {
        const content = item[4].trim()
        const trailing = value.slice(position, lineEnd).trim()
        if (content === '' && trailing === '') {
          // An empty item ends the list instead of nesting one more.
          return {
            kind: 'block',
            before: value.slice(0, lineStart).replace(/\n$/, ''),
            after: value.slice(lineEnd).replace(/^\n/, ''),
            caret: 0,
          }
        }
        const ordered = /^\d/.test(item[2])
        const marker = ordered ? `${Number.parseInt(item[2], 10) + 1}${item[2].slice(-1)}` : item[2]
        return { kind: 'inline', insert: `\n${item[1]}${marker}${item[3]}` }
      }

      if (/^[ \t]*(?:>[ \t]?)+/.test(beforeCaret)) {
        const marker = /^([ \t]*(?:>[ \t]?)+)/.exec(beforeCaret)[1]
        return { kind: 'inline', insert: `\n${marker.replace(/[ \t]+$/, '')} ` }
      }

      return {
        kind: 'block',
        before: value.slice(0, position),
        after: value.slice(position),
        caret: 0,
      }
    }


    /** The guide card's artwork: a page with a pen on it. */
    function CowriteIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          className: props && props.className,
        },
        h('path', {
          d: 'M3 2.5h6.1L12.4 5.8v7.7H3Z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M8.9 2.6v3.3h3.3',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M5.1 8.4h3.4M5.1 10.9h2.4',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M11.7 8.9l1.8 1.8-2.5 2.5-1.9.4.4-1.9z',
          fill: 'currentColor',
        }),
      )
    }

    /** Clock text for the footer, in the browser's locale. */
    function clockText(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return ''
      const date = new Date(value)
      const pad = (n) => (n < 10 ? `0${n}` : String(n))
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    /**
     * The text currently selected in a textarea.
     * @param element - the textarea.
     * @returns the selected text, or an empty string.
     */
    function readSelection(element) {
      if (element === null || element === undefined) return ''
      const start = typeof element.selectionStart === 'number' ? element.selectionStart : 0
      const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : start
      if (end <= start) return ''
      return String(element.value ?? '').slice(start, end)
    }

    /** Footer counters, in the reference's own order. */
    const COUNT_MODES = ['words', 'chars', 'lines', 'minutes']
    /** Reading speed assumed for the minutes counter (the reference's default). */
    const WORDS_PER_MINUTE = 382

    /**
     * Count words the way the reference does: every CJK ideograph, kana and
     * hangul syllable counts once, the rest counts as whitespace/punctuation
     * separated tokens, and contractions stay whole.
     * @param text - the source text.
     * @returns the word count.
     */
    function countWords(text) {
      const source = String(text ?? '')
      if (source.trim().length === 0) return 0
      let ideographs = 0
      const shaped = source
        .replace(/[\u3040-\uABFF\uD7A4-\uFAFF]/gi, () => {
          ideographs += 1
          return ' '
        })
        .replace(/['\u2019]\w+/g, 'b')
        .replace(/(^|\s+)[(\u3000-\u303F)!-\/:-@\[-`{-~]+(\s+|$)/gm, ' ')
      const tokens = `d ${shaped} d`.split(/[(\u3000-\u303F)\s!-,\\:-@\[-`{-~]+/g).length
      return ideographs + tokens - 2
    }

    /** The number for one footer counter. */
    function countFor(mode, text) {
      if (mode === 'chars') return String(text ?? '').length
      if (mode === 'lines') return String(text ?? '').split('\n').length
      const words = countWords(text)
      if (mode === 'minutes') return Math.max(0, Math.round(words / WORDS_PER_MINUTE))
      return words
    }

    /** Views this pane offers: rendered reading, live block editing, raw source. */
    const MODES = ['live', 'preview', 'source']
    const ZOOM_MIN = 0.6
    const ZOOM_MAX = 2.4
    const ZOOM_STEP = 0.1
    /** The editor's base size in px at zoom 1; every other size is in em. */
    const BASE_FONT_PX = 16

    /** Read a stored preference, ignoring private-mode failures. */
    function readStored(key, fallback) {
      try {
        const value = window.localStorage.getItem(key)
        return value === null ? fallback : value
      } catch {
        return fallback
      }
    }

    /** Persist a preference, ignoring private-mode failures. */
    function store(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* a preference that cannot persist still applies for this view */
      }
    }

    /** The stored view mode, falling back to in-place editing. */
    function readStoredMode() {
      const stored = readStored(MODE_KEY, 'live')
      return MODES.includes(stored) ? stored : 'live'
    }

    /** The stored zoom, clamped to the supported range. */
    function readStoredZoom() {
      const parsed = Number.parseFloat(readStored(ZOOM_KEY, '1'))
      if (!Number.isFinite(parsed)) return 1
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parsed))
    }

    /** One step of zoom, rounded to avoid float drift in the label. */
    function stepZoom(current, direction) {
      const next = Math.round((current + direction * ZOOM_STEP) * 100) / 100
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    }

    /** The one call face this tab uses; it builds the envelope each request. */
    function createApi() {
      return {
        /**
         * POST one action to the host route.
         * @param payload - action, session scope, and action fields.
         * @returns the envelope's `data`.
         */
        async call(payload) {
          let response
          try {
            response = await fetch(ROUTE, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            })
          } catch (error) {
            const failure = new Error('network')
            failure.code = 'unknown'
            failure.detail = error instanceof Error ? error.message : String(error)
            throw failure
          }
          let envelope = null
          try {
            envelope = await response.json()
          } catch {
            envelope = null
          }
          if (envelope === null || envelope.ok !== true) {
            const failure = new Error(
              envelope !== null && typeof envelope.code === 'string'
                ? envelope.code
                : `http-${response.status}`,
            )
            // A non-JSON answer means the request never reached this plugin's
            // handler: the host route is missing rather than the action failing.
            failure.code =
              envelope === null
                ? 'no-host-route'
                : typeof envelope.code === 'string'
                  ? envelope.code
                  : 'unknown'
            failure.detail = envelope !== null ? envelope.detail : `HTTP ${response.status}`
            failure.status = response.status
            throw failure
          }
          return envelope.data
        },

        /**
         * POST base64 picture bytes to the upload route.
         * @param payload - root, workspace-relative path and base64 `data`.
         * @returns the envelope's `data`.
         */
        async upload(payload) {
          const response = await fetch(`${ROUTE}/upload`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          let envelope = null
          try {
            envelope = await response.json()
          } catch {
            envelope = null
          }
          if (envelope === null || envelope.ok !== true) {
            const failure = new Error('upload-failed')
            failure.code = envelope !== null && typeof envelope.code === 'string' ? envelope.code : 'unknown'
            failure.detail = envelope !== null ? envelope.detail : `HTTP ${response.status}`
            throw failure
          }
          return envelope.data
        },
      }
    }

    /**
     * The tab body: one file, one live editor, and the save/watch rules between
     * them.
     * @param props - slot props, this package's `api`, and the copy function.
     */
    function CowriteBody(props) {
      const { api, t, useSessions, useTabInfo, sessionId } = props
      const tab = useTabInfo().tab
      const cwd = useSessions((snapshot) =>
        sessionId === undefined ? undefined : snapshot.byId[sessionId]?.cwd,
      )

      const [files, setFiles] = React.useState(null)
      const [path, setPath] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [disk, setDisk] = React.useState({ content: '', mtimeMs: 0 })
      const [phase, setPhase] = React.useState('idle')
      const [savedAt, setSavedAt] = React.useState(null)
      const [conflict, setConflict] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [refreshing, setRefreshing] = React.useState(false)
      const [mode, setMode] = React.useState(() => readStoredMode())
      const [zoom, setZoom] = React.useState(() => readStoredZoom())
      // The block being edited, or null while every block renders. The range
      // is authoritative in the buffer, so typing never has to re-find itself
      // in the parse.
      const [editing, setEditing] = React.useState(null)
      const [outlineOpen, setOutlineOpen] = React.useState(false)
      const [findOpen, setFindOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [replacement, setReplacement] = React.useState('')
      const [replaceOpen, setReplaceOpen] = React.useState(false)
      const [matchIndex, setMatchIndex] = React.useState(0)
      const [focusMode, setFocusMode] = React.useState(() => readStored(FOCUS_KEY, '0') === '1')
      const [typewriter, setTypewriter] = React.useState(() => readStored(TYPEWRITER_KEY, '0') === '1')
      const [indentParagraphs, setIndentParagraphs] = React.useState(
        () => readStored(INDENT_KEY, '0') === '1',
      )
      const [collapsed, setCollapsed] = React.useState(() => new Set())
      const [lineNumbers, setLineNumbers] = React.useState(() => readStored(LINENO_KEY, '0') === '1')
      const [languageEdit, setLanguageEdit] = React.useState(null)
      const [countMode, setCountMode] = React.useState(() => {
        const stored = readStored(COUNT_KEY, 'words')
        return COUNT_MODES.includes(stored) ? stored : 'words'
      })

      const draftRef = React.useRef('')
      const diskRef = React.useRef({ content: '', mtimeMs: 0 })
      const pathRef = React.useRef(null)
      const conflictRef = React.useRef(null)
      const savingRef = React.useRef(false)
      const timerRef = React.useRef(null)
      const aliveRef = React.useRef(true)
      const bootedRef = React.useRef(false)
      const editingRef = React.useRef(null)
      const sessionRef = React.useRef(0)
      const pendingCaretRef = React.useRef(null)
      const inputRef = React.useRef(null)
      const scrollRef = React.useRef(null)
      const flashTimerRef = React.useRef(null)
      const sourceRef = React.useRef(null)
      const sourceCaretRef = React.useRef(null)

      // The rendered document follows the buffer, so a preview always shows
      // what would be saved, not what is on disk.
      const documentBlocks = React.useMemo(() => parseBlocks(draft), [draft])

      /** Headings for the outline, in document order. */
      const headings = React.useMemo(
        () => documentBlocks.filter((block) => block.type === 'heading'),
        [documentBlocks],
      )

      /** The outline as a tree, so sub-headings can collapse under a parent. */
      const outlineTree = React.useMemo(() => {
        const root = { level: 0, children: [] }
        const stack = [root]
        headings.forEach((heading, index) => {
          while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) stack.pop()
          const item = { heading, index, level: heading.level, children: [] }
          stack[stack.length - 1].children.push(item)
          stack.push(item)
        })
        return root.children
      }, [headings])

      /** Slug → source offset, so `[x](#标题)` jumps inside the pane. */
      const anchors = React.useMemo(() => headingAnchors(documentBlocks), [documentBlocks])

      /** The selected text, so the footer can count it in the current unit. */
      const [selectionText, setSelectionText] = React.useState('')

      /** Where the preview loads images from: the workspace root and this file's directory. */
      const images = React.useMemo(() => {
        const root = typeof cwd === 'string' ? cwd : ''
        const directory =
          typeof path === 'string' && path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
        return { root, dir: directory }
      }, [cwd, path])

      /** How many times the query occurs in the source, for the find counter. */
      const matchTotal = React.useMemo(() => {
        if (query === '') return 0
        const needle = query.toLowerCase()
        const haystack = draft.toLowerCase()
        let count = 0
        let cursor = 0
        while (cursor <= haystack.length) {
          const found = haystack.indexOf(needle, cursor)
          if (found < 0) break
          count += 1
          cursor = found + Math.max(1, needle.length)
        }
        return count
      }, [draft, query])

      /** Scroll one block to the top of the document pane. */
      const scrollToBlock = React.useCallback((from) => {
        const container = scrollRef.current
        if (container === null || container === undefined) return
        let target = null
        try {
          target = container.querySelector(`[data-dcw-block="${from}"]`)
        } catch {
          target = null
        }
        if (target !== null && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'start', behavior: 'smooth' })
        }
      }, [])

      /** Toggle the caret-centred layout. */
      const toggleTypewriter = React.useCallback(() => {
        setTypewriter((current) => {
          const next = !current
          store(TYPEWRITER_KEY, next ? '1' : '0')
          return next
        })
      }, [])

      /** Collapse or open one outline branch. */
      const toggleCollapsed = React.useCallback((index) => {
        setCollapsed((current) => {
          const next = new Set(current)
          if (next.has(index)) next.delete(index)
          else next.add(index)
          return next
        })
      }, [])

      const toggleLineNumbers = React.useCallback(() => {
        setLineNumbers((current) => {
          const next = !current
          store(LINENO_KEY, next ? '1' : '0')
          return next
        })
      }, [])

      /** Copy one code block body to the clipboard. */
      const copyCode = React.useCallback((value) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
          void navigator.clipboard.writeText(String(value)).catch(() => {})
        }
      }, [])

      /**
       * Store a pasted or dropped picture beside the document and return its
       * workspace-relative path.
       * @param file - the image blob from the clipboard or a drop.
       * @returns the relative path, or null when it could not be stored.
       */

      /**
       * Where a fence's info string sits in the buffer.
       * @param block - the code block.
       * @returns the range to replace, or null when the block is gone.
       */
      const languageRange = (block) => {
        const raw = draftRef.current.slice(block.from, block.to)
        const opener = /^[ \t]*(`{3,}|~{3,})[ \t]*([^\n`~]*)/.exec(raw)
        if (opener === null) return null
        const start = block.from + opener[1].length + (opener[0].length - opener[1].length - opener[2].length)
        const word = opener[2].trim()
        return { from: start, to: start + word.length, word }
      }

      const commitLanguage = (block, value) => {
        const range = languageRange(block)
        setLanguageEdit(null)
        if (range === null) return
        const next = String(value).trim()
        if (next === range.word) return
        const source = draftRef.current
        setEditor(source.slice(0, range.from) + next + source.slice(range.to))
        setPhase('dirty')
        scheduleSave()
      }

      /**
       * Replace the active match, or every match, in the buffer.
       * @param all - whether to replace every occurrence.
       */
      const runReplace = React.useCallback(
        (all) => {
          const source = draftRef.current
          const result = replaceMatches(source, query, replacement, all ? undefined : matchIndex)
          if (result === null) return
          const session = editingRef.current
          if (session !== null) {
            // A replacement can cross block boundaries, so start a fresh
            // document-level undo entry and leave the block editor.
            historyRef.current.stack.push({ docValue: draftRef.current })
            if (historyRef.current.stack.length > 100) historyRef.current.stack.shift()
            historyRef.current.redo.length = 0
            editingRef.current = null
            setEditing(null)
          } else {
            historyRef.current.stack.push({ docValue: draftRef.current })
            if (historyRef.current.stack.length > 100) historyRef.current.stack.shift()
            historyRef.current.redo.length = 0
          }
          sourceCaretRef.current = result.caret
          setEditor(result.value)
          setPhase('dirty')
          scheduleSave()
          setMatchIndex(0)
        },
        [query, replacement, matchIndex],
      )

      /** Cycle the footer counter: words → characters → lines → minutes. */
      const cycleCountMode = React.useCallback(() => {
        setCountMode((current) => {
          const next = COUNT_MODES[(COUNT_MODES.indexOf(current) + 1) % COUNT_MODES.length]
          store(COUNT_KEY, next)
          return next
        })
      }, [])

      const toggleIndent = React.useCallback(() => {
        setIndentParagraphs((current) => {
          const next = !current
          store(INDENT_KEY, next ? '1' : '0')
          return next
        })
      }, [])

      /**
       * Scroll one anchored element into view and flash it, so a footnote
       * back-link shows where it came from.
       * @param id - the element id to reveal.
       */
      const flashAnchor = React.useCallback((id) => {
        const container = scrollRef.current
        if (container === null || container === undefined) return
        const target = container.querySelector(`[id="${id}"]`)
        if (target === null || target === undefined) return
        if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        if (typeof target.setAttribute === 'function') target.setAttribute('data-dcw-flash', 'true')
        if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current)
        flashTimerRef.current = setTimeout(() => {
          if (typeof target.removeAttribute === 'function') target.removeAttribute('data-dcw-flash')
          flashTimerRef.current = null
        }, 1200)
      }, [])

      const toggleFocusMode = React.useCallback(() => {
        setFocusMode((current) => {
          const next = !current
          store(FOCUS_KEY, next ? '1' : '0')
          return next
        })
      }, [])

      /** Move the find cursor forward or backward, wrapping around. */
      const stepMatch = React.useCallback(
        (direction) => {
          if (matchTotal === 0) return
          setMatchIndex((current) => {
            const next = (current + direction + matchTotal) % matchTotal
            return next
          })
        },
        [matchTotal],
      )

      const applyZoom = React.useCallback((next) => {
        const value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100))
        setZoom(value)
        store(ZOOM_KEY, String(value))
      }, [])

      /** Leave the block editor; every block then renders again. */
      const stopEditing = React.useCallback(() => {
        editingRef.current = null
        setEditing(null)
      }, [])

      const changeMode = React.useCallback(
        (next) => {
          if (!MODES.includes(next)) return
          editingRef.current = null
          setEditing(null)
          setMode(next)
          store(MODE_KEY, next)
        },
        [],
      )

      React.useEffect(
        () => () => {
          aliveRef.current = false
          if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        },
        [],
      )

      const call = React.useCallback(
        (action, payload) =>
          api.call({
            sessionId,
            root: typeof cwd === 'string' ? cwd : undefined,
            action,
            ...(payload ?? {}),
          }),
        [api, sessionId, cwd],
      )

      const describe = React.useCallback(
        (failure) => {
          const code = failure && typeof failure.code === 'string' ? failure.code : 'unknown'
          const text = t(`err.${code}`)
          const label = typeof text === 'string' && text.startsWith('err.') ? t('err.unknown') : text
          return failure && failure.detail ? `${label}（${failure.detail}）` : label
        },
        [t],
      )

      const setEditor = React.useCallback((value) => {
        draftRef.current = value
        setDraft(value)
      }, [])

      const applyDisk = React.useCallback((next) => {
        diskRef.current = { content: next.content, mtimeMs: next.mtimeMs }
        setDisk(diskRef.current)
      }, [])

      const storePastedImage = React.useCallback(
        async (file) => {
          if (file === null || file === undefined) return null
          const type = String(file.type ?? '')
          if (!/^image\//.test(type)) return null
          const extension = type.slice('image/'.length).replace('jpeg', 'jpg') || 'png'
          const directory =
            typeof path === 'string' && path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
          const relative = imagePath(directory, extension)
          try {
            const data = await blobToBase64(file)
            await api.upload({
              sessionId,
              root: typeof cwd === 'string' ? cwd : undefined,
              path: relative,
              data,
            })
            return relative
          } catch (failure) {
            if (aliveRef.current) setError(describe(failure))
            return null
          }
        },
        [api, cwd, describe, path, sessionId],
      )

      /**
       * Handle a paste that carries rich text: convert the HTML flavour to
       * Markdown so a copied paragraph keeps its emphasis and structure.
       * @param event - the paste event.
       * @param apply - receives the new source and caret.
       * @param source - the text the caret offsets refer to.
       * @param caret - caret offset.
       * @param end - selection end.
       * @returns whether the event was consumed.
       */
      const handleHtmlPaste = React.useCallback((event, apply, source, caret, end) => {
        const html = event.clipboardData?.getData?.('text/html')
        if (typeof html !== 'string' || html === '') return false
        const markdown = htmlToMarkdown(html)
        if (markdown === '') return false
        const plain = event.clipboardData?.getData?.('text/plain')
        // Only take over when the conversion actually carries structure.
        if (typeof plain === 'string' && markdown.trim() === plain.trim()) return false
        event.preventDefault()
        const text = String(source ?? '')
        const from = Math.max(0, Math.min(caret, text.length))
        const to = Math.max(from, Math.min(end, text.length))
        apply(text.slice(0, from) + markdown + text.slice(to), from + markdown.length)
        return true
      }, [])

      /**
       * Handle a paste or drop that carries a picture.
       * @param event - the paste/drop event.
       * @param apply - receives the new source and caret.
       * @param source - the text the caret offsets refer to.
       * @param caret - caret offset.
       * @param end - selection end.
       * @returns whether the event was consumed.
       */
      const handleImageEvent = React.useCallback(
        (event, apply, source, caret, end) => {
          const files = event.clipboardData?.files ?? event.dataTransfer?.files
          if (files === undefined || files === null || files.length === 0) return false
          const file = Array.from(files).find((candidate) => /^image\//.test(String(candidate.type ?? '')))
          if (file === undefined) return false
          event.preventDefault()
          void (async () => {
            const relative = await storePastedImage(file)
            if (relative === null) return
            const applied = insertImage(source, caret, end, relative)
            apply(applied.value, applied.caret)
          })()
          return true
        },
        [storePastedImage],
      )

      const setConflictState = React.useCallback((next) => {
        conflictRef.current = next
        setConflict(next)
      }, [])

      /** Write the current draft if it differs from the disk version. */
      const saveNow = React.useCallback(async () => {
        if (savingRef.current) return
        const relative = pathRef.current
        if (typeof relative !== 'string') return
        const content = draftRef.current
        if (content === diskRef.current.content) {
          setPhase('synced')
          return
        }
        savingRef.current = true
        setPhase('saving')
        setError(null)
        try {
          const data = await call('write', {
            path: relative,
            content,
            baseMtimeMs: diskRef.current.mtimeMs,
          })
          if (!aliveRef.current) return
          if (data && data.conflict === true) {
            setConflictState({
              content: typeof data.content === 'string' ? data.content : '',
              mtimeMs: typeof data.mtimeMs === 'number' ? data.mtimeMs : 0,
            })
            setPhase('dirty')
          } else {
            applyDisk({ content, mtimeMs: data.mtimeMs })
            setSavedAt(Date.now())
            setConflictState(null)
            setPhase('saved')
          }
        } catch (failure) {
          if (aliveRef.current) {
            setPhase('dirty')
            setError(describe(failure))
          }
        } finally {
          savingRef.current = false
        }
      }, [applyDisk, call, describe, setConflictState])

      const scheduleSave = React.useCallback(() => {
        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          void saveNow()
        }, SAVE_DELAY_MS)
      }, [saveNow])

      const loadFile = React.useCallback(
        async (relative) => {
          if (typeof relative !== 'string' || relative === '') return
          setPhase('loading')
          setError(null)
          setConflictState(null)
          try {
            const data = await call('read', { path: relative })
            if (!aliveRef.current) return
            pathRef.current = relative
            setPath(relative)
            editingRef.current = null
            setEditing(null)
            setEditor(data.content)
            applyDisk({ content: data.content, mtimeMs: data.mtimeMs })
            setSavedAt(null)
            setPhase('synced')
            try {
              window.localStorage.setItem(STICKY_PREFIX + String(sessionId), relative)
            } catch {
              /* private mode keeps no sticky choice, which is harmless */
            }
          } catch (failure) {
            if (aliveRef.current) {
              setPhase('idle')
              setError(describe(failure))
            }
          }
        },
        [applyDisk, call, describe, sessionId, setConflictState, setEditor],
      )

      const refreshList = React.useCallback(async () => {
        setRefreshing(true)
        setError(null)
        try {
          const data = await call('list', {})
          if (!aliveRef.current) return null
          const list = Array.isArray(data.files) ? data.files : []
          setFiles(list)
          return list
        } catch (failure) {
          if (aliveRef.current) {
            setFiles([])
            setError(describe(failure))
          }
          return null
        } finally {
          if (aliveRef.current) setRefreshing(false)
        }
      }, [call, describe])

      /**
       * Choose the file to show when this pane has none yet: the one this
       * session edited last, otherwise the freshest document.
       * @param list - the workspace listing just read.
       */
      const pickInitialFile = React.useCallback(
        async (list) => {
          if (!Array.isArray(list) || list.length === 0) return
          if (pathRef.current !== null) return
          let sticky = null
          try {
            sticky = window.localStorage.getItem(STICKY_PREFIX + String(sessionId))
          } catch {
            sticky = null
          }
          const remembered = list.find((entry) => entry.path === sticky)
          const documents = list.filter((entry) => /\.(md|markdown|mdx)$/i.test(entry.path))
          const pool = documents.length > 0 ? documents : list
          const latest = pool
            .slice()
            .sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))[0]
          const pick = remembered ?? latest
          if (pick !== undefined) await loadFile(pick.path)
        },
        [loadFile, sessionId],
      )

      // First open: list the workspace and restore the last file this session
      // edited, or the most recently touched document.
      React.useEffect(() => {
        if (bootedRef.current || cwd === undefined) return
        bootedRef.current = true
        void (async () => {
          const list = await refreshList()
          if (list !== null) await pickInitialFile(list)
        })()
      }, [cwd, pickInitialFile, refreshList])

      // Watch the file: an Agent write reloads a clean pane, and queues a
      // decision when this pane also has unsaved edits.
      React.useEffect(() => {
        if (typeof path !== 'string') return undefined
        let stopped = false
        let handle = null
        const tick = async () => {
          if (stopped) return
          const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
          const delay = hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS
          try {
            if (!savingRef.current && conflictRef.current === null && pathRef.current !== null) {
              const current = await call('stat', { path: pathRef.current })
              if (
                !stopped &&
                current &&
                current.missing !== true &&
                typeof current.mtimeMs === 'number' &&
                current.mtimeMs !== diskRef.current.mtimeMs
              ) {
                if (draftRef.current === diskRef.current.content) {
                  const fresh = await call('read', { path: pathRef.current })
                  if (!stopped && aliveRef.current) {
                    editingRef.current = null
                    setEditing(null)
                    setEditor(fresh.content)
                    applyDisk({ content: fresh.content, mtimeMs: fresh.mtimeMs })
                    setSavedAt(Date.now())
                    setPhase('reloaded')
                  }
                } else {
                  const fresh = await call('read', { path: pathRef.current })
                  if (!stopped && aliveRef.current) {
                    setConflictState({
                      content: fresh.content,
                      mtimeMs: fresh.mtimeMs,
                    })
                  }
                }
              }
            }
          } catch {
            /* a transient failure is retried on the next tick */
          }
          if (!stopped) handle = setTimeout(tick, delay)
        }
        handle = setTimeout(tick, POLL_VISIBLE_MS)
        return () => {
          stopped = true
          if (handle !== null) clearTimeout(handle)
        }
      }, [applyDisk, call, path, setConflictState, setEditor])

      const onChange = React.useCallback(
        (event) => {
          const value = event.target.value
          setEditor(value)
          setPhase('dirty')
          scheduleSave()
        },
        [scheduleSave, setEditor],
      )

      const onKeyDown = React.useCallback(
        (event) => {
          if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
            event.preventDefault()
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            timerRef.current = null
            void saveNow()
            return
          }
          const typed =
            event.key !== undefined && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey
          if (typed) {
            const target = event.target
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start
            const paired = autoPair(draftRef.current, start, end, event.key)
            if (paired !== null) {
              event.preventDefault()
              sourceCaretRef.current = paired.caret
              setEditor(paired.value)
              setPhase('dirty')
              scheduleSave()
              return
            }
          }

          const marker = markerForKey(event)
          if (marker !== null) {
            event.preventDefault()
            const target = event.target
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start
            const applied = toggleMarker(draftRef.current, start, end, marker)
            sourceCaretRef.current = applied.end
            setEditor(applied.value)
            setPhase('dirty')
            scheduleSave()
            return
          }

          if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k' && !event.shiftKey) {
            event.preventDefault()
            const target = event.target
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start
            const applied = insertLink(draftRef.current, start, end)
            sourceCaretRef.current = applied.caret
            setEditor(applied.value)
            setPhase('dirty')
            scheduleSave()
            return
          }

          const headingKey =
            (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) ||
            (event.metaKey && event.altKey)
          if (headingKey && /^[0-6]$/.test(String(event.key))) {
            event.preventDefault()
            const target = event.target
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0
            const applied = setHeadingLevel(draftRef.current, start, Number(event.key))
            sourceCaretRef.current = applied.caret
            setEditor(applied.value)
            setPhase('dirty')
            scheduleSave()
            return
          }
        },
        [scheduleSave, saveNow, setEditor],
      )

      const takeDiskVersion = React.useCallback(() => {
        if (conflictRef.current === null) return
        editingRef.current = null
        setEditing(null)
        setEditor(conflictRef.current.content)
        applyDisk({
          content: conflictRef.current.content,
          mtimeMs: conflictRef.current.mtimeMs,
        })
        setConflictState(null)
        setPhase('synced')
        setError(null)
      }, [applyDisk, setConflictState, setEditor])

      const keepMine = React.useCallback(async () => {
        if (conflictRef.current === null) return
        diskRef.current = {
          content: diskRef.current.content,
          mtimeMs: conflictRef.current.mtimeMs,
        }
        setPhase('dirty')
        await saveNow()
      }, [saveNow])

      /** Flip one task item between `[ ]` and `[x]` straight in the buffer. */
      const toggleTask = React.useCallback(
        (item) => {
          if (typeof item.taskFrom !== 'number') return
          const source = draftRef.current
          const marker = item.task === 'checked' ? '[ ]' : '[x]'
          const next = source.slice(0, item.taskFrom) + marker + source.slice(item.taskFrom + 3)
          setEditor(next)
          setPhase('dirty')
          scheduleSave()
        },
        [scheduleSave, setEditor],
      )

      /** Write the rendered document out as a standalone HTML file. */
      const exportHtml = React.useCallback(() => {
        const body = nodeToHtml(renderBlocks(documentBlocks, { headings, images, taskToggle: toggleTask }))
        downloadHtml({
          title: typeof path === 'string' ? path.split('/').pop() : '文档',
          body,
          css: CSS,
        })
      }, [documentBlocks, headings, images, path, toggleTask])

      /** A small undo stack for the edits the browser's own history cannot see. */
      const historyRef = React.useRef({ stack: [], redo: [] })

      /**
       * Remember the block source before a structural edit. The entry stores the
       * block text, not the whole document, so restoring it never depends on a
       * length that the edit itself changed.
       * @param blockValue - the block source as it was.
       * @param caret - the caret to restore with it.
       */
      const recordHistory = (blockValue, caret) => {
        const history = historyRef.current
        history.stack.push({ blockValue, caret })
        if (history.stack.length > 100) history.stack.shift()
        history.redo.length = 0
      }

      /**
       * Step the edited block through the recorded history.
       * @param direction - `undo` or `redo`.
       * @returns whether anything moved.
       */
      const stepHistory = (direction) => {
        const history = historyRef.current
        const from = direction === 'undo' ? history.stack : history.redo
        const to = direction === 'undo' ? history.redo : history.stack
        const entry = from.pop()
        if (entry === undefined) return false
        const session = editingRef.current
        if (entry.docValue !== undefined) {
          // A whole-document edit (replace all): restore the buffer as it was.
          to.push({ docValue: draftRef.current })
          setEditor(entry.docValue)
          setPhase('dirty')
          scheduleSave()
          return true
        }
        if (session === null) {
          from.push(entry)
          return false
        }
        to.push({ blockValue: session.value, caret: session.caret })
        const source = draftRef.current
        const nextSource = source.slice(0, session.from) + entry.blockValue + source.slice(session.to)
        const next = {
          id: session.id,
          from: session.from,
          to: session.from + entry.blockValue.length,
          value: entry.blockValue,
          caret: Math.max(0, Math.min(entry.caret, entry.blockValue.length)),
        }
        editingRef.current = next
        pendingCaretRef.current = next.caret
        setEditing(next)
        setEditor(nextSource)
        setPhase('dirty')
        scheduleSave()
        return true
      }

      /**
       * Replace the edited range with `nextValue` and keep the caret there.
       * The range, not the parse, is the session's identity, so typing can
       * change a block's kind without losing the caret.
       * @param nextValue - new source for the edited range.
       * @param caret - caret position inside `nextValue`.
       */
      const applyLiveValue = (nextValue, caret) => {
        const session = editingRef.current
        if (session === null) return
        const source = draftRef.current
        const nextSource = source.slice(0, session.from) + nextValue + source.slice(session.to)
        const bounded = Math.max(0, Math.min(caret, nextValue.length))
        const next = {
          id: session.id,
          from: session.from,
          to: session.from + nextValue.length,
          value: nextValue,
          caret: bounded,
        }
        editingRef.current = next
        pendingCaretRef.current = bounded
        setEditing(next)
        setEditor(nextSource)
        setPhase('dirty')
        scheduleSave()
      }

      /**
       * Apply a structural edit and make it undoable.
       * @param nextValue - new source for the edited range.
       * @param caret - caret inside it.
       */
      const applyStructural = (nextValue, caret) => {
        const session = editingRef.current
        if (session === null) return
        recordHistory(session.value, session.caret)
        applyLiveValue(nextValue, caret)
      }

      /**
       * Open one block for editing.
       * @param block - the parsed block to edit.
       * @param caret - caret offset inside the block source; defaults to end.
       */
      const beginEdit = (block, caret) => {
        const raw = draftRef.current.slice(block.from, block.to)
        const value = raw.endsWith('\n') ? raw.slice(0, -1) : raw
        const position = caret === null || caret === undefined ? value.length : caret
        const session = {
          id: (sessionRef.current += 1),
          from: block.from,
          to: block.from + value.length,
          value,
          caret: Math.max(0, Math.min(position, value.length)),
        }
        editingRef.current = session
        pendingCaretRef.current = session.caret
        setEditing(session)
      }

      /** The latest non-blank block that ends at or before `offset`. */
      const previousEditableBlock = (offset) => {
        let previous = null
        for (const block of documentBlocks) {
          if (block.type === 'blank') continue
          if (block.to <= offset) previous = block
        }
        return previous
      }

      /** The first non-blank block that starts at or after `offset`. */
      const nextEditableBlock = (offset) => {
        for (const block of documentBlocks) {
          if (block.type === 'blank') continue
          if (block.from >= offset) return block
        }
        return null
      }

      /**
       * Map a click inside a rendered block to a caret in its source, so the
       * caret lands under the pointer instead of at the block end.
       * @param event - the click on the rendered block.
       * @param block - the block that was clicked.
       */
      const onBlockClick = (event, block) => {
        const target = event.target
        if (target !== null && target !== undefined && typeof target.closest === 'function') {
          if (target.closest('a') !== null) return
        }
        let caret = null
        if (typeof window !== 'undefined' && typeof window.getSelection === 'function') {
          const selection = window.getSelection()
          const anchor = selection === null || selection === undefined ? null : selection.anchorNode
          if (anchor !== null && anchor !== undefined) {
            const element = anchor.nodeType === 3 ? anchor.parentElement : anchor
            const holder =
              element !== null && element !== undefined && typeof element.closest === 'function'
                ? element.closest('[data-dcw-f]')
                : null
            if (holder !== null) {
              const base = Number(holder.getAttribute('data-dcw-f'))
              if (Number.isFinite(base)) {
                caret = base + (anchor.nodeType === 3 ? selection.anchorOffset : 0)
              }
            }
          }
        }
        if (caret !== null && typeof block.value === 'string') {
          // Markers are hidden in the rendered view, so a click on one snaps
          // the caret to the outside of that inline node.
          const shift = blockShift(block, draftRef.current)
          const ranges = markerRanges(parseInline(block.value, shift ?? 0))
          if (ranges.length > 0) caret = snapToBoundary(caret, ranges)
        }
        beginEdit(block, caret)
      }

      /**
       * Edit a block against a fresh range, used when Enter splits a block.
       * @param head - source that stays in the current position.
       * @param tail - source that moves into the new block.
       */
      const splitLiveBlock = (head, tail) => {
        const session = editingRef.current
        if (session === null) return
        const source = draftRef.current
        const nextSource = source.slice(0, session.from) + head + '\n\n' + tail + source.slice(session.to)
        const from = session.from + head.length + 2
        const next = {
          id: (sessionRef.current += 1),
          from,
          to: from + tail.length,
          value: tail,
          caret: 0,
        }
        editingRef.current = next
        pendingCaretRef.current = 0
        setEditing(next)
        setEditor(nextSource)
        setPhase('dirty')
        scheduleSave()
      }

      /** Merge the edited block into the one above it (Backspace at offset 0). */
      const mergeWithPrevious = () => {
        const session = editingRef.current
        if (session === null) return
        const previous = previousEditableBlock(session.from)
        if (previous === null) return
        const previousRaw = draftRef.current.slice(previous.from, previous.to)
        const previousValue = previousRaw.endsWith('\n') ? previousRaw.slice(0, -1) : previousRaw
        const merged = previousValue + session.value
        const source = draftRef.current
        const nextSource = source.slice(0, previous.from) + merged + source.slice(session.to)
        const next = {
          id: (sessionRef.current += 1),
          from: previous.from,
          to: previous.from + merged.length,
          value: merged,
          caret: previousValue.length,
        }
        editingRef.current = next
        pendingCaretRef.current = previousValue.length
        setEditing(next)
        setEditor(nextSource)
        setPhase('dirty')
        scheduleSave()
      }

      /** Move the block editor's caret without changing its text. */
      const moveCaret = (target) => {
        const session = editingRef.current
        if (session === null) return
        const bounded = Math.max(0, Math.min(target, session.value.length))
        pendingCaretRef.current = bounded
        const next = {
          id: session.id,
          from: session.from,
          to: session.to,
          value: session.value,
          caret: bounded,
        }
        editingRef.current = next
        setEditing(next)
      }

      /**
       * Caret offsets of every cell in the table this session edits.
       * @param session - the open block editor.
       * @returns sorted offsets, or null when the session is not a table.
       */
      const tableCellStarts = (session) => {
        for (const block of documentBlocks) {
          if (block.type !== 'table' || block.from !== session.from) continue
          if (block.rowMeta === undefined) return null
          const starts = []
          for (const row of block.rowMeta) {
            for (const cell of row.cells) starts.push(row.from + cell.from - block.from)
          }
          return starts.sort((a, b) => a - b)
        }
        return null
      }

      /**
       * Apply one structural table edit at the caret.
       * @param operation - `row-after`, `col-after`, `row-delete` or `col-delete`.
       */
      const applyTableOperation = (operation) => {
        const session = editingRef.current
        if (session === null) return
        const alignments = { 'align-left': 'left', 'align-center': 'center', 'align-right': 'right' }
        const align = alignments[operation]
        const result =
          align === undefined
            ? tableOperation(session.value, session.caret, operation)
            : setColumnAlignment(session.value, session.caret, align)
        if (result === null) return
        applyStructural(result.value, result.caret)
      }

      /** Keys the block editor owns: Enter, Tab, Backspace, arrows, formatting and Escape. */
      const onEditingKeyDown = (event) => {
        const session = editingRef.current
        if (session === null) return
        const element = event.target
        const value = session.value
        const caret =
          element !== null && typeof element.selectionStart === 'number'
            ? element.selectionStart
            : value.length

        if (event.key === 'Escape') {
          event.preventDefault()
          stopEditing()
          return
        }

        const command = event.metaKey || event.ctrlKey
        if (command && !event.shiftKey && String(event.key).toLowerCase() === 'z') {
          // Our own structural edits are invisible to the browser's history.
          if (stepHistory('undo') === true) event.preventDefault()
          return
        }
        if (command && event.shiftKey && String(event.key).toLowerCase() === 'z') {
          if (stepHistory('redo') === true) event.preventDefault()
          return
        }
        if (command && String(event.key).toLowerCase() === 'd' && !event.shiftKey) {
          event.preventDefault()
          const result = lineOperation(value, caret, 'duplicate')
          if (result !== null) applyStructural(result.value, result.caret)
          return
        }
        if (command && event.shiftKey && String(event.key).toLowerCase() === 'k') {
          event.preventDefault()
          const result = lineOperation(value, caret, 'delete')
          if (result !== null) applyStructural(result.value, result.caret)
          return
        }
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault()
          const result = lineOperation(value, caret, event.key === 'ArrowUp' ? 'up' : 'down')
          if (result !== null) applyStructural(result.value, result.caret)
          return
        }

        const marker = markerForKey(event)
        if (marker !== null) {
          event.preventDefault()
          const end =
            element !== null && typeof element.selectionEnd === 'number'
              ? element.selectionEnd
              : caret
          const applied = toggleMarker(value, caret, end, marker)
          applyStructural(applied.value, applied.end)
          return
        }

        if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k' && !event.shiftKey) {
          event.preventDefault()
          const end =
            element !== null && typeof element.selectionEnd === 'number' ? element.selectionEnd : caret
          const applied = insertLink(value, caret, end)
          applyStructural(applied.value, applied.caret)
          return
        }

        // Ctrl+1..6 sets a heading level, Ctrl+0 clears it; Cmd+Alt works too
        // because some window managers eat plain Ctrl+digit.
        const headingKey =
          (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) ||
          (event.metaKey && event.altKey)
        if (headingKey && /^[0-6]$/.test(String(event.key))) {
          event.preventDefault()
          const applied = setHeadingLevel(value, caret, Number(event.key))
          applyStructural(applied.value, applied.caret)
          return
        }

        const printable =
          event.key !== undefined && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey
        if (printable) {
          const end =
            element !== null && typeof element.selectionEnd === 'number' ? element.selectionEnd : caret
          const paired = autoPair(value, caret, end, event.key)
          if (paired !== null) {
            event.preventDefault()
            applyStructural(paired.value, paired.caret)
            return
          }
        }

        // Tab walks the cells of a table the way a spreadsheet does.
        if (event.key === 'Tab') {
          const starts = tableCellStarts(session)
          if (starts !== null && starts.length > 0) {
            event.preventDefault()
            const next = starts.find((value) => value > caret) ?? starts[0]
            moveCaret(next)
            return
          }
          // Outside tables Tab indents the line and Shift-Tab outdents it.
          const shiftTab = event.shiftKey === true
          const end =
            element !== null && typeof element.selectionEnd === 'number' ? element.selectionEnd : caret
          const indented = indentLine(value, caret, shiftTab)
          if (indented !== null || shiftTab) {
            event.preventDefault()
            if (indented !== null) applyStructural(indented.value, indented.caret)
            else if (end !== caret) return
            return
          }
        }

        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault()
          const action = splitOnEnter(value, caret)
          if (action.kind === 'inline') {
            applyStructural(value.slice(0, caret) + action.insert + value.slice(caret), caret + action.insert.length)
          } else {
            splitLiveBlock(action.before, action.after)
          }
          return
        }

        if (event.key === 'Backspace' && caret === 0) {
          event.preventDefault()
          mergeWithPrevious()
          return
        }

        if (event.key === 'ArrowUp' && value.lastIndexOf('\n', caret - 1) === -1) {
          const previous = previousEditableBlock(session.from)
          if (previous !== null) {
            event.preventDefault()
            beginEdit(previous, null)
          }
          return
        }

        if (event.key === 'ArrowDown' && value.indexOf('\n', caret) === -1) {
          const next = nextEditableBlock(session.to)
          if (next !== null) {
            event.preventDefault()
            beginEdit(next, 0)
          }
        }
      }

      // Keep the block editor as tall as its source, and honour a caret the
      // edit asked for after React rewrote the value.
      React.useLayoutEffect(() => {
        const element = inputRef.current
        if (element === null) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
        if (pendingCaretRef.current !== null) {
          const caret = pendingCaretRef.current
          pendingCaretRef.current = null
          if (typeof element.setSelectionRange === 'function') element.setSelectionRange(caret, caret)
        }
      })

      // A formatting shortcut rewrites the source buffer, so put the caret back
      // where the wrapped text ended.
      React.useLayoutEffect(() => {
        const element = sourceRef.current
        if (element === null || sourceCaretRef.current === null) return
        const caret = sourceCaretRef.current
        sourceCaretRef.current = null
        element.focus()
        if (typeof element.setSelectionRange === 'function') element.setSelectionRange(caret, caret)
      })

      // Keep the active search hit on screen while the query or index moves.
      React.useEffect(() => {
        if (!findOpen || query === '') return
        const container = scrollRef.current
        if (container === null || container === undefined) return
        let mark = null
        try {
          mark = container.querySelector('[data-dcw-current="true"]')
        } catch {
          mark = null
        }
        if (mark !== null && typeof mark.scrollIntoView === 'function') {
          mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }, [findOpen, query, matchIndex, draft, mode])

      // Typewriter mode pads the scroll box by half the missing height, so the
      // caret line can reach the vertical centre (the reference does the same).
      React.useLayoutEffect(() => {
        const container = scrollRef.current
        if (container === null) return
        if (!typewriter) {
          container.style.paddingTop = ''
          container.style.paddingBottom = ''
          return
        }
        const element = inputRef.current
        let lineHeight = 0
        if (element !== null && typeof window.getComputedStyle === 'function') {
          lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight)
        }
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 22
        const pad = Math.max(0, Math.round((container.clientHeight - lineHeight) / 2))
        container.style.paddingTop = `${pad}px`
        container.style.paddingBottom = `${pad}px`
      }, [typewriter, editing === null ? null : editing.id, zoom, mode])

      // Focus a newly opened block and place its caret.
      React.useLayoutEffect(() => {
        const element = inputRef.current
        if (element === null || editing === null) return
        element.focus()
        if (typeof element.setSelectionRange === 'function') {
          element.setSelectionRange(editing.caret, editing.caret)
        }
        if (typewriter && typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ block: 'center' })
        }
      }, [editing === null ? null : editing.id])


      const dirty = draft !== disk.content
      const stateText = (() => {
        if (phase === 'saving') return t('state.saving')
        if (phase === 'loading') return t('state.loading')
        if (phase === 'dirty' || dirty) return t('state.dirty')
        if (phase === 'reloaded') return t('state.reloaded', { time: clockText(savedAt) })
        if (phase === 'saved') return t('state.saved', { time: clockText(savedAt) })
        return t('state.synced')
      })()

      const styleTag = h('style', { key: 'style', 'data-plugin': 'dsh-cowrite' }, CSS)

      if (cwd === undefined) {
        return h('div', { className: 'dcw-root' }, styleTag, h('div', { className: 'dcw-empty' }, t('empty.noWorkspace')))
      }

      const hasFiles = Array.isArray(files) && files.length > 0
      const banner =
        conflict !== null
          ? h(
              'div',
              { className: 'dcw-banner', 'data-kind': 'conflict' },
              h('span', { className: 'dcw-banner-text' }, t('conflict.changed')),
              h('button', { type: 'button', className: 'dcw-btn', onClick: takeDiskVersion }, t('conflict.takeDisk')),
              h('button', { type: 'button', className: 'dcw-btn', onClick: () => void keepMine() }, t('conflict.keepMine')),
            )
          : error !== null
            ? h(
                'div',
                { className: 'dcw-banner', 'data-kind': 'error' },
                h('span', { className: 'dcw-banner-text' }, error),
              )
            : null

      // Zoom scales the content root in px; every markdown size is in em, so
      // headings, code and tables grow together with body text.
      const contentFont = { fontSize: `${BASE_FONT_PX * zoom}px` }

      /** The table being edited, if any: it earns its own structural toolbar. */
      const editingTable =
        editing === null
          ? null
          : documentBlocks.find((block) => block.type === 'table' && block.from === editing.from) ?? null

      const tableTools =
        editingTable === null
          ? null
          : h(
              'div',
              { className: 'dcw-tabletools', role: 'group', 'aria-label': t('table.hint') },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  // Keep the caret in the table while pressing the control.
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('row-after'),
                },
                t('table.addRow'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  title: t('table.addRowAbove'),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('row-before'),
                },
                '↑+',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('col-after'),
                },
                t('table.addColumn'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  title: t('table.addColumnBefore'),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('col-before'),
                },
                '←+',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('row-delete'),
                },
                t('table.deleteRow'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('col-delete'),
                },
                t('table.deleteColumn'),
              ),
              h('span', { key: 'sep', className: 'dcw-tabletools-sep' }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  title: t('table.alignLeft'),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('align-left'),
                },
                '⇤',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  title: t('table.alignCenter'),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('align-center'),
                },
                '⇔',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcw-seg',
                  title: t('table.alignRight'),
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => applyTableOperation('align-right'),
                },
                '⇥',
              ),
            )

      const modeSwitch = h(
        'div',
        { className: 'dcw-group', role: 'group', 'aria-label': t('bar.pick') },
        MODES.map((value) =>
          h(
            'button',
            {
              key: value,
              type: 'button',
              className: 'dcw-seg',
              'data-on': mode === value ? 'true' : 'false',
              'aria-pressed': mode === value,
              onClick: () => changeMode(value),
            },
            t(`mode.${value}`),
          ),
        ),
      )

      const zoomControls = h(
        'div',
        { className: 'dcw-group dcw-zoom', role: 'group' },
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            title: t('zoom.out'),
            'aria-label': t('zoom.out'),
            disabled: zoom <= ZOOM_MIN,
            onClick: () => applyZoom(stepZoom(zoom, -1)),
          },
          '−',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg dcw-zoom-value',
            title: t('zoom.reset'),
            onClick: () => applyZoom(1),
          },
          `${Math.round(zoom * 100)}%`,
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            title: t('zoom.in'),
            'aria-label': t('zoom.in'),
            disabled: zoom >= ZOOM_MAX,
            onClick: () => applyZoom(stepZoom(zoom, 1)),
          },
          '+',
        ),
      )

      const actionButtons = h(
        'div',
        { className: 'dcw-group', role: 'group' },
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': outlineOpen ? 'true' : 'false',
            'aria-pressed': outlineOpen,
            title: t('outline.title'),
            'aria-label': t('outline.title'),
            onClick: () => setOutlineOpen((current) => !current),
          },
          '▤',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': findOpen ? 'true' : 'false',
            'aria-pressed': findOpen,
            title: t('find.title'),
            'aria-label': t('find.title'),
            onClick: () => setFindOpen((current) => !current),
          },
          '⌕',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            title: t('export.title'),
            'aria-label': t('export.title'),
            disabled: typeof path !== 'string',
            onClick: exportHtml,
          },
          '⤓',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': indentParagraphs ? 'true' : 'false',
            'aria-pressed': indentParagraphs,
            title: t('indent.title'),
            'aria-label': t('indent.title'),
            onClick: toggleIndent,
          },
          '¶',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': lineNumbers ? 'true' : 'false',
            'aria-pressed': lineNumbers,
            title: t('lineno.title'),
            'aria-label': t('lineno.title'),
            onClick: toggleLineNumbers,
          },
          '⌗',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': typewriter ? 'true' : 'false',
            'aria-pressed': typewriter,
            title: typewriter ? t('typewriter.on') : t('typewriter.off'),
            'aria-label': typewriter ? t('typewriter.on') : t('typewriter.off'),
            onClick: toggleTypewriter,
          },
          '⇕',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dcw-seg',
            'data-on': focusMode ? 'true' : 'false',
            'aria-pressed': focusMode,
            title: focusMode ? t('focus.on') : t('focus.off'),
            'aria-label': focusMode ? t('focus.on') : t('focus.off'),
            onClick: toggleFocusMode,
          },
          '◎',
        ),
      )

      const tools = h('div', { className: 'dcw-tools' }, modeSwitch, zoomControls, actionButtons)

      // The search bar sits above the document, so the counter never covers text.
      const findBar = findOpen
        ? h(
            'div',
            { className: 'dcw-find' },
            h('input', {
              className: 'dcw-find-input',
              type: 'search',
              value: query,
              placeholder: t('find.placeholder'),
              'aria-label': t('find.title'),
              onChange: (event) => {
                setQuery(event.target.value)
                setMatchIndex(0)
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  stepMatch(event.shiftKey ? -1 : 1)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setFindOpen(false)
                }
              },
            }),
            h(
              'span',
              { className: 'dcw-find-count' },
              query === '' ? '' : matchTotal === 0 ? t('find.none') : `${Math.min(matchIndex + 1, matchTotal)}/${matchTotal}`,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dcw-seg',
                title: t('find.prev'),
                'aria-label': t('find.prev'),
                disabled: matchTotal === 0,
                onClick: () => stepMatch(-1),
              },
              '‹',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dcw-seg',
                title: t('find.next'),
                'aria-label': t('find.next'),
                disabled: matchTotal === 0,
                onClick: () => stepMatch(1),
              },
              '›',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dcw-seg',
                'data-on': replaceOpen ? 'true' : 'false',
                title: t('find.replace'),
                'aria-label': t('find.replace'),
                onClick: () => setReplaceOpen((current) => !current),
              },
              '⇄',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dcw-seg',
                title: t('find.close'),
                'aria-label': t('find.close'),
                onClick: () => setFindOpen(false),
              },
              '×',
            ),
            replaceOpen
              ? h(
                  'div',
                  { key: 'replace-row', className: 'dcw-find-replace' },
                  h('input', {
                    className: 'dcw-find-input',
                    type: 'text',
                    value: replacement,
                    placeholder: t('find.replacePlaceholder'),
                    'aria-label': t('find.replacePlaceholder'),
                    onChange: (event) => setReplacement(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        runReplace(event.shiftKey)
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setReplaceOpen(false)
                      }
                    },
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dcw-seg',
                      disabled: matchTotal === 0,
                      onClick: () => runReplace(false),
                    },
                    t('find.replaceOne'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dcw-seg',
                      disabled: matchTotal === 0,
                      onClick: () => runReplace(true),
                    },
                    t('find.replaceAll'),
                  ),
                )
              : null,
          )
        : null

      /**
       * One outline row set, recursively: a branch shows an expander and hides
       * its children until opened, the way the reference panel does.
       * @param items - tree nodes at this depth.
       * @returns React children.
       */
      const renderOutline = (items) =>
        items.map((item) => {
          const open = !collapsed.has(item.index)
          return h(
            'div',
            { key: `o${item.index}`, className: 'dcw-outline-wrap' },
            h(
              'div',
              { className: 'dcw-outline-row' },
              item.children.length === 0
                ? h('span', { key: 'sp', className: 'dcw-outline-expander' })
                : h(
                    'button',
                    {
                      key: 'ex',
                      type: 'button',
                      className: 'dcw-outline-expander',
                      'data-open': open ? 'true' : 'false',
                      title: open ? t('outline.collapse') : t('outline.expand'),
                      onClick: () => toggleCollapsed(item.index),
                    },
                    open ? '▾' : '▸',
                  ),
              h(
                'button',
                {
                  key: 'label',
                  type: 'button',
                  className: 'dcw-outline-item',
                  'data-level': String(item.level),
                  style: { paddingLeft: `${8 + (item.level - 1) * 12}px` },
                  onClick: () => {
                    setOutlineOpen(false)
                    scrollToBlock(item.heading.from)
                  },
                },
                item.heading.value,
              ),
            ),
            item.children.length > 0 && open
              ? h('div', { key: 'kids', className: 'dcw-outline-children' }, renderOutline(item.children))
              : null,
          )
        })

      const outlinePopover =
        outlineOpen && headings.length > 0
          ? h('div', { className: 'dcw-outline' }, renderOutline(outlineTree))
          : null

      /**
       * A fresh highlight pass. Both views build their tree eagerly, so a
       * shared counter would be consumed by the view that is not rendered.
       * @returns the highlight options, or null when the bar is empty.
       */
      const makeHighlight = () =>
        query === '' ? null : { query, index: matchIndex, counter: { seen: 0 } }

      const previewHighlight = makeHighlight()
      const previewFootnotes = { seen: new Map(), order: [] }
      const documentView = h(
        'div',
        {
          className: 'dcw-doc',
          style: contentFont,
          'data-cowrite-view': 'preview',
          'data-indent': indentParagraphs ? 'true' : 'false',
          ref: (element) => {
            scrollRef.current = element
          },
        },
        h(
          'div',
          { className: 'dcw-md' },
          documentBlocks.map((block, index) =>
            block.type === 'blank'
              ? h('div', { key: `p${index}`, className: 'dcw-md-blank' })
              : h(
                  'div',
                  {
                    key: `p${index}`,
                    className: 'dcw-block',
                    'data-dcw-block': String(block.from),
                  },
                  renderBlocks([block], {
                    highlight: previewHighlight,
                    images,
                    taskToggle: toggleTask,
                    footnoteState: previewFootnotes,
                    headings,
                    scrollTo: scrollToBlock,
                    t,
                    lineNumbers,
                    copyCode,
                    anchors,
                    onAnchor: scrollToBlock,
                    flashAnchor,
                    commitLanguage,
                    languageEdit,
                    openLanguage: (from) => setLanguageEdit(from),
                  }),
                ),
          ),
        ),
      )

      /**
       * The hybrid document: every block renders, except the one the caret is
       * in, which shows its own source in a textarea.
       * @returns React children for the live container.
       */
      const buildLive = () => {
        const liveHighlight = makeHighlight()
        const liveFootnotes = { seen: new Map(), order: [] }
        const children = []
        const dim = focusMode && editing !== null
        const renderBlock = (block, key) => {
          if (block.type === 'blank') return h('div', { key, className: 'dcw-md-blank' })
          return h(
            'div',
            {
              key,
              className: 'dcw-live-block',
              'data-dcw-block': String(block.from),
              'data-dim': dim ? 'true' : 'false',
              onClick: (event) => onBlockClick(event, block),
            },
            renderBlocks([block], {
                clickMap: true,
                source: draft,
                highlight: liveHighlight,
                images,
                taskToggle: toggleTask,
                footnoteState: liveFootnotes,
                headings,
                scrollTo: scrollToBlock,
                t,
                lineNumbers,
                copyCode,
                anchors,
                onAnchor: scrollToBlock,
                flashAnchor,
                commitLanguage,
                languageEdit,
                openLanguage: (from) => setLanguageEdit(from),
              }),
          )
        }

        if (editing === null) {
          if (documentBlocks.length === 0) {
            return [
              h(
                'div',
                {
                  key: 'placeholder',
                  className: 'dcw-live-empty',
                  onClick: () => beginEdit({ from: 0, to: 0 }, 0),
                },
                t('live.hint'),
              ),
            ]
          }
          documentBlocks.forEach((block, index) => children.push(renderBlock(block, `l${index}`)))
          return children
        }

        const input = h('textarea', {
          key: 'live-input',
          ref: (element) => {
            inputRef.current = element
          },
          className: 'dcw-live-input',
          value: editing.value,
          'data-dcw-caret': String(editing.caret),
          spellCheck: false,
          wrap: 'soft',
          'aria-label': t('editor.aria'),
          onChange: (event) => applyLiveValue(event.target.value, event.target.selectionStart ?? 0),
          onKeyDown: onEditingKeyDown,
          onSelect: (event) => setSelectionText(readSelection(event.target)),
          onPaste: (event) => {
            const element = event.target
            const caret = element.selectionStart ?? element.value.length
            const end = element.selectionEnd ?? element.value.length
            if (handleImageEvent(event, applyStructural, element.value, caret, end)) return
            handleHtmlPaste(event, applyStructural, element.value, caret, end)
          },
          onDrop: (event) => {
            const element = event.target
            handleImageEvent(
              event,
              applyStructural,
              element.value,
              element.selectionStart ?? element.value.length,
              element.selectionEnd ?? element.value.length,
            )
          },
        })

        let inserted = false
        documentBlocks.forEach((block, index) => {
          const overlaps = block.from < editing.to && block.to > editing.from
          const beforeSession = block.from >= editing.to
          if (!inserted && (overlaps || beforeSession)) {
            children.push(input)
            inserted = true
          }
          if (overlaps) return
          children.push(renderBlock(block, `l${index}`))
        })
        if (!inserted) children.push(input)
        return children
      }

      const liveView = h(
        'div',
        // The prose classes come along, so block wrappers inherit the same
        // typography and spacing as the preview.
        {
          className: 'dcw-doc dcw-md dcw-live',
          style: contentFont,
          'data-cowrite-view': 'live',
          'data-indent': indentParagraphs ? 'true' : 'false',
          ref: (element) => {
            scrollRef.current = element
          },
        },
        buildLive(),
      )

      const sourceView = h('textarea', {
        ref: (element) => {
          sourceRef.current = element
        },
        className: 'dcw-editor',
        style: contentFont,
        value: draft,
        spellCheck: false,
        wrap: 'soft',
        'aria-label': t('editor.aria'),
        'data-cowrite-view': 'source',
        onChange,
        onKeyDown,
        onSelect: (event) => setSelectionText(readSelection(event.target)),
        onPaste: (event) => {
          const element = event.target
          const caret = element.selectionStart ?? element.value.length
          const end = element.selectionEnd ?? element.value.length
          const apply = (nextValue, nextCaret) => {
            sourceCaretRef.current = nextCaret
            setEditor(nextValue)
            setPhase('dirty')
            scheduleSave()
          }
          if (handleImageEvent(event, apply, element.value, caret, end)) return
          handleHtmlPaste(event, apply, element.value, caret, end)
        },
        onDrop: (event) => {
          const element = event.target
          handleImageEvent(
            event,
            (nextValue, caret) => {
              sourceCaretRef.current = caret
              setEditor(nextValue)
              setPhase('dirty')
              scheduleSave()
            },
            element.value,
            element.selectionStart ?? element.value.length,
            element.selectionEnd ?? element.value.length,
          )
        },
      })

      return h(
        'div',
        {
          className: 'dcw-root',
          'data-cowrite': 'ready',
          'data-cowrite-tab': tab ? tab.id : '',
          onKeyDown: (event) => {
            if (event.defaultPrevented) return
            if (event.key === 'Escape') {
              if (findOpen || outlineOpen) {
                event.preventDefault()
                setFindOpen(false)
                setOutlineOpen(false)
              }
              return
            }
            const meta = event.metaKey || event.ctrlKey
            if (!meta) return
            if (event.key === 'f' || event.key === 'F') {
              event.preventDefault()
              setFindOpen(true)
              return
            }
            if (event.key === 'g' || event.key === 'G') {
              event.preventDefault()
              stepMatch(event.shiftKey ? -1 : 1)
              return
            }
            if (event.key === '=' || event.key === '+') {
              event.preventDefault()
              applyZoom(stepZoom(zoom, 1))
            } else if (event.key === '-' || event.key === '_') {
              event.preventDefault()
              applyZoom(stepZoom(zoom, -1))
            } else if (event.key === '0') {
              event.preventDefault()
              applyZoom(1)
            }
          },
        },
        styleTag,
        h(
          'div',
          { className: 'dcw-bar' },
          h(
            'select',
            {
              className: 'dcw-select',
              'aria-label': t('bar.pick'),
              value: typeof path === 'string' ? path : '',
              onChange: (event) => {
                if (event.target.value !== '') void loadFile(event.target.value)
              },
            },
            typeof path === 'string'
              ? null
              : h('option', { value: '' }, t('empty.pick')),
            (files ?? []).map((entry) => h('option', { key: entry.path, value: entry.path }, entry.path)),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dcw-btn',
              title: t('bar.refresh'),
              disabled: refreshing,
              onClick: () => {
                void (async () => {
                  const list = await refreshList()
                  if (list !== null) await pickInitialFile(list)
                })()
              },
            },
            '⟳',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dcw-btn',
              disabled: typeof path !== 'string' || !dirty || savingRef.current,
              onClick: () => {
                if (timerRef.current !== null) clearTimeout(timerRef.current)
                timerRef.current = null
                void saveNow()
              },
            },
            t('bar.save'),
          ),
        ),
        tools,
        findBar,
        tableTools,
        outlinePopover,
        banner,
        typeof path === 'string'
          ? mode === 'live'
            ? liveView
            : mode === 'preview'
              ? documentView
              : sourceView
          : h(
              'div',
              { className: 'dcw-empty' },
              phase === 'loading'
                ? t('empty.loading')
                : hasFiles
                  ? t('empty.pick')
                  : h(
                      React.Fragment,
                      null,
                      h('strong', null, t('empty.noFiles')),
                      h('span', null, t('empty.noFilesHint')),
                    ),
            ),
        h(
          'div',
          { className: 'dcw-foot' },
          h(
            'button',
            {
              type: 'button',
              className: 'dcw-foot-count',
              title: t('foot.cycle'),
              onClick: cycleCountMode,
            },
            (() => {
              const label = (value) =>
                countMode === 'minutes'
                  ? value === 0
                    ? t('foot.zeroMinutes')
                    : value === 1
                      ? t('foot.oneMinute')
                      : t('foot.minutes', { n: value })
                  : t(`foot.${countMode}`, { n: value })
              const total = countFor(countMode, draft)
              if (selectionText === '') return label(total)
              // `selected / total`, in the same unit the counter is set to.
              return `${label(countFor(countMode, selectionText))} / ${label(total)}`
            })(),
          ),
          typeof disk.mtimeMs === 'number' && disk.mtimeMs > 0
            ? h('span', null, t('foot.modified', { time: clockText(disk.mtimeMs) }))
            : null,
          h('span', { className: 'dcw-foot-state' }, stateText),
        ),
      )
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

    function apply(ctx) {
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'cowrite: dictionaries',
      )

      // The tab type: what the registry opens and what the guide card offers.
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            priority: 'extension',
            keepMounted: true,
            title: () => t('tab.title'),
            guide: [
              {
                id: 'cowrite',
                commandId: SHORTCUT_ID,
                order: 20,
                title: () => t('guide.title'),
                description: () => t('guide.description'),
                icon: CowriteIcon,
              },
            ],
          }),
        'cowrite: tab type',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              {
                name: 'sidebar.right.pane.tab',
                key: TAB_ID,
                locale: NS,
                inject: () => ({ api: createApi() }),
              },
              CowriteBody,
            ),
          ),
        'cowrite: tab body',
      )

      // Cmd/Ctrl+Shift+M opens the pane from anywhere in the page.
      ctx.inject(['shortcuts'], (shortcutsCtx) => {
        const shortcuts = shortcutsCtx.shortcuts
        if (!shortcuts || typeof shortcuts.register !== 'function') return
        shortcutsCtx.effect(
          () =>
            shortcuts.register({
              id: SHORTCUT_ID,
              label: () => t('guide.title'),
              aliases: ['co-writing', 'cowrite', 'markdown', '共写'],
              defaults: {
                'desktop:macos': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                'desktop:windows': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                'desktop:linux': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                'web:macos': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                'web:windows': { code: 'KeyM', modifiers: ['primary', 'shift'] },
                'web:linux': { code: 'KeyM', modifiers: ['primary', 'shift'] },
              },
              regions: ['page', 'editable', 'terminal'],
              modals: [],
              resolve: ({ target: element }) => {
                const target = ctx.sidebarRight.commandTarget(element)
                if (target === undefined) return { status: 'blocked', reason: t('shortcut.noSession') }
                return {
                  status: 'handled',
                  run: () => {
                    ctx.sidebarRight.openTabFromTarget(TAB_KIND, target)
                  },
                }
              },
            }),
          'cowrite: open shortcut',
        )
      })
    }

    return {
      inject,
      apply,
      // Reachable for this package's own tests; the Harness never reads it.
      __test: { parseBlocks, parseInline, renderBlocks, renderInline, renderChem, splitOnEnter, blockShift, stepZoom, safeColor, htmlToMarkdown, decodeEntities, tidyMarkdown, applyFormatting, splitTableRowCells, tableOperation, tablePosition, setColumnAlignment, alignmentCell, parseTex, texTokens, autoPair, codeTokens, codeGrammar, renderCode, markerRanges, snapToBoundary, indentLine, lineOperation, lineRange, setHeadingLevel, toggleMarker, insertLink, findMatches, replaceMatches, headingSlug, headingAnchors, imagePath, insertImage, blobToBase64, renderTex, renderMathDisplay, splitMathTag, mathAlphabet, countWords, countFor, inlineTagAt, sanitizeHtml, parseMermaid, renderMermaid, layoutMermaid, orthogonalEdge, nodeToHtml, buildExportDocument, escapeHtml, MODES },
    }
  },
})
