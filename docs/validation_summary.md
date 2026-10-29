# 验收摘要（Validation Summary）

本文件记录数字原型在 **GitHub Pages 线上 URL** 上经独立软件渲染（headless SwiftShader，非真实 GPU）实测通过的范围，以及仍未覆盖的边界。结论以实测为准，不做泛化声明。

## 线上地址

- URL：https://yororoa.github.io/circuit-experiments-assistant-bot-For-End-work-/
- 最近一次实测对应 commit：见仓库 `git log -1`（本文件所在提交）。

## 实测通过（独立软件 WebGL 渲染）

### 渲染与模型
- desktop 1440×900 / mobile 390×844 两视口均完成 WebGL 上下文（软件 SwiftShader）。
- 11 个 GLB（B01–B10 + robot_assembled）由 GLTFLoader 加载成功，`file`/magic number 校验为 glTF v2 binary。
- 整机 bbox 0.22 × 0.31 × 0.188 m，root scale 0.001（mm→m），零件 center 在原点，home pose 无爆炸 offset。
- 节点命名：组节点 `Bxx_中文名`，mesh `Bxx_mesh`。
- 单零件隔离（点部件 → 其他零件与教学环境隐藏，"恢复装配"返回）。
- 爆炸视图 slider：零件沿连接方向外扩，B01 不再掉桌下。
- GLB 下载按钮：`robot_assembled.glb` 38040 bytes / `B02.glb` 9708 bytes，magic 与服务器一致。

### 状态机与权限门
- S0 理论示例 → S1 测量异常 → S2 AI 拒判转教师 → S3 教师核验勾选 → S4 学生换件 → S5 教师安全确认 → S6 学生反思（≥5 字）归档。
- 自动演示（btnPlay）从 S0 走完整条链到 S6 reflectionDone。
- 回退/重置按钮清除勾选与反思。
- 角色切换（教师/学生）后下一步按钮权限门生效。
- `getDiagnostics()` 返回 `THREE.REVISION === "160"`、renderer triangles 计数、visibleParts 列表。

### 响应式
- mobile 390px：`@media (max-width:760px)` 触发，canvas 45vh + sidebar 堆叠，`getBoundingClientRect` + `ResizeObserver` + `setTimeout(300)` 延迟 re-init 后 canvas 非零尺寸（390×379）。
- desktop 1120×900 无回归。

## 未覆盖 / 边界（勿误读）

- **软件 WebGL**：上述验证在 headless SwiftShader 软件渲染下完成，不等于真实 GPU/移动端/所有浏览器组合都通过。
- **非实机硬件**：未接真实示波器/电源/万用表/摄像头/麦克风；读数与偏差为内置示例。
- **AI/RAG/KG/LLM 未接**：状态机与规则为确定性脚本，不做真实学习分析/BKT。
- **非制造 CAD**：GLB 为概念演示尺寸，不用于 3D 打印/加工/装配合格判定。
- **报告 DOCX 与课程材料不在本仓库**。
- 独立验证代理按本 commit 之后的最新 URL 复跑即可；本文件之前的 commit 历史见 `git log`。
