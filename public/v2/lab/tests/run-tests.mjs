// tests/run-tests.mjs —— node 自运行，无第三方依赖，无随机数据。
// 运行：node tests/run-tests.mjs
import assert from 'node:assert';
import { createLab } from '../lab-engine.js';
import { SCENARIOS } from '../fixtures/scenarios.mjs';

let pass = 0, fail = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const openIds = (snap) => snap.candidates.filter(c => c.status === 'open').map(c => c.id);

// ---------- A. 自由探索：主动输入与电路方程 ----------
test('A1 setConfiguration 校验：NaN/负值/E>12 拒绝', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  assert.equal(lab.setConfiguration({ E: NaN }).error.code, 'invalid_config');
  assert.equal(lab.setConfiguration({ R1: -500 }).error.code, 'invalid_config');
  assert.equal(lab.setConfiguration({ E: 15 }).error.code, 'invalid_config');
  assert.equal(lab.setConfiguration({ topology: 'hacked' }).error.code, 'invalid_config');
});

test('A2 setConfiguration 改 E 后读数重算且旧证据作废', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3.3 });
  lab.setProbes({ a: 'N', b: 'G' });
  lab.measure();
  assert.equal(lab.getSnapshot().visibleEvidence.length, 1);
  lab.setConfiguration({ E: 9 });
  const s = lab.getSnapshot();
  assert.equal(s.visibleEvidence.length, 0, '改电路必须作废旧证据');
  assert.equal(s.prediction.submitted, false, '改电路必须作废旧预测');
  assert.equal(s.phase, 'predict');
  lab.predict({ u2: 6 });
  lab.setProbes({ a: 'N', b: 'G' });
  const r = lab.measure();
  assert(approx(r.snapshot.lastMeasurement.value, 9 * 2000 / 3000), `value=${r.snapshot.lastMeasurement.value}`);
});

test('A3 改阻值/上下交换：U_NG = E·R2/(R1+R2) 精确点', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.setConfiguration({ R1: 500, R2: 1500 });
  lab.predict({ u2: 3.75 });
  lab.setProbes({ a: 'N', b: 'G' });
  const v = lab.measure().snapshot.lastMeasurement.value;
  assert(approx(v, 5 * 1500 / 2000), `v=${v}`);
});

test('A4 探针反向符号：U_NP = -U_PN；I 派生 mA', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3.3 });
  lab.setProbes({ a: 'P', b: 'N' });
  const upn = lab.measure().snapshot.lastMeasurement.value;
  lab.setProbes({ a: 'N', b: 'P' });
  const unp = lab.measure().snapshot.lastMeasurement.value;
  assert(approx(upn, 5 * 1000 / 3000));
  assert(approx(unp, -upn));
  assert(approx(lab.getSnapshot().derived.I_mA, 5 / 3000 * 1000), 'I=E/(R1+R2)=1.6667mA');
});

test('A5 同节点：物理显示 0 但 usable=false，不参与诊断', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3 });
  lab.setProbes({ a: 'N', b: 'N' });
  const r = lab.measure();
  assert.equal(r.snapshot.lastMeasurement.value, 0);
  assert.equal(r.snapshot.lastMeasurement.usable, false);
  assert.equal(r.snapshot.lastMeasurement.reason, 'same_node_pair');
});

test('A6 未设探针不出读数不写证据；AC 测 DC 可解释读 0', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3 });
  assert.equal(lab.measure().error.code, 'probes_not_set');
  assert.equal(lab.getSnapshot().visibleEvidence.length, 0);
  lab.setProbes({ a: 'N', b: 'G', mode: 'AC' });
  const r = lab.measure();
  assert.equal(r.snapshot.lastMeasurement.value, 0);
  assert.equal(r.snapshot.lastMeasurement.usable, false);
  assert.equal(r.snapshot.lastMeasurement.reason, 'AC_mode_on_DC_circuit');
});

// ---------- B. 容差只是候选允许带 ----------
test('B1 实测是精确点；候选预测才是 ±5% 允许带', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3.333 });
  lab.setProbes({ a: 'N', b: 'G' });
  const snap = lab.measure().snapshot;
  const ev = snap.visibleEvidence[0];
  assert(approx(ev.value, 3.333333333));
  assert.equal(ev.value, ev.lo);
  assert.equal(ev.lo, ev.hi, '实测不显示区间，只有一个精确点');
});

// ---------- C. 盲诊断：歧义与补测区分 ----------
test('C1 U_NG 单点两候选同时 open，H_correct 被排除', () => {
  for (const id of ['divider-ambiguity-wrongR2', 'divider-ambiguity-source']) {
    const lab = createLab({ scenario: SCENARIOS[id], role: 'student' });
    lab.predict({ u2: 2.5 });
    lab.setProbes({ a: 'N', b: 'G' });
    const r = lab.measure();
    assert(approx(r.snapshot.lastMeasurement.value, 2.5), `${id} value=${r.snapshot.lastMeasurement.value}`);
    assert.deepEqual(openIds(r.snapshot).sort(), ['H_sourceDrift', 'H_wrongR2'], id);
  }
});

