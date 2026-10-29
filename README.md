# circuit-experiments-assistant-bot-For-End-work-

面向大学基础电路实验（单电源串联分压/桥式）的混合增强智能助教机器人 · Three.js 3D 数字原型 V2。

- **在线演示（V2）**：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- **V2 入口**：[`public/v2/index.html`](public/v2/index.html)
- **V2 lab engine**：[`public/v2/lab/`](public/v2/lab/)（纯逻辑核心，22 node tests）
- **V2 模型目录**：[`public/v2/assets/glb/`](public/v2/assets/glb/)（B01–B10 + `robot_whole.glb`，米制，root scale 0.001）
- **模型 manifest**：[`public/v2/docs/manifest.json`](public/v2/docs/manifest.json)（v2.0.4，实际 bbox / 顶点数 / sha256）
- **V1 旧版（历史）**：[`public/index.html`](public/index.html)

## V2 已实现（本仓库生成物）

- Three.js 0.160 ESM + WebGL（软件 SwiftShader 已验证），PBR 材质，OrbitControls 相机轨道控制。
- 11 个 GLB 零件模型（B01–B10 + 整机），GLTFLoader 加载，米制单位，root wrapper scale 0.001。
- lab engine v2.2.1：纯逻辑核心，精确点读数，候选 ±5% 允许带，22 node tests 全过。
- 两种教学 tab：
  - **自由探索**：学生改 E/R/topology，先预测 U_NG 再两探针测量验证（不显示故障原因卡）。
  - **盲诊断（challenge）**：actual 隐藏，学生测够 U_NG+U_PG 申请教师复核，批准后学生自输校正值，错选不收敛不能反思。
- 角色切换（教师/学生）+ 权限门：教师复核批准、学生 applyCorrection、教师不能代学生 reflect。
- 单零件隔离 / 爆炸视图 / 模型查看模式。
- GLB 导出按钮（选中零件，home pose，米制）。
- 屏幕/PCB 背板分离，near=1/far=1200 深度精度（无 z-fighting 绿纹）。

## 边界声明（重要，勿误读）

- 本仓库为**离线数字原型**，未接真实仪器、摄像头、麦克风、语音识别/TTS。
- 所有读数为电路方程精确点示例，不判合格、不做硬件安全联锁/PLC 切断。
- 摄像头仅几何外观，不实际识别色环/拓扑；AI 仅规则引擎，不做真实学习分析/BKT/RAG。
- 教师保留目标设定、上电授权、最终评分权；机器人不碰线、不控电源。
- GLB 为概念演示尺寸，非制造 CAD/3D 打印合格依据。
- 软件 WebGL 验证不等于所有 GPU/浏览器通用通过。
- 报告（DOCX）与课程材料不在本仓库。

## 技术栈

- 原生 Three.js ESM（无构建步骤），vendor 库放 `public/vendor/`（r160 官方对齐）。
- lab engine 为 native ES module，node 可跑 tests（`node public/v2/lab/tests/run-tests.mjs`）。
- GitHub Pages 从 `main` 分支根目录静态托管。
