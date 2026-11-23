# 更新日志

## 1.0.2

- 修复：Web 版 Linux 的默认快捷键被 DSH 注册表拒绝（该平台只放行 `Slash`、`Comma+Shift`、`Period+Shift`），
  异常抛出后整个浏览器半启动失败。移除 `web:linux` 默认键；桌面版 Linux 仍为 `Cmd/Ctrl+Shift+M`。

## 1.0.1

- 修复：`client.js` 仍用旧包名 `@local/dsh-cowrite` 调用 `__ModuleLoader__.load`，
  而 loader 按行说明符注册模块，于是浏览器半报 "loaded without registering dsh-cowrite"，
  右侧栏标签页静默不出现；宿主半不受影响，因此故障被掩盖。

## 1.0.0

首个公开版本。

- 右侧栏「共写文档」标签页：排版（逐块就地编辑）/ 预览 / 源码三种视图
- 保存采用比较-交换，助手或外部工具改动同一文件时自动刷新或提示冲突
- 公式（TeX 子集）、Mermaid 子图（流程图/时序图/饼图）、代码语法着色
- 图片粘贴落盘、粘贴 HTML 转 Markdown、表格增删行列、脚注互跳、导出 HTML
