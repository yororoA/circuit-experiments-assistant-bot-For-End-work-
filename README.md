# CircuitBridge · 循证观察桥

面向大学入门 DC 串联分压实验的数字概念原型。把电路原理图、仿真面包板、测量读数与显式因果主张链接起来，让学生在"预测—测量—比较—提交证据—教师反馈"的闭环中学习电路推理。

- **在线演示（V3）**：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- 设计契约：[`docs/v3-design-contract.md`](docs/v3-design-contract.md)
- 验收摘要：[`docs/v3-validation-summary.md`](docs/v3-validation-summary.md)

## 两类任务

1. **restore_nominal（恢复标称）**：诊断指定故障并恢复 E=5V、R1=1kΩ、R2=2kΩ 与正确串联拓扑。只恢复输出电压，不等于恢复标称配置。
2. **ratio_design（比例设计）**：达成 k=U2/E=2/3，须比较基线与方案的总电流、总功率，并说明相同分压比的等效限度。相同电压比不等于全电路等效；限值由学生报告、教师评判。

## 教学边界（重要）

- **证据 vs 理解硬边界**：引擎只校验结构化数值/关系证据；自由文本不自动判"掌握"。教师判断因果解释、概念混淆与迁移。
- **教师教育调节**：教师面板暴露错误概念证据，应用分类会改变学生可见引导与后续响应路径；不是机械审批每次测量。
- **观察桥增量待证**：机器人镜头提供空间定位与观察不确定性的假设机制；相对平板视图的优劣是研究问题，本原型不证明机器人必要或更优。
- **软件 WebGL 验证**：headless SwiftShader 软件渲染验证，不等于所有 GPU/浏览器通用通过。
- **未接真实硬件/AI**：无摄像头识别、无 LLM 语义评分、无设备供电控制、无 TTS、无真实学习效果实验。

## 目录结构

- `public/v3/` — V3 数字原型入口
  - `index.html` / `style.css` / `app.js` — 学生工作台与教师面板
  - `scene.js` — Three.js r160 观察桥场景
  - `lab/lab-engine.js` — 确定性证据引擎（14 node tests）
  - `assets/glb/` — 11 个部件 + 1 个整机共 12 个中性米制 GLB 文件
  - `docs/manifest.json` — 零件清单与几何实测
- `public/v2/` — V2 历史版本（保留）
- `public/index.html` — V1 历史样机（保留）
