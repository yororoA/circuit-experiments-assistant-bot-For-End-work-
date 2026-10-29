// lab-engine.js
// V2 单电源串联分压教学模拟 —— 纯逻辑核心，无 I/O、无随机、无后端、无鉴权。
// 读数 = 确定电路方程的精确点值；R1/R2 ±5% 只是候选假设的理论允许带，不是仪表精度。
// faultGroundTruth 仅存于 fixtures，snapshot 永不暴露。

export const UNITS = Object.freeze({ voltage: 'V', current: 'mA', resistance: 'Ω' });
export const TOLERANCE = 0.05;                 // 仅作用于候选预测允许带
export const EPS = 1e-9;
export const NODES = Object.freeze({ P: '电源+', N: '中点', G: '地' });
export const METER_MODES = Object.freeze(['DC', 'AC']);

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- 电路方程（精确点） ----------
function nodeV(node, cfg) {
  if (node === 'P') return cfg.E;
  if (node === 'G') return 0;
  if (cfg.topology === 'shortedR2') return 0;   // N 短接到 G
  return cfg.E * cfg.R2 / (cfg.R1 + cfg.R2);
}

// 候选预测：E 精确，R1/R2 ±5% 允许带
function predInterval(a, b, cand) {
  const p = cand.params;
  const topo = cand.topology || 'series';
  const r1min = p.R1 * (1 - TOLERANCE), r1max = p.R1 * (1 + TOLERANCE);
  const r2min = p.R2 * (1 - TOLERANCE), r2max = p.R2 * (1 + TOLERANCE);
  const vN = (r1, r2) => (topo === 'shortedR2' ? 0 : p.E * r2 / (r1 + r2));
  const vLo = (node) => (node === 'P' ? p.E : node === 'G' ? 0 : vN(r1max, r2min));
  const vHi = (node) => (node === 'P' ? p.E : node === 'G' ? 0 : vN(r1min, r2max));
  return { lo: vLo(a) - vHi(b), hi: vHi(a) - vLo(b) };
}

const covers = (iv, m) => iv.lo - EPS <= m && m <= iv.hi + EPS;

