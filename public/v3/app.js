// CircuitBridge v3 classroom UI
// 接真实 lab-engine（Ru22）与 scene（RUlO）。无 stub。

import { createLab, TERMINALS as ENG_TERMINALS } from './lab/lab-engine.js';

const $ = (id) => document.getElementById(id);

const state = {
  task: 'restore_nominal',
  scenarioId: 'A',
  activeProbe: 'A',
  lab: null,
  scene: null,
};

const TERMINALS = [
  { id: 'E_pos', zh: '电源正 E+' },
  { id: 'E_neg', zh: '电源负 E−' },
  { id: 'R1_a', zh: 'R1 上端 R1a' },
  { id: 'R1_b', zh: 'R1 下端 R1b' },
  { id: 'R2_a', zh: 'R2 上端 R2a' },
  { id: 'R2_b', zh: 'R2 下端 R2b' },
];
const TERMINAL_ZH = Object.fromEntries(TERMINALS.map(t => [t.id, t.zh]));
const PHASE_ZH = {
  orientation: '尚未开始',
  exploration: '预测后探索中',
  evidence_submitted: '已提交因果，待教师点评',
  teacher_reviewed: '教师已点评',
};

function buildTerminalOptions(select) {
  select.innerHTML = '';
  TERMINALS.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id; o.textContent = `${t.zh}（${t.id}）`;
    select.appendChild(o);
  });
}

function showInline(el, err) {
  el.textContent = `${err.code || 'error'}: ${err.message || JSON.stringify(err)}`;
  el.hidden = false;
}
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

function handleTerminalClick(terminal) {
  if (state.lab.getSnapshot().paused) { toast('课堂暂停，探针锁定'); return; }
  const sel = state.activeProbe === 'A' ? $('probe-a') : $('probe-b');
  sel.value = terminal;
  const ind = state.activeProbe === 'A' ? $('probe-a-ind') : $('probe-b-ind');
  const node = document.querySelector(`.terminal[data-terminal="${terminal}"] circle`);
  if (node) {
    ind.setAttribute('cx', node.getAttribute('cx'));
    ind.setAttribute('cy', node.getAttribute('cy'));
    ind.setAttribute('opacity', '1');
  }
}

