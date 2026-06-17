# Pyodide 本地执行功能优化设计

日期:2026-06-17
状态:已批准,待实施
影响目录:`src/features/local-python/` 及消费方

## 背景

`src/features/local-python/` 通过 Web Worker 在浏览器内运行 Pyodide 执行 Python 代码,服务于两条路径:AI 的 `run_local_python` 工具调用(`clientFunctionTool` → `pyodideService.runPython`)与用户在代码块手动运行(`usePyodide` → `CodeBlock`)。

代码审查发现 10 项问题,涵盖并发、生命周期、性能与正确性。本设计在保持现有接入面(`runPython(code, { files, abortSignal })` 签名、`PyodideFile`/`ExecutionResult` 概念)不变的前提下逐项修复。

## 已确认的关键设计决策

1. **并发模型 = 排队串行**:保持单 worker,并发请求入 FIFO 队列依次执行。消除"第二个请求直接报错";单 Pyodide 实例,内存可控。
2. **中断策略 = 预热备用 worker**:abort/timeout 仍 terminate worker(Pyodide 无法可靠中断 numpy 等 C 扩展),但 terminate 后立即在后台预热新 worker,下次请求热启动。
3. **文件传输 = transfer ArrayBuffer**:产物以 `ArrayBuffer` 经 postMessage transfer list 零拷贝回传,彻底取代逐字节 base64 编码。

## 模块 A:执行模型与生命周期

涉及问题:并发报错(1)、中断后冷启动(2)、abort 不生效(3)、worker 回收、mountFiles 死代码(4)。

### A1 请求队列(`pyodideService.ts`)

- 移除 `beginRequest` 在 `activeRequestId` 已存在时抛 `"Pyodide request already in progress"` 的逻辑。
- 引入内部 FIFO 队列:用一个 promise-chain 锁(或 async mutex)串行化所有 `runPython`。`runPython` 进入时获取锁,执行完毕释放;并发调用自动排队。
- `activeRequestId` 仍用于标识"当前正在 worker 上跑的请求",但不再用作拒绝新请求的门槛。
- 超时(60s)与 abort 仍只针对当前持有锁的请求。

### A2 预热备用 worker(`pyodideWorkerTemplate.ts` + `pyodideService.ts`)

- worker 模板新增 `WARMUP` 消息类型:加载 Pyodide 与预装包(与首次 `loadPyodideAndPackages` 等价),完成后回 `{ status: 'ready' }`,不产生执行结果。
- `resetWorker`(由 abort/timeout 触发)terminate 当前 worker 后,立即 `void this.initWorker()` 并向新 worker 投递 `WARMUP`,后台异步预热。
- `initWorker` 改为可被外部触发预热(当前仅 lazy 创建 worker,加载发生在首个业务消息时)。
- 下一个 `runPython` 命中已预热的 worker,跳过冷加载。

### A3 abort 全程生效(`pyodideService.ts`)

- `runPython` 内 abort listener 的注册从 `postMessage` 之前,提前到 `beginRequest`/获取锁之后、`prepareExecutionFiles` 之前。
- `handleAbort` 不再依赖 `pendingPromises.has(id)` 判断;abort 一旦触发即终止当前执行并 reject(对持有锁的请求)。
- 队列中尚未获得锁的请求:abort 时直接从队列移除并 reject(无需 terminate worker)。

### A4 空闲回收 + dispose(`pyodideService.ts`)

- 新增 `IDLE_TIMEOUT_MS`(默认 300000,即 5 分钟):worker 空闲超过该时长则 terminate 释放内存;下次请求重新预热。
- 新增 `dispose()`:terminate worker、清空队列与 pending、注销定时器。供页面卸载/会话切换调用(接入点后续在实施时确认,如 `useHistoryClearer` 或应用顶层)。

### A5 删除 mountFiles 死代码

- `mountFiles` 仅测试调用,业务全走 `runPython(code, { files })`。删除 `mountFiles` 及 `pyodideService.test.ts` 中对应两个测试。

## 模块 B:文件传输零拷贝

涉及问题:base64 O(n²) 编码卡顿(5)。

### B1 worker 端不再 base64(`pyodideWorkerTemplate.ts`)

- 删除 `arrayBufferToBase64`。`generatedOutputFiles` 的 `data` 直接存 `ArrayBuffer`(`pyodide.FS.readFile` 返回 `Uint8Array`,取 `.buffer`)。
- matplotlib 产物的 `image` 同样以 `ArrayBuffer`(PNG bytes)回传,删除 `base64.b64encode` 逻辑。
- `self.postMessage` 时把所有产物 buffer 加入 transfer list(零拷贝)。

### B2 类型变更

- `PyodideFile.data: string(Base64) → ArrayBuffer`。
- `ExecutionResult.image: string | undefined → ArrayBuffer | null`。

### B3 消费端适配

