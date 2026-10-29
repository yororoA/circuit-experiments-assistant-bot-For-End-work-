# V2 lab-engine（纯逻辑核心）

单电源串联分压可操作教学模拟。无后端 / 无 ML / 无 CDN / 无随机数；读数 = 确定电路方程精确点。

## 文件
- `lab-engine.js` — ES module；公开 API 以 `lab-contract.json` 为准
- `lab-contract.json` — 权威接口合同（UI/report/Three scene update 只认此）
- `fixtures/scenarios.mjs` — 场景 + 候选假设空间（候选自带 topology；groundTruth 仅测试）
- `tests/run-tests.mjs` — `node tests/run-tests.mjs` → 18/18 PASS

## 教学机制
1. 学生先 commit 预测 U2（否则门禁）；两探针选 P/N/G 测 DC。
2. 读数是**精确点**（理想 DC + 固定电阻）；R1/R2 ±5% 只是候选假设的**理论允许带**，不冒称仪表精度。
3. 证据点落在候选允许带内 → open；不覆盖 → excluded（证据卡给出对照）。
4. 自由探索可 `setConfiguration` 主动改 E/R/topology；盲诊断学生不能碰 actual，须测够 NG+PG 申请复核。
5. 教师批准后学生 `applyCorrection({E?,R1?,R2?})` **自己输数值**，输错得错读数，不自动填正确。
6. 任何电路变更/校正 → 旧证据/预测/审批全部作废，重新 commit。

## 数值反例
- 基准 E=5/R1=1k/R2=2k → U_NG=3.3333V 精确点；I=1.6667mA。
- 歧义孪生 U_NG=2.50V：(a) R2 错装 1kΩ；(b) E 实际 3.75V。单点不可区分；补测 U_PG：5.00V vs 3.75V 精确点分开。

## 语义边界
- 未探针：不出读数不写证据；同节点：物理显示 0 但 usable=false 不诊断；AC 测 DC 可解释读 0 不诊断。
- 门禁单一来源：permittedActions 与 handler 共用谓词；学生不能批准、教师不能替学生 apply。
- 复审硬门槛：≥2 条 usable DC 证据覆盖 U_NG+U_PG。
- reset 复原初始电路 + 清全部状态；fixtures 深拷贝防外部 mutation。
