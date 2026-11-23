# 复现 Typora 的完整交付说明

这份文档收束"尽量接近 Typora 1.14.10"的工作：做了什么、怎么验的、还差什么。
`README.md` 讲用法，`ROADMAP.md` 记缺口清单，这里讲**结论**。

体量：`client.js` 7516 行、`index.js` 591 行、`README.md` 278 行、`ROADMAP.md` 46 行；
测试 27 组、742 条断言，全部离线可跑（`realdoc` 需 DSH 运行）。

## 一、编辑手感

| 能力 | 快捷键 | 说明 |
| --- | --- | --- |
| 撤销/重做 | `⌘Z` / `⌘⇧Z` | 自有栈，覆盖浏览器历史看不见的**结构编辑**（换行拆块、Tab 缩进、自动配对、表格增删、替换） |
| 复制/删除/移动行 | `⌘D` / `⌘⇧K` / `⌥↑↓` | 光标跟随移动的行并保持列位置 |
| 标题级别 | `⌃1`–`⌃6` / `⌃0` | 同级别再按一次取消；只改光标所在行 |
| 行内标记 | `⌘B` / `⌘I` / `⌘E` | 再按一次**取消**，选中内容不被破坏 |
| 插入链接 | `⌘K` | 选中当标题，URL 位待输入 |
| 查找替换 | `⌘F` → `⇄` | 单次/全部；替换可撤销（历史栈支持整篇条目） |
| 选中计数 | — | 页脚 `选中 / 总计`，跟随当前计数单位 |

## 二、Markdown 能力

- 标题锚点（GitHub 风格 slug，重名 `-1`）与 `#标题` 窗格内跳转
- 图片粘贴/拖入 → 字节走 `POST /api/dsh-cowrite/upload` 落到 `assets/`，插入 `![](…)`
- 粘贴富文本：`text/html` 转 Markdown（标题/强调/链接/图片/嵌套列表/引用/代码/表格/实体）
- 表格：在光标处上下左右插入、删行列、列对齐（新列继承邻列对齐）
- 脚注：上标引用 ↔ 脚注块互跳，反链 `↩` 回跳时**高亮 1.2 秒**

## 三、公式（CSS 排版子集）

- 宏：`\frac \sqrt[3] \binom`（无分数线，与参考的 Genfrac 厚度 0 一致）`\dbinom \tbinom \genfrac`
- 定界：`\left \right`、`\big`–`\Bigg` 四级、`\substack`、`\mathclap/\llap/\rlap`
- 字体：`\mathbb \mathcal \mathscr \mathfrak`（含 `ℝ ℂ ℒ ℳ ℯ` 例外码位）、`\mathbf \mathit \mathsf \mathtt`、`\text` 系
- 堆叠：`\stackrel \overset \underset \overunderset \overbrace \underbrace \boxed`
- 配色：`\textcolor` / `\color`（同组后续着色）/ `\colorbox` / `\fcolorbox` / `\definecolor`，颜色走白名单
- 编号：`\tag{2.1}` 右对齐，`\notag` 抑制，行内不编号
- 化学式：`\ce{}`（下标、电荷上标、`->` `<=>` 箭头、`*`→`·`）

## 四、图表（自绘 SVG）

- 流程图：`graph TD/LR`、四种节点形状、`-->` `-.->` `==>`、`|标签|`、`subgraph` 分组框、`classDef` 样式
- 布局：分层 + 三轮重心扫描降交叉 + 短行居中 + **正交肘形走线 + 节点避让**
- 时序图：`participant`、同步/异步/失败三种消息、虚线生命线
- 主题：节点 `#ECECFF`、参与者 `#FFFFDE`、描边 `#9370DB`，跟随暗色模式

## 五、代码着色

- 按语言的关键字表（手写 20+ 种 + 从 mode 包抽取的 12 种取并集）
- 多行构造：Python/Elixir 三引号、Shell/Ruby/PHP heredoc、Rust/Swift/Julia 嵌套注释、JS 模板字符串 `${}` 嵌套
- 字面量：JS 正则 `/…/gi`（按前一记号区分除法）、Ruby `%w[]`、Perl `q// qw{} s///g tr///`、C++ `R"(…)"`
- 开行号时整块先分词再按行切，多行字符串不会被切碎

## 六、验证方式

1. **离线测试**：27 组 742 条断言，迷你 React（真 state/effect）驱动交互路径
2. **真实路由**：每轮用写着删的 e2e 探针经 `http://127.0.0.1:53920/api/dsh-cowrite` 读写工作区真实文件
3. **宿主重载**：宿主改动后 disable/enable 插件行；客户端改动刷新页面
4. **文档同步**：README 与 ROADMAP 每轮更新

## 七、明确不做

- `\require` 扩展包：需要真正的 MathJax 扩展加载器，等于把 TeX 引擎搬进来
- 公式自动编号与交叉引用：只能手写 `\tag`
- 真正的数学字体度量：MathJax 用 SVG 字形，这边是 CSS 排版
- PDF/Word 直接导出：只能导 HTML + 浏览器打印
- 图表不是 mermaid 本体：子图只画分组框，交叉消除是启发式而非 dagre/elk

## 八、过程中修掉的真 bug（留档）

- `\binom` 曾画分数线（参考实现厚度为 0）
- `\overline` 曾被误当重音符，只给最后一个字母加线
- 开行号时多行字符串被逐行切碎
- 行内标记再按会叠成 `****粗体****`
- 节点填充曾用应用 token，与参考默认主题不一致
- `assets/` 前缀丢失导致根目录文档的图片落在工作区根
- `storePastedImage` 的依赖引用触发 TDZ，连带 9 个套件崩