function bindEvents() {
  document.querySelectorAll('.task-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.task = btn.dataset.task;
      rebuildLab();
    });
  });
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.lab.setRole(btn.dataset.role);
      render();
    });
  });
  document.querySelectorAll('.terminal').forEach(g => {
    g.addEventListener('click', () => handleTerminalClick(g.dataset.terminal));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTerminalClick(g.dataset.terminal); }
    });
  });

  $('btn-predict').addEventListener('click', () => {
    const r = state.lab.predict({
      u2: parseFloat($('predict-u2').value),
      iMa: parseFloat($('predict-i').value),
      pMw: parseFloat($('predict-p').value),
    });
    if (!r.ok) { showInline($('predict-error'), r.error); return; }
    $('predict-error').hidden = true;
    render();
  });

  $('btn-apply-config').addEventListener('click', () => {
    const r = state.lab.setConfig({
      E: parseFloat($('cfg-E').value),
      R1: parseFloat($('cfg-R1').value),
      R2: parseFloat($('cfg-R2').value),
    });
    if (!r.ok) { showInline($('measure-error'), r.error); return; }
    $('measure-error').hidden = true;
    render();
  });

  $('btn-measure').addEventListener('click', () => {
    const r = state.lab.setProbes({
      a: $('probe-a').value, b: $('probe-b').value, mode: $('measure-mode').value,
    });
    if (!r.ok) { showInline($('measure-error'), r.error); return; }
    const m = state.lab.measure();
    if (!m.ok) { showInline($('measure-error'), m.error); return; }
    $('measure-error').hidden = true;
    render();
  });

  $('btn-submit-mapping').addEventListener('click', () => {
    const r = state.lab.submitMapping({ terminal: $('map-terminal').value, net: $('map-net').value });
    if (r.ok) {
      const last = r.snapshot.mappingResponses[r.snapshot.mappingResponses.length - 1];
      $('mapping-result').textContent = last.correct
        ? `${last.terminal} 映射 ${last.net}：与实际 net 一致`
        : `${last.terminal} 映射 ${last.net}：与实际 net 不符`;
      render();
    }
  });

  $('btn-compare').addEventListener('click', () => {
    const r = state.lab.compareHypotheses({
      measure: { a: $('cmp-a').value, b: $('cmp-b').value, mode: $('cmp-mode').value },
      readings: {
        A: parseFloat($('cmp-r1').value) || 0,
        B: parseFloat($('cmp-r2').value) || 0,
      },
      reasonCode: $('cmp-reason').value,
    });
    if (!r.ok) { showInline($('cmp-error'), r.error); return; }
    $('cmp-error').hidden = true;
    $('cmp-result').textContent = '已记录假设对比';
    render();
  });

  $('btn-submit-claim').addEventListener('click', () => {
    const excl = $('claim-exclude').value;
    const r = state.lab.submitClaim({
      goalType: $('claim-goal').value,
      claimCode: $('claim-code').value,
      evidenceIds: state.lab.getSnapshot().evidence.map(e => e.id),
      excludedCandidateIds: excl ? [excl] : [],
      comparison: {
        iBeforeMa: parseFloat($('claim-i-before').value) || 0,
        iAfterMa: parseFloat($('claim-i-after').value) || 0,
        pBeforeMw: parseFloat($('claim-p-before').value) || 0,
        pAfterMw: parseFloat($('claim-p-after').value) || 0,
      },
      limitCode: $('claim-limit').value || null,
      freeText: $('claim-text').value,
    });
    if (!r.ok) { showInline($('claim-error'), r.error); return; }
    $('claim-error').hidden = true;
    render();
  });

  $('btn-teacher-intervene').addEventListener('click', () => {
    const r = state.lab.teacherIntervention({
      confusionClass: $('intervene-class').value,
      promptLevel: 1,
      comment: $('intervene-comment').value,
    });
    if (!r.ok) { showInline($('intervene-error'), r.error); return; }
    $('intervene-error').hidden = true;
    render();
  });

  $('btn-respond').addEventListener('click', () => {
    const iv = state.lab.getSnapshot().interventions;
    if (!iv.length) return;
    const r = state.lab.respondToIntervention({
      interventionId: iv[iv.length - 1].id,
      freeText: $('respond-text').value,
    });
    if (r.ok) { $('respond-text').value = ''; render(); }
  });

  $('btn-teacher-review').addEventListener('click', () => {
    const r = state.lab.teacherReview({
      classification: $('teacher-class').value,
      comment: $('teacher-comment').value,
      nextStep: $('teacher-next').value,
    });
    if (!r.ok) { showInline($('teacher-error'), r.error); return; }
    $('teacher-error').hidden = true;
    render();
  });

  $('btn-hint').addEventListener('click', () => { state.lab.requestHint(); render(); });
  // 选 current 模式时自动串联间隙取样 R1_b/R2_a
  $('measure-mode').addEventListener('change', () => {
    if ($('measure-mode').value === 'current') {
      $('probe-a').value = 'R1_b';
      $('probe-b').value = 'R2_a';
      toast('电流档：串联间隙 R1b-R2a');
    }
    render();
  });
  $('btn-pause').addEventListener('click', () => {
    const s = state.lab.getSnapshot();
    state.lab.setPaused(!s.paused);
    render();
  });
  $('btn-reset').addEventListener('click', () => { state.lab.reset(); render(); });

  // 模型查看工具
  $('mdl-part').addEventListener('change', () => {
    state.scene?.setPartMode($('mdl-part').value || null);
  });
  $('mdl-view').addEventListener('change', () => {
    state.scene?.setView($('mdl-view').value || null);
  });
  $('mdl-explode').addEventListener('change', () => {
    state.scene?.setExploded($('mdl-explode').value === '1');
  });
  $('mdl-fov').addEventListener('change', () => {
    state.scene?.setObservationCone($('mdl-fov').checked);
  });
  $('btn-export-glb').addEventListener('click', async () => {
    try {
      const partId = $('mdl-part').value || 'whole';
      const r = await state.scene?.exportGLB(partId);
      if (!r?.ok) throw new Error('export failed');
      const blob = new Blob([r.data], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = partId === 'whole' ? 'bridge_whole.glb' : `${partId}.glb`;
      a.click();
      URL.revokeObjectURL(url);
      $('export-status').textContent = `已导出 ${a.download}（${r.bbox_m?.map(v=>v?.toFixed?.(2)||v).join('×')||''} m）`;
    } catch (e) {
      $('export-status').textContent = `导出失败：${e.message}`;
    }
  });

  // 观测控制
  $('obs-mode').addEventListener('change', () => {
    const occluded = [...document.querySelectorAll('.obs-occlude:checked')].map(c => c.value);
    state.lab.setObservation({ mode: $('obs-mode').value, occludedTerminals: occluded });
    render();
  });
  $('obs-manual').addEventListener('change', () => {
    state.lab.setObservation({ manualConfirmed: $('obs-manual').checked });
    render();
  });
  document.querySelectorAll('.obs-occlude').forEach(cb => {
    cb.addEventListener('change', () => {
      const occluded = [...document.querySelectorAll('.obs-occlude:checked')].map(c => c.value);
      state.lab.setObservation({ occludedTerminals: occluded });
      render();
    });
  });
}

