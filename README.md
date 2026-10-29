# circuit-experiments-assistant-bot-For-End-work-

面向大学基础电路实验的混合增强智能助教机器人 · Three.js 3D 数字原型。

- **在线演示**：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- **GLB 模型目录**：[`public/models/`](public/models/)（B01–B10 零件 + `robot_assembled.glb` 整机，米制，root scale 0.001）
- **模型验证报告**：[`docs/glb_verification.json`](docs/glb_verification.json)（实际 bbox / 顶点数 / node 命名，由 GLTFLoader + Box3 读取）

## 已实现（本仓库生成物）

- Three.js 0.160 ESM + WebGL 渲染，PBR 材质，OrbitControls 相机轨道控制。
- 11 个 GLB 零件模型（B01–B10 + 整机），GLTFLoader 加载，米制单位。
- 状态机 S0–S6（理论示例 → 测量异常 → AI 拒判转教师 → 教师核验 → 学生换件 → 教师安全确认 → 学生反思）。
- 角色切换（教师/学生）+ 权限门：教师接管、教师核验勾选、学生换件、教师独立安全确认、学生反思 ≥5 字。
- 单零件隔离视图（侧栏点击部件 → 隐藏其他零件与教学环境，"恢复装配"返回）。
- 爆炸视图 slider（零件沿连接方向外扩，教学环境隐藏）。
- 模型查看 / 教学场景模式切换。
- GLB 导出按钮（整机 / 选中零件，home pose，米制，命名节点）。
- 头部 3D yaw/tilt 转动动画随状态机变化。

## 边界声明（重要，勿误读）

- 本仓库为**离线数字原型**，未接真实仪器、摄像头、麦克风、语音识别/TTS。
- 所有读数（U2/I/偏差）为内置设计示例，不判合格、不做安全联锁。
- 摄像头仅几何外观，不实际识别色环/拓扑；AI 仅内置规则与预设证据，不做真实学习分析/BKT。
- 教师保留上电确认权、价值判断、最终评分权；机器人不碰线、不控电源。
- GLB 为概念演示尺寸（mm→m），非制造 CAD/3D 打印合格依据。
- 报告（DOCX）与课程材料不在本仓库。

## 技术栈

- 原生 Three.js ESM（无构建步骤），vendor 库放 `public/vendor/`。
- GitHub Pages 从 `main` 分支根目录静态托管（legacy build）。
- 本地打开：直接 `public/index.html` 或根目录 `index.html`（自动跳转）。
