# ER 2 迁移 · 部署验证 Checklist

Gemini Robotics ER 1.6 已于 2026-08-31 停服；本项目已迁移到
`gemini-robotics-er-2-preview`（唯一模型常量：`ROBOTICS_MODEL`，见
`src/constants/modelConfiguration.ts`）。本清单用于上线 ER 2 前后的验证。

## 前置条件

- [ ] `GEMINI_API_KEY` 已在 [AI Studio](https://aistudio.google.com/api-keys) 添加 API 限制
      （无限制 Key 对 Robotics 模型返回 `403 Forbidden`）。
- [ ] `node_modules` 已安装 `@google/genai@^1.50.1`（支持 `interactions.create` 与
      `thinking_level`；无需再升级）。
- [ ] 全量测试通过：`npx vitest run`（当前基线：363 文件 / 2057 测试全绿）。
- [ ] 全局搜索确认零残留：`grep -rinE "er-1\.6|er 1\.6|robotics-1\.6|robotics-er-1"` 无结果。

## 阶段 A · Staging 验证

1. **跑冒烟脚本**（连真实 API，在 staging 环境或本地执行）：

   ```bash
   GEMINI_API_KEY=<受限key> node scripts/smoke_robotics.mjs
   ```

   - 期望：退出码 0；每项 `point=[y,x]`（0–1000 整数）与非空 `label`。
   - 若自建端点/代理：`GEMINI_API_BASE=<endpoint>` 同命令验证代理链路
     （注意：interactions 端点由 SDK 走 `POST /v1beta/interactions`，代理需支持该路径）。

2. **观察指标**（连续 ≥10 次调用或 ≥30 分钟）：
   - 错误率：`5xx / 403 / 429` 计数。
   - 平均延迟与 P95；高分辨率输入或 `thinking_level: high` 会显著增加延迟（官方限制说明）。
   - 输出一致性：同一输入多次查询的 point 方差（官方建议取平均做高精度任务）。
3. **功能回归**：验证应用内 Robotics 模型可用——模型选择、生成、思考配置
   （`thinking_level` 默认 medium，UI 高精度任务保留 high）。

## 阶段 B · 生产验证

1. 确认 UI 显示模型名为 "Gemini Robotics-ER 2"（`modelRegistry.ts`），无 1.6 字样。
2. 上线后观察同一组指标（错误率 / 403/429 / 平均延迟），与 staging 对比应无异常升高。
3. 若出现空间定位精度回退：
   - 先对同一输入多次查询取平均（官方建议的一致性做法）；
   - 再评估是否对高精度调用点调高 `thinking_level: high`；
   - 最后检查输入图像质量（裁剪/放大目标物体、改善对比度）。

## 回滚说明

- 停服前（原 1.6 已停服，此窗口已关闭）：将 `ROBOTICS_MODEL` 改回旧模型名即可。
- 停服后：不可回退到 1.6；唯一出路是继续使用 ER 2 并调整调用参数（见阶段 B-3）。
