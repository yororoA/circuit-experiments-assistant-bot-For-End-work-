// app.js — CircuitBridge 工作台 UI
// 接入 lab-engine.js (v2.2.0) 与 src/scene.js (3D 实验台)
// 所有动作只通过 lab.permittedActions 派生按钮可用性，不重写物理。

import { createLab } from './lab/lab-engine.js';
import { SCENARIOS } from './lab/fixtures/scenarios.mjs';
import { createProductScene } from './scene.js';

// ===== DOM 引用 =====
const $ = (id) => document.getElementById(id);
const el = {
  // 顶栏
  tabFree: $('tab-free'), tabChallenge: $('tab-challenge'),
  roleStudent: $('role-student'), roleTeacher: $('role-teacher'),
  btnStructure: $('btn-structure'),
  // 实验台
  sceneContainer: $('scene-container'), sceneLoading: $('scene-loading'),
  meter: $('meter'), meterReadout: $('meter-readout'), meterSub: $('meter-sub'), meterMode: $('meter-mode'),
  // SVG 电路
  svg: $('circuit-svg'),
  nodeP: $('node-P'), nodeN: $('node-N'), nodeG: $('node-G'),
  probeAInd: $('probe-a-indicator'), probeBInd: $('probe-b-indicator'),
  armA: $('arm-a'), armB: $('arm-b'),
  r1Label: $('r1-label'), r2Label: $('r2-label'), eLabel: $('e-label'),
  // 工作台
  phaseBanner: $('phase-banner'), instruction: $('instruction'),
  configCard: $('config-card'), cfgE: $('cfg-E'), cfgR1: $('cfg-R1'), cfgR2: $('cfg-R2'),
  btnApplyConfig: $('btn-apply-config'),
  setupCard: $('setup-card'), setupDisplay: $('setup-display'), scenarioPick: $('scenario-pick'),
  predictCard: $('predict-card'), predictU2: $('predict-u2'), btnPredict: $('btn-predict'),
  predictionShown: $('prediction-shown'),
  measureCard: $('measure-card'), probeASelect: $('probe-a-select'), probeBSelect: $('probe-b-select'),
  measureMode: $('measure-mode'), btnMeasure: $('btn-measure'), measureError: $('measure-error'),
  evidenceCard: $('evidence-card'), evidenceCount: $('evidence-count'), evidenceList: $('evidence-list'),
  invalidatedList: $('invalidated-list'),
  configInfoCard: $('config-info-card'),
  infoE: $('info-E'), infoR: $('info-R'), infoPredict: $('info-predict'), infoMeasured: $('info-measured'),
  candidateList: $('candidate-list'),
  candidateCard: $('candidate-card'),
  btnHint: $('btn-hint'), hintText: $('hint-text'),
  reviewCard: $('review-card'), btnRequestReview: $('btn-request-review'), btnApprove: $('btn-approve'),
  correctionInputs: $('correction-inputs'), corrE: $('corr-E'), corrR1: $('corr-R1'), corrR2: $('corr-R2'),
  btnApplyCorrection: $('btn-apply-correction'), reviewError: $('review-error'),
  reflectText: $('reflect-text'), btnReflect: $('btn-reflect'), reflectError: $('reflect-error'),
  btnReset: $('btn-reset'), derivedLine: $('derived-line'),
  toast: $('toast'),
  // 结构抽屉
  structureDrawer: $('structure-drawer'), btnCloseStructure: $('btn-close-structure'),
  explodeSlider: $('explode-slider'), explodeVal: $('explode-val'),
  btnReturnAssembly: $('btn-return-assembly'), btnFov: $('btn-fov'),
  btnExportAll: $('btn-export-all'), btnExportB02: $('btn-export-b02'), exportStatus: $('export-status'),
  partsList: $('parts-list'), partDetail: $('part-detail'),
};

// ===== 状态 =====
const state = {
  mode: 'free',            // 'free' | 'challenge'
  scenarioId: 'divider-normal',
  activeProbe: 'A',        // 'A' | 'B' — 当前正在放置的探针
  scene: null,             // scene API 对象
  fovOn: false,
  selectedPart: null,
};

// ===== 工具 =====
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('error', isError);
  el.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

function showInline(errEl, res) {
  if (!errEl) return;
  if (res && res.ok === false) {
    errEl.textContent = `${res.error.code}: ${res.error.message}`;
    errEl.hidden = false;
  } else {
    errEl.hidden = true;
    errEl.textContent = '';
  }
}