function render() {
  const s = state.lab.getSnapshot();
  $('phase-banner').textContent = PHASE_ZH[s.phase] || s.phase;
  $('phase-banner').dataset.phase = s.phase;
  $('task-goal').textContent = s.task.id === 'restore_nominal'
    ? '找出故障并恢复 E=5V, R1=1kΩ, R2=2kΩ 串联，给出因果证据'
    : '设计 R1/R2 使 U_NG/E = 2/3；比较工作点 I 与总功率 P';
  $('task-progress').textContent = s.evidence.length
    ? `已采集 ${s.evidence.length} 条有效证据`
    : (s.prediction ? '已预测，待测量' : '尚未开始');

  // meter
  const last = s.lastMeasurement;
  if (last && last.usable) {
    $('meter-readout').textContent = last.value.toFixed(3);
    $('meter-sub').textContent = `仿真测量 · ${TERMINAL_ZH[last.a]||last.a}-${TERMINAL_ZH[last.b]||last.b} · ${last.unit}`;
  } else if (s.prediction) {
    $('meter-readout').textContent = s.prediction.u2.toFixed(3);
    $('meter-sub').textContent = '预测值，尚未测量';
  } else {
    $('meter-readout').textContent = '--.--';
    $('meter-sub').textContent = '先预测再测量';
  }
  $('predict-feedback').textContent = s.predictionFeedback || '';

  // observation control
  $('obs-mode').value = s.observation.mode;
  $('obs-manual').checked = s.observation.manualConfirmed;
  $('obs-status').textContent = `观测模式：${s.observation.mode}${s.observation.manualConfirmed ? '（已手动确认）' : ''}`;
  $('obs-occlude-row').hidden = s.observation.mode !== 'occluded';
  // sync occluded checkboxes
  document.querySelectorAll('.obs-occlude').forEach(cb => {
    cb.checked = s.observation.occludedTerminals?.includes(cb.value);
  });

  // evidence
  $('evidence-list').innerHTML = s.evidence.map(e =>
    `<div class="evidence-item">证据 ${e.id} · ${TERMINAL_ZH[e.a]||e.a}-${TERMINAL_ZH[e.b]||e.b}（${e.mode}）：${e.value.toFixed(3)} ${e.unit}</div>`
  ).join('');
  $('stale-evidence').innerHTML = s.staleEvidence.map(e =>
    `<div class="evidence-item stale">证据 ${e.id}（已过期）· ${TERMINAL_ZH[e.a]||e.a}-${TERMINAL_ZH[e.b]||e.b}: ${e.value?.toFixed(3) || '—'}</div>`
  ).join('');

  // claim evidence summary
  $('claim-evidence-summary').innerHTML =
    '<div class="evidence-item">当前有效：' + (s.evidence.map(e => e.id).join(', ') || '无') + '</div>' +
    '<div class="evidence-item stale">已过期：' + (s.staleEvidence.map(e => e.id).join(', ') || '无') + '</div>';

  // candidates
  $('candidate-list').innerHTML = s.candidates.map(c =>
    `<div class="candidate-item ${c.compatible ? 'open' : 'excluded'}">候选 ${c.id}：${c.desc} — ${c.compatible ? '仍兼容' : '已排除'}</div>`
  ).join('') || '<div class="evidence-item">非恢复标称任务，无候选假设</div>';

  // teacher
  $('teacher-card').classList.toggle('hidden', s.role !== 'teacher');
  $('respond-card').classList.toggle('hidden', s.role !== 'student' || !s.interventions?.length);
  $('teacher-evidence').textContent = `学生证据 ${s.evidence.length} 条；主张：${s.claim?.claimCode || '未提交'}`;
  $('teacher-responses').innerHTML = s.studentResponses.map(r =>
    `<div class="evidence-item">对干预 ${r.interventionId}：${r.freeText || JSON.stringify(r.mapping || r.comparison || {})}</div>`
  ).join('') || '<div class="evidence-item">尚无学生回应</div>';

  // buttons
  const pa = new Set(s.permittedActions);
  const gate = (ok) => ok && !s.paused;
  $('btn-predict').disabled = !gate(pa.has('predict'));
  $('btn-measure').disabled = !gate(pa.has('measure'));
  $('btn-apply-config').disabled = !gate(pa.has('setConfig'));
  $('btn-submit-mapping').disabled = !gate(pa.has('submitMapping'));
  $('btn-compare').disabled = !gate(pa.has('compareHypotheses'));
  $('btn-submit-claim').disabled = !gate(pa.has('submitClaim'));
  $('btn-teacher-review').disabled = !gate(pa.has('teacherReview'));
  $('btn-hint').disabled = !gate(pa.has('requestHint'));
  $('btn-pause').textContent = s.paused ? '继续' : '暂停';
  $('paused-banner').hidden = !s.paused;

  if (state.scene?.updateScene) {
    try {
      const activeIntervention = s.interventions?.[s.interventions.length - 1] || null;
      state.scene.updateScene({
        status: s.sceneState?.status || s.phase,
        probes: s.probes,
        wires: s.wires,
        netMap: s.terminalNetMap,
        terminalNetMap: s.terminalNetMap,
        displayConfig: s.displayConfig,
        lastMeasurement: s.lastMeasurement,
        candidatesOpen: (s.candidates || []).filter(c => c.compatible).map(c => c.id),
        observation: s.observation,
        teacherPrompt: activeIntervention,
        teacherIntervention: activeIntervention,
        teacherReview: s.teacherReview,
        claim: { submitted: s.phase === 'evidence_submitted' || !!s.teacherReview },
        prediction: { submitted: !!s.prediction, value: s.prediction?.u2 ?? null },
        manualConfirmed: s.observation?.manualConfirmed,
      });
    } catch (e) { console.error('updateScene:', e); }
  }
}