test('C2 补测 U_PG 排除错误候选（5.0 vs 3.75 精确点）', () => {
  const l1 = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  l1.predict({ u2: 2.5 });
  l1.setProbes({ a: 'N', b: 'G' }); l1.measure();
  l1.setProbes({ a: 'P', b: 'G' });
  const r1 = l1.measure();
  assert(approx(r1.snapshot.lastMeasurement.value, 5.0));
  assert.deepEqual(openIds(r1.snapshot), ['H_wrongR2']);

  const l2 = createLab({ scenario: SCENARIOS['divider-ambiguity-source'], role: 'student' });
  l2.predict({ u2: 2.5 });
  l2.setProbes({ a: 'N', b: 'G' }); l2.measure();
  l2.setProbes({ a: 'P', b: 'G' });
  const r2 = l2.measure();
  assert(approx(r2.snapshot.lastMeasurement.value, 3.75));
  assert.deepEqual(openIds(r2.snapshot), ['H_sourceDrift']);
});

test('C3 blind 不泄露 actual：config=setup，fixtureView=null，derived=null', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  assert.equal(lab.getSnapshot().fixtureView, null);
  assert.equal(lab.getSnapshot().config.R2, 2000, '学生看到的是标称 2k');
  assert.equal(lab.getSnapshot().derived, null, '校正前不暴露真实 I');
});

// ---------- D. 门禁 ----------
test('D1 预测前/复审态/关闭态不能 measure；setProbes 不能在 predict 态', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  assert.equal(lab.measure().error.code, 'wrong_phase');
  assert.equal(lab.setProbes({ a: 'N', b: 'G' }).error.code, 'wrong_phase');
  lab.predict({ u2: 3 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  assert.equal(lab.measure().error.code, 'wrong_phase', 'reviewRequested 态不能再测');
});

test('D2 复审需 ≥2 条有效 DC 覆盖 NG+PG；学生不能批准，教师不能替学生 apply', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  assert.equal(lab.requestTeacherReview().error.code, 'insufficient_evidence', '只有 NG 不能申请');
  // AC/同节点不算有效证据
  lab.setProbes({ a: 'P', b: 'G', mode: 'AC' }); lab.measure();
  assert.equal(lab.requestTeacherReview().error.code, 'insufficient_evidence');
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  assert.equal(lab.requestTeacherReview().ok, true);
  // 学生不能批准
  assert.equal(lab.approveCorrection().error.code, 'forbidden_student');
  // 教师不能替学生 apply
  lab.setRole({ role: 'teacher' });
  lab.approveCorrection();
  assert.equal(lab.applyCorrection({ R2: 2000 }).error.code, 'not_approved_or_not_student');
  lab.setRole({ role: 'student' });
});

// ---------- E. 校正：学生主动输入，错选择得错读数 ----------
test('E1 错选择校正不收敛；好选择收敛到 H_correct', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  // 学生输错：仍填 R2=1000
  lab.applyCorrection({ R2: 1000 });
  assert.equal(lab.getSnapshot().phase, 'predict');
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' });
  const wrong = lab.measure();
  assert(approx(wrong.snapshot.lastMeasurement.value, 2.5), '错选择读数仍异常');
  // 旧 PG 证据已随校正作废，只剩 NG → 两个错误候选仍并存，未收敛
  assert.deepEqual(openIds(wrong.snapshot).sort(), ['H_sourceDrift', 'H_wrongR2']);
  // 重新走流程（reset 后）做正确选择
  lab.reset();
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  lab.applyCorrection({ R2: 2000 });
  lab.predict({ u2: 3.33 });
  lab.setProbes({ a: 'N', b: 'G' });
  const good = lab.measure();
  assert(approx(good.snapshot.lastMeasurement.value, 3.3333333), `good=${good.snapshot.lastMeasurement.value}`);
  assert.deepEqual(openIds(good.snapshot), ['H_correct']);
  assert(approx(good.snapshot.derived.I_mA, 1.6666667), '校正后暴露真实 I');
  // 校正后旧证据已存档标记 invalidated，供 UI 解释，不参与诊断
  assert.equal(good.snapshot.invalidatedEvidence.length > 0, true, '应保留被作废证据历史');
  assert.equal(good.snapshot.invalidatedEvidence[0].usable, false);
});

test('E3 收敛门禁：错选未修好不能反思完成；修好落回标称带才可', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  // 错选 R2=1000，复测仍 2.5
  lab.applyCorrection({ R2: 1000 });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  const no = lab.reflect({ text: '我认为修好了' });
  assert.equal(no.error.code, 'not_converged', `错选不能 finish: ${no.error && no.error.code}`);
  assert.equal(lab.getSnapshot().phase, 'exploration', '不收敛则实验继续');
  // 重新补测 PG + 复核 + 正确校正
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  lab.applyCorrection({ R2: 2000 });
  lab.predict({ u2: 3.33 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  const yes = lab.reflect({ text: '复测 3.33V 落回标称带，R2 已换对' });
  assert.equal(yes.ok, true);
  assert.equal(yes.snapshot.phase, 'closed');
});

test('E2 校正后旧证据/旧预测作废，不复用', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-source'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  lab.applyCorrection({ E: 5 });
  const s = lab.getSnapshot();
  assert.equal(s.visibleEvidence.length, 0);
  assert.equal(s.prediction.submitted, false);
  assert.equal(lab.measure().error.code, 'wrong_phase', 'predict 态测量被门禁');
});