function fmt(v, d = 3) {
  if (v === null || v === undefined) return '--';
  return Number(v).toFixed(d);
}

// ===== 实验实例 =====
let lab = null;

function buildLab() {
  const sc = SCENARIOS[state.scenarioId];
  if (!sc) {
    toast(`未知场景 ${state.scenarioId}`, true);
    return;
  }
  const role = state.mode === 'challenge' && el.roleTeacher.classList.contains('active') ? 'teacher' : 'student';
  lab = createLab({ scenario: sc, role });
  // 同步下拉框到初始探针 P/N
  el.probeASelect.value = 'P';
  el.probeBSelect.value = 'N';
  el.measureMode.value = 'DC';
  render();
}

// ===== 渲染 snapshot =====
function render() {
  if (!lab) return;
  const s = lab.getSnapshot();

  // 阶段
  const phaseMap = {
    predict: ['等待预测', ''],
    exploration: ['测量与证据收集中', ''],
    reviewRequested: ['等待教师复核', 'review'],
    closed: ['实验完成', 'closed'],
  };
  const [ptext, pcls] = phaseMap[s.phase] || [s.phase, ''];
  el.phaseBanner.textContent = ptext;
  el.phaseBanner.className = 'phase-banner' + (pcls ? ' ' + pcls : '');

  // 说明文案按模式区分（自由探究不提前泄露 2.5V 歧义）
  if (s.mode === 'blind') {
    el.instruction.textContent = '先预测，再选择 P / N / G 测量点。U_NG 约 2.5V 时可能有不同原因。';
  } else {
    el.instruction.textContent = '调整电路参数，先预测 U_NG，再用两探针测量验证。';
  }

  // 卡片显隐
  const isFree = s.mode === 'exploration';
  const cfg = s.config;
  el.configCard.classList.toggle('hidden', !isFree);
  el.setupCard.classList.toggle('hidden', isFree);
  el.reviewCard.classList.toggle('hidden', isFree);
  el.configInfoCard.classList.toggle('hidden', !isFree);
  el.candidateCard.classList.toggle('hidden', isFree);

  // 自由探究：当前配置 + 预测/已测比较（不跑盲候选诊断）
  if (isFree && cfg) {
    el.infoE.textContent = `${fmt(cfg.E, 2)} V`;
    el.infoR.textContent = `${(cfg.R1/1000).toFixed(1)} kΩ / ${(cfg.R2/1000).toFixed(1)} kΩ`;
    el.infoPredict.textContent = s.prediction.submitted ? `${fmt(s.prediction.value, 3)} V` : '—';
    el.infoMeasured.textContent = s.lastMeasurement ? `${fmt(s.lastMeasurement.value, 3)} V` : '—';
  }

  // 同步输入框显示当前 config（不直接改用户输入框值，只更新 SVG 标签）
  if (cfg) {
    el.eLabel.textContent = `E ${fmt(cfg.E, 2)}V`;
    el.r1Label.textContent = `R1 ${(cfg.R1/1000).toFixed(1)}kΩ`;
    el.r2Label.textContent = `R2 ${(cfg.R2/1000).toFixed(1)}kΩ`;
    if (isFree) {
      el.cfgE.value = cfg.E;
      el.cfgR1.value = cfg.R1;
      el.cfgR2.value = cfg.R2;
    } else {
      el.setupDisplay.textContent = `E = ${fmt(cfg.E, 2)} V，R1 = ${(cfg.R1/1000).toFixed(1)} kΩ，R2 = ${(cfg.R2/1000).toFixed(1)} kΩ（标称）`;
    }
  }

  // 派生电流
  el.derivedLine.textContent = s.derived ? `I = ${fmt(s.derived.I_mA, 2)} mA` : '';

  // 预测
  if (s.prediction.submitted) {
    el.predictionShown.hidden = false;
    el.predictionShown.textContent = `已提交预测 U_NG = ${fmt(s.prediction.value, 2)} V`;
  } else {
    el.predictionShown.hidden = true;
  }

  // 仪表
  if (s.lastMeasurement) {
    el.meterReadout.textContent = `${fmt(s.lastMeasurement.value, 3)} V`;
    el.meterMode.textContent = s.probes ? s.probes.mode : 'DC';
    if (s.lastMeasurement.usable) {
      el.meterSub.textContent = `有效 · ${s.lastMeasurement.reason || 'ok'}`;
      el.meterSub.className = 'meter-sub usable';
    } else {
      el.meterSub.textContent = `无效 · ${s.lastMeasurement.reason}`;
      el.meterSub.className = 'meter-sub invalid';
    }
  } else if (s.prediction.submitted) {
    el.meterReadout.textContent = `${fmt(s.prediction.value, 2)} V`;
    el.meterSub.textContent = '预测值，尚未测量';
    el.meterSub.className = 'meter-sub';
  } else {
    el.meterReadout.textContent = '--.-- V';
    el.meterSub.textContent = '先预测再测量';
    el.meterSub.className = 'meter-sub';
  }

  // 探针指示器（SVG）
  updateProbeIndicators(s.probes);

  // 证据
  el.evidenceCount.textContent = String(s.visibleEvidence.length);
  el.evidenceList.innerHTML = '';
  s.visibleEvidence.forEach((e) => {
    const div = document.createElement('div');
    div.className = 'evidence-item ' + (e.usable ? 'usable' : 'unusable');
    div.innerHTML = `<span><strong>${e.nodes}</strong> (${e.mode})</span>
      <span class="val">${fmt(e.value, 3)} V</span>
      <span class="reason">${e.usable ? '有效证据' : e.reason}</span>`;
    el.evidenceList.appendChild(div);
  });

  // 作废证据
  if (s.invalidatedEvidence && s.invalidatedEvidence.length) {
    el.invalidatedList.hidden = false;
    el.invalidatedList.innerHTML = '';
    s.invalidatedEvidence.forEach((e) => {
      const div = document.createElement('div');
      div.className = 'invalidated-item';
      div.textContent = `已作废：${e.nodes} = ${fmt(e.value, 3)} V（${e.reason}）`;
      el.invalidatedList.appendChild(div);
    });
  } else {
    el.invalidatedList.hidden = true;
  }

  // 候选
  if (s.candidates && s.candidates.length) {
    el.candidateList.innerHTML = '';
    s.candidates.forEach((c) => {
      const div = document.createElement('div');
      div.className = 'candidate-item ' + c.status;
      const why = c.why ? `<div class="cand-why">${c.why}</div>` : '';
      div.innerHTML = `<div class="cand-desc">${c.desc} <span style="float:right;font-size:11px;color:${c.status==='excluded'?'#c62828':'#6b6558'}">${c.status==='excluded'?'已排除':'开放'}</span></div>${why}`;
      el.candidateList.appendChild(div);
    });
  }

  // 提示
  if (s.hint && s.hint.level > 0) {
    el.hintText.hidden = false;
    el.hintText.textContent = s.hint.text;
  } else {
    el.hintText.hidden = true;
  }

  // 校正输入区显隐（仅当已批准）
  const canApplyCorrection = s.permittedActions.includes('applyCorrection');
  el.correctionInputs.classList.toggle('hidden', !canApplyCorrection);

  // 按钮启用态：完全由 permittedActions 派生
  setEnabled(el.btnPredict, s.permittedActions.includes('predict'));
  setEnabled(el.btnMeasure, s.permittedActions.includes('measure'));
  setEnabled(el.btnApplyConfig, s.permittedActions.includes('setConfiguration'));
  setEnabled(el.btnRequestReview, s.permittedActions.includes('requestTeacherReview'));
  setEnabled(el.btnApprove, s.permittedActions.includes('approveCorrection'));
  setEnabled(el.btnApplyCorrection, canApplyCorrection);
  setEnabled(el.btnReflect, s.permittedActions.includes('reflect'));

  // 同步场景 3D
  if (state.scene && state.scene.updateLab) {
    try { state.scene.updateLab(s); } catch (e) { /* 场景未就绪时忽略 */ }
  }
}