function rebuildLab() {
  const scenarioId = state.task === 'ratio_design' ? 'scaled' : 'A';
  state.lab = createLab({ task: state.task, scenarioId });
  render();
}

function init() {
  buildTerminalOptions($('probe-a'));
  buildTerminalOptions($('probe-b'));
  buildTerminalOptions($('map-terminal'));
  buildTerminalOptions($('cmp-a'));
  buildTerminalOptions($('cmp-b'));
  bindEvents();
  rebuildLab();
  // 动态接入 scene
  import('./scene.js').then(({ createProductScene }) => {
    try {
      state.scene = createProductScene($('scene-container'), {
        onTerminalClick: (t) => handleTerminalClick(t),
        onWireClick: () => {},
      });
      if (state.scene.start) state.scene.start();
      // 渲染第一帧后隐藏占位
      requestAnimationFrame(() => { $('scene-placeholder').hidden = true; });
    } catch (e) {
      console.error('scene mount failed:', e);
      $('scene-placeholder').querySelector('.ph-title').textContent = '3D 实验台不可用';
      $('scene-placeholder').querySelector('.ph-sub').textContent =
        `WebGL 初始化失败：${e.message || e}。请用带 GPU 的现代浏览器打开。电路示意与测量仍可操作。`;
    }
  }).catch((e) => {
    console.error('scene import failed:', e);
    $('scene-placeholder').querySelector('.ph-title').textContent = '3D 模块加载失败';
    $('scene-placeholder').querySelector('.ph-sub').textContent =
      `import 错误：${e.message || e}。请检查 vendor 路径。`;
  });
}

init();

export function getSceneDiagnostics() {
  return state.scene?.getDiagnostics?.() ?? null;
}
if (typeof window !== 'undefined') {
  window.CircuitBridgeReadOnly = { getSceneDiagnostics };
  // dev-only read access for acceptance tests
  window.__lab = () => state.lab;
  window.__activeProbe = () => state.activeProbe;
  window.__setActiveProbe = (p) => { state.activeProbe = p; };
}
