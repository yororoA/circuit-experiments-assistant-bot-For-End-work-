# V3 验收摘要

本文件记录 V3 数字原型在 GitHub Pages 线上 URL 上经独立软件渲染（headless SwiftShader）实测通过的范围，以及未覆盖的边界。结论以实测为准。

## 线上地址

- 根 URL（用户所见）：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- V3 入口：[`public/v3/index.html`](../public/v3/index.html)
- V2 历史：[`public/v2/index.html`](../public/v2/index.html)
- V1 历史：[`public/index.html`](../public/index.html)

## 实测通过

### Lab engine（纯逻辑）
- `node public/v3/lab/test.js` → **14/14 passed**。
- 覆盖：NG/PG/current 区分、fake claim 拒绝、500/1000Ω 比例任务、12V 错误预测反馈、observation unknown 阻塞、restore nominal 与 ratio current config 的预测参考。

### 3D 场景（Three.js r160 ESM + WebGL）
- 桌面 1440×900 视口 canvas 861×360；移动 390×844 视口 canvas 356×360，WebGL2 真实上下文（软件 SwiftShader）。
- 12 个 GLB（B01–B11 + bridge_whole）GLTFLoader 加载，米制，center 0。
- 整机 bbox 371.5×287×209.5mm；镜头 home (0, 235, 0)mm，板中心 (0, 8, -10)mm；HFOV60/VFOV45 半 footprint 131.05×94.08mm。
- 单零件隔离 / 爆炸视图 / 模型查看 / FOV 锥 / GLB 导出（Blob 下载）。
- 3D 端子 raycast ↔ 原理图 SVG 双向同步；390px 触摸目标可达。
- LED 状态：initial 灰 / predict & NG 琥珀 / PG 绿 / claim 青 / intervention 蓝 / review 绿。
- pause/resume：暂停时禁实验编辑，Orbit 相机可观察。
- 动态下载 `bridge_whole.glb` 853956b 与静态 loader bbox 逐字节一致；`B05.glb` 下载回读通过。

### UI 教学流
- 自由探索：预测错误（如 12V）收到物理边界反馈，预测留历史须修正。
- 盲诊断：actual 隐藏，测够 U_NG+U_PG 申请教师复核。
- 教师干预：confusionClass 改变学生可见引导，学生响应记录。
- 教师 review：classification 改变 LED 为 green，学生可修正重交。
- 390px scrollWidth=clientWidth=390，无横向溢出。

## 未覆盖 / 边界

- **软件 WebGL**：headless SwiftShader 验证，不等于所有 GPU/浏览器通用通过。
- **非实机硬件**：未接真实示波器/电源/万用表/摄像头/麦克风/TTS。
- **AI/LLM/RAG/KG 未接**：参数化电路方程与确定性证据规则，不做真实学习分析/BKT/语义自动打分。
- **非制造 CAD**：GLB 为概念演示尺寸，不用于 3D 打印/加工/装配合格判定。
- **观察桥增量待证**：相对平板视图的优劣是研究问题，本原型不证明机器人必要或更优。
- **教学效果未做**：未进课堂做对照实验。
- 报告 DOCX 与课程材料不在本仓库。