function setEnabled(btn, on) {
  if (!btn) return;
  btn.disabled = !on;
}

// ===== SVG 探针指示器 =====
const NODE_POS = { P: [160, 60], N: [160, 200], G: [160, 300] };

function updateProbeIndicators(probes) {
  const map = { A: el.probeAInd, B: el.probeBInd };
  if (!probes) {
    Object.values(map).forEach(g => g.setAttribute('opacity', 0));
    return;
  }
  [['A', probes.a], ['B', probes.b]].forEach(([key, node]) => {
    const g = map[key];
    if (!node || !NODE_POS[node]) { g.setAttribute('opacity', 0); return; }
    const [x, y] = NODE_POS[node];
    g.setAttribute('transform', `translate(${x}, ${y})`);
    g.setAttribute('opacity', 1);
  });
}

// ===== 节点点击（SVG 与 3D 共用同一回调） =====
function handleProbeSelect(node) {
  if (!node || !NODE_POS[node]) return;
  // 写入当前 active 探针对应的下拉框
  if (state.activeProbe === 'A') el.probeASelect.value = node;
  else el.probeBSelect.value = node;
  // 视觉反馈
  toast(`探针 ${state.activeProbe} → ${node}`);
  // 如果已在 exploration 阶段，同步到引擎
  if (lab) {
    const s = lab.getSnapshot();
    if (s.phase === 'exploration') {
      const a = el.probeASelect.value, b = el.probeBSelect.value, mode = el.measureMode.value;
      const res = lab.setProbes({ a, b, mode });
      if (!res.ok) showInline(el.measureError, res);
      render();
    }
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  // 模式 Tab
  el.tabFree.addEventListener('click', () => {
    state.mode = 'free';
    state.scenarioId = 'divider-normal';
    el.tabFree.classList.add('active'); el.tabFree.setAttribute('aria-selected', 'true');
    el.tabChallenge.classList.remove('active'); el.tabChallenge.setAttribute('aria-selected', 'false');
    el.roleStudent.classList.add('active'); el.roleTeacher.classList.remove('active');
    buildLab();
  });
  el.tabChallenge.addEventListener('click', () => {
    state.mode = 'challenge';
    state.scenarioId = 'divider-ambiguity-wrongR2';
    el.tabChallenge.classList.add('active'); el.tabChallenge.setAttribute('aria-selected', 'true');
    el.tabFree.classList.remove('active'); el.tabFree.setAttribute('aria-selected', 'false');
    el.roleStudent.classList.add('active'); el.roleTeacher.classList.remove('active');
    buildLab();
  });

  // 角色
  el.roleStudent.addEventListener('click', () => switchRole('student'));
  el.roleTeacher.addEventListener('click', () => switchRole('teacher'));

  function switchRole(r) {
    if (!lab) return;
    const res = lab.setRole({ role: r });
    if (!res.ok) { toast(res.error.message, true); return; }
    el.roleStudent.classList.toggle('active', r === 'student');
    el.roleTeacher.classList.toggle('active', r === 'teacher');
    render();
  }

  // 场景选择（挑战 A/B）
  el.scenarioPick.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.scenarioPick.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.scenarioId = btn.dataset.scenario;
      buildLab();
    });
  });

  // 探针 arm 切换
  el.armA.addEventListener('click', () => setActiveProbe('A'));
  el.armB.addEventListener('click', () => setActiveProbe('B'));
  function setActiveProbe(k) {
    state.activeProbe = k;
    el.armA.classList.toggle('active', k === 'A');
    el.armB.classList.toggle('active', k === 'B');
    el.armA.setAttribute('aria-pressed', String(k === 'A'));
    el.armB.setAttribute('aria-pressed', String(k === 'B'));
  }

  // SVG 节点点击
  [el.nodeP, el.nodeN, el.nodeG].forEach(c => {
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => handleProbeSelect(c.dataset.node));
    c.setAttribute('tabindex', '0');
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProbeSelect(c.dataset.node); }
    });
  });

  // 下拉框变化
  el.probeASelect.onchange = () => { if (lab) syncProbesFromUI(); };
  el.probeBSelect.onchange = () => { if (lab) syncProbesFromUI(); };
  el.measureMode.onchange = () => { if (lab) syncProbesFromUI(); };

  function syncProbesFromUI() {
    const s = lab.getSnapshot();
    if (s.phase !== 'exploration') return;
    const res = lab.setProbes({
      a: el.probeASelect.value,
      b: el.probeBSelect.value,
      mode: el.measureMode.value,
    });
    showInline(el.measureError, res);
    render();
  }

  // 应用配置（自由探索）
  el.btnApplyConfig.addEventListener('click', () => {
    if (!lab) return;
    const E = parseFloat(el.cfgE.value);
    const R1 = parseFloat(el.cfgR1.value);
    const R2 = parseFloat(el.cfgR2.value);
    const res = lab.setConfiguration({ E, R1, R2 });
    if (!res.ok) { toast(`${res.error.code}: ${res.error.message}`, true); }
    render();
  });

  // 提交预测
  el.btnPredict.addEventListener('click', () => {
    if (!lab) return;
    const u2 = parseFloat(el.predictU2.value);
    if (isNaN(u2)) { toast('请输入有效预测值', true); return; }
    const res = lab.predict({ u2 });
    if (!res.ok) { toast(`${res.error.code}: ${res.error.message}`, true); }
    render();
  });

  // 测量
  el.btnMeasure.addEventListener('click', () => {
    if (!lab) return;
    const res = lab.measure();
    showInline(el.measureError, res);
    if (!res.ok) toast(`${res.error.code}: ${res.error.message}`, true);
    render();
  });

  // 提示
  el.btnHint.addEventListener('click', () => {
    if (!lab) return;
    lab.requestHint();
    render();
  });

  // 申请复核
  el.btnRequestReview.addEventListener('click', () => {
    if (!lab) return;
    const res = lab.requestTeacherReview();
    showInline(el.reviewError, res);
    if (!res.ok) toast(`${res.error.code}: ${res.error.message}`, true);
    render();
  });

  // 教师批准
  el.btnApprove.addEventListener('click', () => {
    if (!lab) return;
    const res = lab.approveCorrection();
    showInline(el.reviewError, res);
    if (!res.ok) toast(`${res.error.code}: ${res.error.message}`, true);
    render();
  });

  // 学生应用校正
  el.btnApplyCorrection.addEventListener('click', () => {
    if (!lab) return;
    const cfg = {};
    if (el.corrE.value !== '') cfg.E = parseFloat(el.corrE.value);
    if (el.corrR1.value !== '') cfg.R1 = parseFloat(el.corrR1.value);
    if (el.corrR2.value !== '') cfg.R2 = parseFloat(el.corrR2.value);
    const res = lab.applyCorrection(cfg);
    showInline(el.reviewError, res);
    if (!res.ok) toast(`${res.error.code}: ${res.error.message}`, true);
    // 校正后清空输入
    el.corrE.value = el.corrR1.value = el.corrR2.value = '';
    render();
  });

  // 反思
  el.btnReflect.addEventListener('click', () => {
    if (!lab) return;
    const text = el.reflectText.value;
    const res = lab.reflect({ text });
    showInline(el.reflectError, res);
    if (!res.ok) toast(`${res.error.code}: ${res.error.message}`, true);
    else { toast('已提交解释，实验完成'); el.reflectText.value = ''; }
    render();
  });

  // 重置
  el.btnReset.addEventListener('click', () => {
    if (!lab) return;
    lab.reset();
    el.reflectText.value = '';
    el.corrE.value = el.corrR1.value = el.corrR2.value = '';
    toast('已重置到初始场景');
    render();
  });

  // 结构观察抽屉
  el.btnStructure.addEventListener('click', () => openStructure());
  el.btnCloseStructure.addEventListener('click', () => closeStructure());

  function openStructure() {
    el.structureDrawer.classList.remove('hidden');
    if (state.scene && state.scene.setModelMode) state.scene.setModelMode(true);
  }
  function closeStructure() {
    el.structureDrawer.classList.add('hidden');
    if (state.selectedPart && state.scene && state.scene.returnAssembly) {
      state.scene.returnAssembly();
      state.selectedPart = null;
      el.partDetail.textContent = '选择左侧部件查看信息与安装说明。';
      el.partsList.querySelectorAll('.part-item').forEach(li => li.classList.remove('selected'));
    }
    if (state.scene && state.scene.setModelMode) state.scene.setModelMode(false);
  }

  // 视角按钮
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (state.scene && state.scene.setView) state.scene.setView(btn.dataset.view);
    });
  });

  // 爆炸滑块
  el.explodeSlider.oninput = () => {
    const v = parseFloat(el.explodeSlider.value);
    el.explodeVal.textContent = Math.round(v * 100) + '%';
    if (state.scene && state.scene.setExplode) state.scene.setExplode(v);
  };

  el.btnReturnAssembly.addEventListener('click', () => {
    if (state.scene && state.scene.returnAssembly) state.scene.returnAssembly();
    state.selectedPart = null;
    el.partDetail.textContent = '选择左侧部件查看信息与安装说明。';
    el.partsList.querySelectorAll('.part-item').forEach(li => li.classList.remove('selected'));
  });

  el.btnFov.addEventListener('click', () => {
    state.fovOn = !state.fovOn;
    el.btnFov.classList.toggle('active', state.fovOn);
    if (state.scene && state.scene.toggleFov) state.scene.toggleFov(state.fovOn);
  });

  // 导出（scene.exportModel 返回 Promise<{ok,data:ArrayBuffer,bbox_m,partId}>）
  el.btnExportAll.addEventListener('click', () => doExport(null, 'robot_assembled.glb'));
  el.btnExportB02.addEventListener('click', () => doExport('B02', 'B02.glb'));
  async function doExport(partId, filename) {
    if (!state.scene || !state.scene.exportModel) {
      el.exportStatus.textContent = 'GLB 导出模块尚未就绪。';
      return;
    }
    el.exportStatus.textContent = '正在生成 GLB…';
    try {
      const r = await state.scene.exportModel({ partId });
      if (!r || r.ok === false || !r.data) {
        el.exportStatus.textContent = 'GLB 导出失败，请稍后重试。';
        return;
      }
      const blob = new Blob([r.data], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      el.exportStatus.textContent = `已导出 ${filename}（${(blob.size/1024).toFixed(0)} KB）`;
    } catch (e) {
      el.exportStatus.textContent = `导出失败：${e.message}`;
    }
  }

  // 窗口尺寸
  window.addEventListener('resize', () => {
    if (state.scene && state.scene.resize) state.scene.resize();
  });
}

