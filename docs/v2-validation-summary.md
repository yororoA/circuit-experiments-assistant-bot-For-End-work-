# V2 验收摘要（Validation Summary）

本文件记录 V2 数字原型在 GitHub Pages 线上 URL 上经独立软件渲染（headless SwiftShader）实测通过的范围，以及未覆盖的边界。结论以实测为准。

## 线上地址

- 根 URL（用户所见）：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- V2 入口：[`public/v2/index.html`](../public/v2/index.html)
- V1 旧版（历史）：[`public/index.html`](../public/index.html)

## 实测通过（最终线上 commit `52f8833` 及后续 docs commit）

### Lab engine（纯逻辑）
- `node public/v2/lab/tests/run-tests.mjs` → **22/22 passed, 0 failed**。
- 独立复核四个角色与节点门禁：教师不能 reflect / blind PG 落带非 NG not_converged / 反向 GN -3.333 closed。
- 两种教学模式：
  - 自由探索：网页改 E/R1/R2 与探针/仪表模式，先预测 U_NG 再两探针测量验证，不显示故障原因卡；引擎另含短接拓扑 fixture 测试。
  - 盲诊断：actual 隐藏，测够 U_NG+U_PG 申请教师复核，学生自输校正值，错选不收敛不能反思。

### 3D 场景（Three.js 0.160 ESM + WebGL）
- desktop 1440×900 / mobile 390×844 两视口完成 WebGL 上下文（软件 SwiftShader）。
- 11 个 GLB（B01–B10 + robot_whole）GLTFLoader 加载，米制，root wrapper scale 0.001，center 0。
- 整机 bbox 0.189×0.222×0.158 m，18752 verts，1 texture。
- 单零件隔离 / 爆炸视图 / 模型查看模式。
- **P/N/G 探针桌前可见，3D raycast click 通过**：predict → explore → canvas 点 N 球 → probe=NG；点 G → probe=PG。
- pause/resume：暂停时 measure/approve/correct/reflect/hint/predict/config 禁用，Orbit 相机可观察；暂停时点 G probe 不变，恢复后可变。
- reset：probe 复位到 P，证据/预测/审批清空。
- 屏幕/PCB 背板分离，near=1/far=1200，无 z-fighting 绿纹。
- `window.CircuitBridgeReadOnly.getSceneDiagnostics()` 只读暴露 container rect / paused / mode / probeProjected canvas coords。

### 资产下载
- `robot_whole.glb` 859276b / `B02.glb` 71548b，HTTP 200，glTF magic 合法。
- **GLTFLoader 回读下载对象 BBox 通过**：whole 0.189×0.222×0.158m，B02 0.18×0.15×0.13m，center 0，与静态 11 模型一致。

## 未覆盖 / 边界（勿误读）

- **软件 WebGL**：headless SwiftShader 验证，不等于所有 GPU/浏览器通用通过。
- **非实机硬件**：未接真实示波器/电源/万用表/摄像头/麦克风/TTS；读数为电路方程精确点示例。
- **AI/RAG/KG/LLM 未接**：参数化电路方程和确定性证据规则，不连接真实 LLM/BKT/学习分析。
- **非制造 CAD**：GLB 为概念演示尺寸，不用于 3D 打印/加工/装配合格判定。
- **教学效果未做**：未进课堂做对照实验。
- 报告 DOCX 与课程材料不在本仓库。

## 文件清单

- engine：[`public/v2/lab/`](../public/v2/lab/)（lab-engine.js / lab-contract.json v2.2.1 / fixtures / tests）
- scene：[`public/v2/scene.js`](../public/v2/scene.js)
- UI：[`public/v2/index.html`](../public/v2/index.html) / [`style.css`](../public/v2/style.css) / [`app.js`](../public/v2/app.js)
- 模型：[`public/v2/assets/glb/`](../public/v2/assets/glb/)（11 GLB）
- manifest：[`public/v2/docs/manifest.json`](../public/v2/docs/manifest.json)（v2.0.4）