// ---------- F. 反思 / 重置 ----------
test('F1 反思须探索态且有有效测量；<5 字拒', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.predict({ u2: 3 });
  assert.equal(lab.reflect({ text: '短' }).error.code, 'wrong_phase', '无测量不能反思');
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  assert.equal(lab.reflect({ text: '短' }).error.code, 'reflection_too_short');
  assert.equal(lab.reflect({ text: '实测与预测吻合' }).snapshot.phase, 'closed');
});

test('F2 reset 完全复原电路与状态', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'student' });
  lab.setConfiguration({ E: 9, R1: 500 });
  lab.predict({ u2: 6 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.reset();
  const s = lab.getSnapshot();
  assert.equal(s.phase, 'predict');
  assert.equal(s.config.E, 5, 'reset 复原初始 E');
  assert.equal(s.config.R1, 1000, 'reset 复原初始 R1');
  assert.equal(s.visibleEvidence.length, 0);
  assert.equal(s.probes, null);
  assert.equal(s.prediction.submitted, false);
});

// ---------- G. 提示不泄露 / 短接拓扑闭候选 ----------
test('G1 提示三级递进且不点 groundTruth', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-source'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  const h1 = lab.requestHint().snapshot.hint;
  assert.equal(h1.level, 1);
  assert(/U[_]?PG/.test(h1.text), `h1=${h1.text}`);
  const h2 = lab.requestHint().snapshot.hint;
  assert.equal(h2.level, 2);
  assert(/U[_]?PG/.test(h2.text), `h2=${h2.text}`);
  const h3 = lab.requestHint().snapshot.hint;
  assert.equal(h3.level, 3);
  assert(!h3.text.includes('H_sourceDrift'), '教师解释不点 groundTruth');
});

test('G2 短接 R2 拓扑：实测 0 排除串联候选，闭合短接候选', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-shorted-r2'], role: 'student' });
  lab.predict({ u2: 0 });
  lab.setProbes({ a: 'N', b: 'G' });
  const r = lab.measure();
  assert(approx(r.snapshot.lastMeasurement.value, 0));
  assert.deepEqual(openIds(r.snapshot), ['H_shortedR2']);
});

// ---------- H. v2.2.1 P0 聚焦：role 门禁 / NG 节点硬判 / 反向归一 ----------
test('H1 教师不能代学生 reflect（即使已有探索测量）', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-normal'], role: 'teacher' });
  lab.predict({ u2: 3.3 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  assert.equal(lab.getSnapshot().phase, 'exploration', '确认处于探索态而非闭锁');
  assert.equal(lab.reflect({ text: '我代学生总结' }).error.code, 'forbidden_student');
});

test('H2 blind：PG=3.333 落标称带但不是 N-G，必须 not_converged', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  // 学生错选：把 E 改成 3.333（PG=3.333 恰好落标称带，但 NG 变成 1.666）
  lab.applyCorrection({ E: 3.333 });
  lab.predict({ u2: 1.66 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  assert(approx(lab.getSnapshot().lastMeasurement.value, 3.333)); // PG 在带内
  const r = lab.reflect({ text: '看起来好了' });
  assert.equal(r.error.code, 'not_converged', `PG 落带但非 NG 不能 finish: ${r.error && r.error.code}`);
});

test('H3 反向 G-N 读数取绝对值归一：修好后 -3.333 也能完成反思', () => {
  const lab = createLab({ scenario: SCENARIOS['divider-ambiguity-wrongR2'], role: 'student' });
  lab.predict({ u2: 2.5 });
  lab.setProbes({ a: 'N', b: 'G' }); lab.measure();
  lab.setProbes({ a: 'P', b: 'G' }); lab.measure();
  lab.requestTeacherReview();
  lab.setRole({ role: 'teacher' }); lab.approveCorrection();
  lab.setRole({ role: 'student' });
  lab.applyCorrection({ R2: 2000 });
  lab.predict({ u2: 3.33 });
  lab.setProbes({ a: 'G', b: 'N' });   // 反向探针
  const m = lab.measure();
  assert(approx(m.snapshot.lastMeasurement.value, -3.3333333), `反向读数=${m.snapshot.lastMeasurement.value}`);
  const r = lab.reflect({ text: 'G-N=-3.33V 取绝对值后落回标称带' });
  assert.equal(r.ok, true);
  assert.equal(r.snapshot.phase, 'closed');
});

// ---------- runner ----------
for (const [name, fn] of cases) {
  try { fn(); pass++; console.log(`PASS  ${name}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
console.log(`\n==== ${pass}/${cases.length} passed, ${fail} failed ====`);
process.exit(fail === 0 ? 0 : 1);
