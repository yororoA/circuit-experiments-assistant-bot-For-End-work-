# V2 设计契约（Design Contract）

本文件冻结 V2 阶段的产品目标、角色分工、权威字段与边界。后续 engine / 模型 / 页面 / 报告模块均按此契约对齐；任何字段新增或语义变更需回到本文件更新并 commit。

## 产品目标

面向大学基础电路实验（桥式整流/分压/测量类）的混合增强智能助教机器人数字原型 V2。V1 方块样机与"下一步即授权"流程被否决，V2 重做为：

- **学生双手真实操作**（数字几何层面），机器人不替学生动手。
- **AI 做分析推理与证据组织**，不做合格判定。
- **教师保留目标设定、上电授权、安全确认、最终评分权**。
- **关键歧义点必须补测/转教师**，不允许单读数自动下结论。

## 角色与状态（V2）

| 角色 | 权限 | 不做 |
|---|---|---|
| 教师 | 定实验目标、上电/断电授权、安全确认、最终评分、拒判接收 | 不替学生接线、不替学生读数 |
| 学生 | 接线、换件、读数、补测请求、反思输入 | 不能自行上电、不能跳过安全门 |
| AI（规则/证据层） | 组织证据、计算偏差、标记歧义、建议补测项 | 不下合格判定、不授权上电、不控硬件 |
| 环境/仪器 | 数字读数显示、安全状态可视化 | 不接真实仪器串口 |

## 核心教学案例：2.50V 歧义

- 理论 U2=3.333V（R1=1kΩ, R2=2kΩ 分压示例）。
- 学生实测 U2=2.50V，偏差 -25%。
- **单点 2.50V 歧义**：可能是 (a) 元件阻值错、(b) 接线接触不良、(c) 仪器内阻影响、(d) 学生读数误差。
- AI 不得直接判"元件错"或"通过"，必须：
  1. 列出 2–3 个候选假设；
  2. 建议补测项（如换量程、复测、断电后通断检查）；
  3. 补测后仍不一致 → 转教师裁决。

## 权威字段（lab engine JSON schema）

engine 输出必须包含以下字段，页面与报告只消费这些字段，不另造事实：

- `case_id`：教学案例 ID（如 "bridge_rectifier_v1"）
- `theoretical`：{ `u2_v`, `i_ma`, `r1_ohm`, `r2_ohm` }
- `observed`：{ `u2_v`, `i_ma`, `source` }  // source: "student_measure" | "simulated"
- `deviation`：{ `u2_pct` }
- `ambiguity`：{ `is_ambiguous`, `candidates[]`, `suggested_tests[]` }
- `ruling`：{ `status`: "pending" | "teacher_decided" | "ai_rejected", `by`: "teacher" | "ai" | "none", `note` }
- `safety`：{ `power_on`, `student_hands_free`, `last_checked_by` }
- `reflection`：{ `text`, `min_length`: 5, `archived` }

## 边界声明（V2 不变）

- 数字原型，未接真实仪器/摄像头/麦克风/TTS。
- 读数与偏差为内置示例，不做硬件限流/PLC 切断。
- GLB 为概念演示，非制造 CAD。
- 报告 DOCX 与课程材料不入库。

## 路径约定

- V2 入口：`public/v2/index.html`（V1 根 `public/index.html` 暂不切，并行可访问）
- V2 engine：`public/v2/lab/`（native ES module + JSON fixture + node tests）
- V2 模型：来自 RUlO agent artifact，复制到 `public/v2/models/`
- V2 vendor：复用 `public/vendor/three.module.min.js`（r160）

## V2.2 engine 实际接口（以 `public/v2/lab/lab-contract.json` 为权威）

本契约的字段表是高层产品视角；engine 实际 snapshot/API 以 `public/v2/lab/lab-contract.json`（v2.2.0）为准。关键差异/补充：

- 单位：电压 V、电流 **mA**、电阻 Ω。
- 读数为电路方程**精确点**；R1/R2 ±5% 仅作用于候选假设的理论允许带，不冒充仪表精度。
- snapshot 含 `phase`（predict/exploration/reviewRequested/closed）、`mode`（exploration/blind）、`prediction`、`probes`、`config`、`derived.I_mA`、`visibleEvidence[]`、`lastMeasurement`、`candidates[]`（带 open/excluded）、`hint`、`permittedActions`。
- 电路变更/校正后旧证据/预测/审批自动 `invalidated`（v2.2 新增），不与旧证据复用。
- blind 模式下 `fixtureView=null`、`derived=null`，不泄露 hidden actual。
- 反思门：phase=exploration 且存在 usable 测量且已收敛到正确候选；教师角色不能 reflect。
- reset：复原初始电路 actual 并清预测/探针/证据/审批/反思/日志。
- 测试：`node public/v2/lab/tests/run-tests.mjs` → 19/19 PASS；独立 Ru22 复核 5 个 focused gate（未 correct 拒反思、错校正复测拒、正确校正收敛 closed、教师不能 reflect、reset 复原）通过。

## Commit 阶段

1. `docs: v2 design contract`（本文件）
2. `feat: v2 lab engine v2.2 + fixtures + 19 node tests`
3. `feat: v2 product page integrating engine + scene + models`
4. `docs: v2 validation summary`（核心验证后）