- `src/utils/chat/parsing.ts` 新增 `createUploadedFileFromBytes(buffer: ArrayBuffer, mimeType, name)`,直接 `new File([buffer], ...)`,跳过 base64→Blob 解码。`createUploadedFileFromBase64` 保留不动(imageGenerationStrategy / imageEditStrategy / messageStreamParts 仍需 base64 入口)。
- `clientFunctionTool.ts:45` 改用 `createUploadedFileFromBytes`。
- `usePyodide.ts`:`PyodideState.image/files` 类型同步改为 ArrayBuffer;结果缓存仍有效(ArrayBuffer 比 base64 string 更省内存)。
- `CodeBlock.tsx:100`:展示侧 `data:${type};base64,${file.data}` 改为 `URL.createObjectURL(new Blob([file.data], { type: file.type }))`,并经 `objectUrlManager` 托管释放(`createManagedObjectUrl`/`releaseManagedObjectUrl`),防止泄漏。`image` 展示同理。

## 模块 C:worker 模板正确性

涉及问题:basePath 误导(7)、错误信息丢失(8)、matplotlib 残留(9)、result 语义(10)、依赖预加载(6)。

### C1 listFilesRecursively 参数修正(`pyodideWorkerTemplate.ts:84`)

- 删除无用的 `basePath` 参数。函数签名改为 `(currentPath)`,内部完全基于 `currentPath` 遍历。
- 调用点(`listFilesRecursively(runDir)`)显式传 `runDir` 作为起始路径,不再依赖隐式 `cwd`。

### C2 错误信息与 traceback(`pyodideWorkerTemplate.ts:246`)

- worker 的 catch 归一化 error:`const msg = (executionError && executionError.message) ? executionError.message : String(executionError)`。
- Pyodide 抛出的 `PythonError` 保留完整 traceback(其 `message` 通常已含 traceback),原样透传,不再截断。
- 主线程 `normalizeWorkerError` 已存在,继续复用。

### C3 matplotlib 隔离(`pyodideWorkerTemplate.ts:173`)

- 每次执行前 `plt.close('all')`(关闭所有 figure,而非仅 `clf` 当前 figure)。
- 执行前后保存/恢复 `plt.rcParams`(快照 dict),消除用户代码对全局样式的残留污染。
- 保留执行后 `plt.clf()` 兜底。

### C4 result 语义(`pyodideWorkerTemplate.ts:234` + `usePyodide.ts:92`)

- `result`(最后表达式值)仍计算并放入工具响应,供 AI 参考。
- `usePyodide` 的用户可见 output 移除 `result` 回退:统一显示 stdout `output`;无 output 且无 image/files 时显示 `'No output'`。`result` 不再混入用户可见区。

### C5 依赖预加载(`pyodideWorkerTemplate.ts:101`)

- 保持 `loadPackagesFromImports` 按需加载,不扩大预装白名单(内存考虑)。
- `installDependencies` 的错误区分两种情况:
  - 包不在 Pyodide lock file / 不可用 → 提示"该包在浏览器 Pyodide 环境不可用"。
  - 网络/下载失败 → 提示"依赖下载失败,请重试"。
- 替代当前泛化的 `"Failed to install dependencies: ..."`。

## 测试策略

- **适配现有 25 个测试**:`pyodideService.test.ts` 中并发/单请求假设改为队列模型;`mountFiles` 两个测试随实现删除;ArrayBuffer 类型替换 base64 断言。
- **新增覆盖**:
  - 队列顺序保证(并发提交 3 个请求,按序完成)
  - WARMUP 预热后下一次请求不触发 `loadPyodide` 冷加载
  - abort 在文件准备阶段(`prepareExecutionFiles`)即生效
  - 队列中未启动请求的 abort(不 terminate worker)
  - 空闲超时回收
  - `createUploadedFileFromBytes` 单测
  - worker 错误 traceback 透传(归一化非 Error 抛出)
- worker 模板为字符串,现有做法是通过 `buildPyodideWorkerScript` + 注入依赖测试;沿用该模式。

## 影响面汇总

| 文件 | 改动 |
|------|------|
| `pyodideService.ts` | 队列、预热、abort 提前、空闲回收、dispose、删 mountFiles、ArrayBuffer 类型 |
| `pyodideWorkerTemplate.ts` | WARMUP、删 base64、basePath 修正、错误归一化、matplotlib 隔离、result、依赖错误 |
| `clientFunctionTool.ts` | 改用 `createUploadedFileFromBytes` |
| `usePyodide.ts` | ArrayBuffer 类型、移除 result 回退 |
| `CodeBlock.tsx` | createObjectURL 展示 + 托管释放 |
| `utils/chat/parsing.ts` | 新增 `createUploadedFileFromBytes` |
| `pyodideService.test.ts` / `usePyodide.test.tsx` | 适配 + 新增 |
| 接入面(`runPython` 签名、`PyodideFile`/`ExecutionResult` 概念) | 保持不变 |

## 非目标(YAGNI)

- 不做多 worker 池(单实例排队已满足)。
- 不做软中断(signal handler 中断纯 Python 循环)——C 扩展无法中断,收益有限。
- 不做 Pyodide 独立解释器/命名空间级隔离——`plt.close('all')` + rcParams 快照已覆盖常见残留。
- 不扩大预加载包白名单。