// ---------- lab 工厂 ----------
export function createLab({ scenario, role = 'student' } = {}) {
  if (!scenario) throw new Error('createLab: scenario required');
  if (!['teacher', 'student'].includes(role)) throw new Error('createLab: role must be teacher|student');

  const mode = scenario.mode;                    // 'exploration' | 'blind'
  const base = clone(scenario);                  // 全量深拷贝：setup/candidates 不受外部 mutation
  const initialActual = clone(base.actual);      // 电路初始态深拷贝
  let actual = clone(initialActual);

  const fresh = () => ({
    phase: 'predict',                            // predict -> exploration -> reviewRequested -> (correctionApplied:)predict -> closed
    prediction: null,
    probes: null,
    evidence: [],
    cleared: [],                                  // 被作废证据的历史存档（UI 解释“为何重新预测”，不参与诊断）
    hintLevel: 0,
    reviewRequested: false,
    correctionApproved: false,
    correctionApplied: false,
    reflection: null,
  });
  let st = fresh();
  let log = [];

  // ---------- 门禁（permittedActions 与 handler 共用同一组谓词，杜绝两处漂移） ----------
  const hasUsable = () => st.evidence.some((e) => e.usable);
  const canPredict = () => st.phase === 'predict';
  const canSetProbes = () => st.phase === 'exploration';
  const canMeasure = () => st.phase === 'exploration' && st.probes;
  const canSetConfig = () => mode === 'exploration'
    && role === 'student'
    && (st.phase === 'predict' || st.phase === 'exploration');
  const canRequestReview = () => role === 'student' && st.phase === 'exploration';
  const canApprove = () => role === 'teacher' && st.reviewRequested && !st.correctionApproved;
  const canApplyCorrection = () => role === 'student' && st.correctionApproved;  // 批准每次消费；不收敛可再走复核
  // 标称 setup 的 U_NG 允许带（blind 收敛判据：复测点须落回带内才算修好）
  const nominalNGBand = () => {
    const s = base.setup;
    return {
      lo: s.E * (s.R2 * 0.95) / (s.R1 * 1.05 + s.R2 * 0.95),
      hi: s.E * (s.R2 * 1.05) / (s.R1 * 0.95 + s.R2 * 1.05),
    };
  };
  const canReflect = () => {
    if (role !== 'student') return false;                       // 教师不能代学生完成反思
    if (st.phase !== 'exploration' || !st.prediction || !hasUsable()) return false;
    if (mode === 'exploration') return true;                    // 自由探索：学生自反思
    if (!st.correctionApplied) return false;
    const band = nominalNGBand();
    // blind 收敛硬判：必须有 usable DC 的 N-G（无序）证据，signed 取绝对值归一，且落回标称 ±5% 带
    return st.evidence.some((e) => e.usable && e.mode === 'DC'
      && ((e.a === 'N' && e.b === 'G') || (e.a === 'G' && e.b === 'N'))
      && covers(band, Math.abs(e.value)));
  };
  const permittedActions = () => {
    const p = [];
    if (canPredict()) p.push('predict');
    if (canSetProbes()) p.push('setProbes');
    if (canMeasure()) p.push('measure');
    if (canSetConfig()) p.push('setConfiguration');
    if (canRequestReview()) p.push('requestTeacherReview');
    if (canApprove()) p.push('approveCorrection');
    if (canApplyCorrection()) p.push('applyCorrection');
    if (canReflect()) p.push('reflect');
    p.push('reset');
    return p;
  };

  // 复审最低证据：≥2 条可用 DC 证据覆盖 U_NG 与 U_PG（任一方向）
  const reviewEvidenceOK = () => {
    const pairs = new Set(st.evidence.filter((e) => e.usable).map((e) => [e.a, e.b].sort().join('')));
    return pairs.has('GN') && pairs.has('GP');
  };

  const invalidateAfterConfig = () => {
    st.cleared.push(...st.evidence);   // 旧证据存档标记 invalidated（供 UI 解释，不参与诊断）
    st.evidence = []; st.prediction = null; st.hintLevel = 0;
    st.reviewRequested = false; st.correctionApproved = false;
    st.phase = 'predict';
  };

  // ---------- 候选推导（只看已获取证据 + 候选自带 topology，不读 hidden actual topology 做判断） ----------
  const deriveCandidates = () => base.candidates.map((cand) => {
    let status = 'open';
    let why = null;
    for (const ev of st.evidence) {
      if (!ev.usable) continue;
      const iv = predInterval(ev.a, ev.b, cand);
      if (!covers(iv, ev.value)) {
        status = 'excluded';
        why = `实测 U${ev.a}${ev.b}=${ev.value.toFixed(3)} V；本候选预测允许带 [${iv.lo.toFixed(3)}, ${iv.hi.toFixed(3)}] V 不覆盖`;
        break;
      }
    }
    return { id: cand.id, desc: cand.desc, status, why };
  });

  // ---------- 提示（递进；不点 groundTruth） ----------
  const hintText = () => {
    const open = deriveCandidates().filter((c) => c.status === 'open');
    if (st.hintLevel <= 1) {
      if (st.evidence.length === 0) return '还缺什么：先提交预测 U2，再用两探针测 U_NG（中点对地）。';
      return `还缺什么：已测 U_NG；仍有 ${open.length} 个候选与证据一致。换 U_PG（电源+对地）做一次 DC 测量。`;
    }
    if (st.hintLevel === 2) {
      for (const [a, b] of [['P', 'G'], ['P', 'N'], ['N', 'G']]) {
        const preds = open.map((c) => {
          const cand = base.candidates.find((x) => x.id === c.id);
          return { desc: c.desc, iv: predInterval(a, b, cand) };
        });
        const disjoint = preds.length >= 2 && preds.every((p1, i) =>
          preds.every((p2, j) => i === j || !covers(p1.iv, (p2.iv.lo + p2.iv.hi) / 2)));
        if (disjoint) {
          const detail = preds.map((p) => `${p.desc} 预测 U${a}${b}≈${((p.iv.lo + p.iv.hi) / 2).toFixed(3)} V（允许带 [${p.iv.lo.toFixed(3)}, ${p.iv.hi.toFixed(3)}]）`).join('；');
          return `哪次测量能区分：测 U${a}${b} —— ${detail}。`;
        }
      }
      return '哪次测量能区分：当前剩余候选在各节点对上都重叠，先检查仪表模式/探针是否有效。';
    }
    return '教师解释：U_PG 就是电源端电压。它等于设定值则电源正常，差异在分压电阻侧；偏离设定值则电源需校准。请用实测点对照候选允许带自行下结论。';
  };

  const snapshot = () => ({
    phase: st.phase,
    role,
    mode,
    prediction: st.prediction
      ? { submitted: true, value: st.prediction.u2, unit: UNITS.voltage }
      : { submitted: false, value: null, unit: UNITS.voltage },
    probes: st.probes,
    config: mode === 'exploration' ? { ...actual } : { ...base.setup },
    derived: (mode === 'exploration' || st.correctionApplied)
      ? { I_mA: actual.E / (actual.R1 + actual.R2) * 1000 }
      : null,
    visibleEvidence: st.evidence.map((e) => ({
      nodes: `U${e.a}${e.b}`, mode: e.mode,
      value: e.value, lo: e.value, hi: e.value,
      usable: e.usable, reason: e.reason, unit: UNITS.voltage,
    })),
    lastMeasurement: st.evidence.length ? {
      value: st.evidence[st.evidence.length - 1].value,
      usable: st.evidence[st.evidence.length - 1].usable,
      reason: st.evidence[st.evidence.length - 1].reason,
      unit: UNITS.voltage,
    } : null,
    candidates: deriveCandidates(),
    invalidatedEvidence: st.cleared.map((e) => ({
      nodes: `U${e.a}${e.b}`, value: e.value, usable: false, reason: `invalidated:${e.reason}`,
    })),
    hint: { level: st.hintLevel, text: hintText() },
    permittedActions: permittedActions(),
    fixtureView: mode === 'exploration' ? { ...actual } : null,
  });

  const ok = () => ({ ok: true, snapshot: snapshot() });
  const bad = (code, message) => ({ ok: false, error: { code, message }, snapshot: snapshot() });

  // ---------- 参数校验 ----------
  const validateCfg = ({ E, R1, R2, topology }) => {
    if (E !== undefined && (!num(E) || E < 0 || E > 12)) return 'E 必须是 0—12V 之间的有限数值';
    if (R1 !== undefined && (!num(R1) || R1 <= 0)) return 'R1 必须是正有限阻值';
    if (R2 !== undefined && (!num(R2) || R2 <= 0)) return 'R2 必须是正有限阻值';
    if (topology !== undefined && !['series', 'shortedR2'].includes(topology)) return 'topology 只能是 series | shortedR2';
    return null;
  };

  return {
    getSnapshot: () => snapshot(),

    setRole({ role: r } = {}) {
      if (!['teacher', 'student'].includes(r)) return bad('invalid_role', 'role 只能是 teacher | student');
      role = r;
      return ok();
    },

    predict({ u2 } = {}) {
      if (!canPredict()) return bad('wrong_phase', '当前阶段不接受预测');
      if (!num(u2) || u2 < 0 || u2 > 12) return bad('invalid_prediction', '预测 U2 必须是 0—12V 有限数值');
      st.prediction = { u2 };
      st.phase = 'exploration';
      return ok();
    },

    setProbes({ a, b, mode = 'DC' } = {}) {
      if (!canSetProbes()) return bad('wrong_phase', '当前阶段不能改探针');
      if (!['P', 'N', 'G'].includes(a) || !['P', 'N', 'G'].includes(b)) return bad('invalid_node', '探针节点只能是 P / N / G');
      if (!METER_MODES.includes(mode)) return bad('invalid_mode', '仪表模式只能是 DC / AC');
      st.probes = { a, b, mode };
      return ok();
    },

    // 自由探索：学生主动改电路（blind 模式禁用，须走 applyCorrection 经教师批准）
    setConfiguration(cfg = {}) {
      if (!canSetConfig()) return bad('blind_locked', '盲诊断模式学生不能直接改电路，须申请教师复核后校正');
      const msg = validateCfg(cfg);
      if (msg) return bad('invalid_config', msg);
      Object.assign(actual, cfg);
      invalidateAfterConfig();
      return ok();
    },

    measure() {
      if (st.phase !== 'exploration') return bad('wrong_phase', '当前阶段不能测量');
      if (!st.probes) return bad('probes_not_set', '未设两探针，不出读数（缺失不当 0、不随机）');
      const { a, b, mode } = st.probes;
      const exact = nodeV(a, actual) - nodeV(b, actual);
      let ev;
      if (mode === 'AC') {
        ev = { a, b, mode: 'AC', value: 0, usable: false, reason: 'AC_mode_on_DC_circuit' };
      } else if (a === b) {
        ev = { a, b, mode: 'DC', value: 0, usable: false, reason: 'same_node_pair' };
      } else {
        ev = { a, b, mode: 'DC', value: exact, usable: true, reason: 'ok' };
      }
      st.evidence.push(ev);
      return ok();
    },

    requestHint() {
      st.hintLevel = Math.min(3, st.hintLevel + 1);
      return ok();
    },

    requestTeacherReview() {
      if (!canRequestReview()) return bad('wrong_phase', '仅学生在探索阶段可申请教师复核');
      if (!reviewEvidenceOK()) {
        return bad('insufficient_evidence', '复审需 ≥2 条有效 DC 证据覆盖 U_NG 与 U_PG；请补测 U_PG 后再申请');
      }
      st.reviewRequested = true;
      st.phase = 'reviewRequested';
      return ok();
    },

    approveCorrection() {
      if (role !== 'teacher') return bad('forbidden_student', '批准校正只能由教师角色执行');
      if (!st.reviewRequested) return bad('review_not_requested', '学生尚未申请复核');
      if (st.correctionApproved) return bad('already_approved', '已批准');
      if (!reviewEvidenceOK()) return bad('insufficient_evidence', '证据仍不全（缺 U_NG/U_PG），退回重测，不校正');
      st.correctionApproved = true;
      return ok();
    },

    // 学生主动输入校正数值；输错就得到错读数，不从 scenario.fix 自动填
    applyCorrection(cfg = {}) {
      if (!canApplyCorrection()) return bad('not_approved_or_not_student', '须教师已批准且由学生执行校正');
      const msg = validateCfg(cfg);
      if (msg) return bad('invalid_config', msg);
      Object.assign(actual, cfg);
      st.correctionApplied = true;
      invalidateAfterConfig();
      return ok();
    },

    reflect({ text } = {}) {
      if (role !== 'student') return bad('forbidden_student', '只有学生能提交反思（教师不能代做）');
      if (st.phase !== 'exploration' || !st.prediction || !hasUsable()) {
        return bad('wrong_phase', '须处于探索阶段、已提交预测且有有效测量才能反思');
      }
      if (mode === 'blind' && !canReflect()) {
        return bad('not_converged', '须有 N-G 有效 DC 复测且落回标称 ±5% 带；可重新补测 U_NG 再试');
      }
      if (!canReflect()) return bad('wrong_phase', '暂不满足反思条件');
      if (typeof text !== 'string' || text.trim().length < 5) return bad('reflection_too_short', '反思须 ≥5 字');
      st.reflection = text.trim();
      st.phase = 'closed';
      return ok();
    },

    reset() {
      actual = clone(initialActual);   // 复原初始电路
      st = fresh();                     // 清预测/探针/证据/审批/反思/阶段
      log = [];                         // 内存日志清空
      return ok();
    },
  };
}

export default { createLab, UNITS, TOLERANCE, NODES };
