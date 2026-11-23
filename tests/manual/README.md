# 手动探针

这些 `e2e-rNN.mjs` 是我逐轮开发时用的一次性验证脚本：**直接打真实 HTTP 路由、在工作区里建临时文件、跑完删掉**。
它们不属于自动测试（不会被 `tests/*.test.mjs` 的批量运行捡到），也没有断言框架——输出要人眼看。

需要两个环境变量：

```sh
export DSH_WEB_URL=http://127.0.0.1:50210          # DSH 实际监听地址
export COWRITE_TEST_ROOT=/path/to/allowed/workspace # DSH 允许读写的根目录
node manual/e2e-r19.mjs
```

保留它们的目的是留下"每项能力当时怎么端到端验的"记录；正式回归请跑 `tests/*.test.mjs`。