// ===== 部件列表（静态元数据，由 scene.js 3D 几何对应） =====
const PARTS_META = [
  ['B01', '椭圆底座', '低重心圆角底座，6 通孔螺钉定位。'],
  ['B02', '中空主壳', '壁厚 6mm，左侧 6 透空槽，背板 USB 口，内 4 空心螺柱。'],
  ['B03', '前盖屏窗', '178×148 完整前盖板，矩形屏窗 + 4 真螺钉孔。'],
  ['B04', '显示模块', '宽屏显示，表情与读数动态，嵌入前盖屏窗。'],
  ['B05', 'LED 灯条', '下唇 LED 灯条，薄嵌式自发光，用于状态反馈。'],
  ['B06', '短颈支架', '连接主壳与头舱的短颈支架。'],
  ['B07', '俯拍镜头头舱', '圆角长条头舱，镜头俯角 30° 面向桌面实验区。'],
  ['B08', '侧维护板', '右侧维护板，4 颗十字沉头螺钉。'],
  ['B09', '格栅盖板', '左侧格栅盖板，覆盖 6 透空槽。'],
  ['B10', 'PCB 承载板', '内部 PCB 板，6 元件 + 3 束连接线带端点连接器。'],
];

function buildPartsList() {
  PARTS_META.forEach(([id, name, desc]) => {
    const li = document.createElement('li');
    li.className = 'part-item';
    li.dataset.id = id;
    li.textContent = `${id} ${name}`;
    li.addEventListener('click', () => {
      el.partsList.querySelectorAll('.part-item').forEach(x => x.classList.remove('selected'));
      li.classList.add('selected');
      state.selectedPart = id;
      el.partDetail.innerHTML = `<strong>${id} ${name}</strong><br>${desc}`;
      if (state.scene && state.scene.selectPart) state.scene.selectPart(id);
    });
    el.partsList.appendChild(li);
  });
}

// ===== 启动 3D 场景 =====
function mountScene() {
  try {
    state.scene = createProductScene(el.sceneContainer, {
      onProbeSelect: (node) => handleProbeSelect(node),
    });
    state.scene.start();
    el.sceneContainer.classList.add('ready');
    el.sceneLoading.hidden = true;
    // 首次渲染后同步一次 snapshot
    render();
  } catch (e) {
    console.error('scene mount failed:', e);
    el.sceneLoading.querySelector('.scene-loading-title').textContent = '3D 实验台暂不可用';
    el.sceneLoading.querySelector('.scene-loading-sub').textContent = `WebGL / scene.js 加载失败：${e.message}。电路示意与测量仍可操作。`;
  }
}

// ===== 初始化 =====
buildPartsList();
bindEvents();
buildLab();
mountScene();
