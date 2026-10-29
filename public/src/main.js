import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFExporter } from '../vendor/GLTFExporter.js';

// ===== State machine (reused from a25 logic) =====
const STATES = {
  S0: { name:"S0 · 理论示例", cls:"S0", face:"happy", u2:"3.333", i:"1.667", dev:"0.0%", r2:"2.0", led:"green",
        tags:["理论计算","R1=1kΩ","R2=2kΩ","待测量"], log:"S0 理论示例：U2=5×2/3=3.333V，I=1.667mA。" },
  S1: { name:"S1 · 测量异常", cls:"S1", face:"concerned", u2:"2.500", i:"2.500", dev:"-25%", r2:"1.0", led:"yellow",
        tags:["示例读数 2.50V","偏离区间","拓扑预置正确","元件值未知"], log:"S1：U2=2.50V，偏离比较区间；仪器误差未知，不判合格。" },
  S2: { name:"S2 · 证据不足拒判", cls:"S2", face:"frown", u2:"2.500", i:"2.500", dev:"-25%", r2:"未知", led:"red",
        tags:["拓扑预置","元件未知","不能定位","证据冲突","转教师"], log:"S2 拒判：证据不足，停止自动诊断，转教师。" },
  S3: { name:"S3 · 教师核验（演示）", cls:"S3", face:"neutral", u2:"—", i:"—", dev:"—", r2:"1.0(错)", led:"yellow",
        tags:["模拟断电","核对标称","发现 R2=1kΩ","非真实测阻"], log:"S3 演示：教师指导断电并核对元件，发现 R2=1kΩ。" },
  S4: { name:"S4 · 学生更换（演示）", cls:"S4", face:"neutral", u2:"—", i:"—", dev:"—", r2:"更换中", led:"blue",
        tags:["学生操作","断电状态","更换 R2=2kΩ","机器人不碰线"], log:"S4 演示：学生在断电状态下把 R2 换回 2kΩ。" },
  S5: { name:"S5 · 待教师安全确认", cls:"S5", face:"neutral", u2:"—", i:"—", dev:"—", r2:"2.0", led:"yellow",
        tags:["学生已更换","待教师安全确认","独立门禁","学生待自解释"], log:"S5：待教师独立安全确认后通电复测。" },
  S6: { name:"S6 · 复测完成，待反思", cls:"S6", face:"happy", u2:"3.340", i:"1.670", dev:"+0.2%", r2:"2.0", led:"green",
        tags:["复测 3.34V","+0.2%","待学生反思","本页内存记录"], log:"S6：复测 U2=3.34V (+0.2%)。等待学生文字反思。" }
};
const ORDER = ["S0","S1","S2","S3","S4","S5","S6"];

const state = {
  current:"S0", auto:false, paused:false,
  teacherPowerOff:false, teacherPartCheck:false, studentReplaced:false, safetyConfirmed:false,
  teacherTakeover:false, reflectionDone:false, currentRole:"teacher"
};

// ===== Scene setup =====
const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x263238);

const camW = wrap.clientWidth || (window.innerWidth - 340);
const camH = wrap.clientHeight || window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, camW/camH, 0.1, 2000);
camera.position.set(200, 160, 260);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(camW, camH);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 40, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 80;
controls.maxDistance = 500;

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x80cbc4, 0.3);
fillLight.position.set(-100, 50, -100);
scene.add(fillLight);

// ===== Materials =====
const mat = (color, rough=0.6, metal=0.1) => new THREE.MeshStandardMaterial({ color, roughness:rough, metalness:metal });

// ===== Build robot parts =====
const parts = {}; // id -> {group, homePos, homeRot}
const robotGroup = new THREE.Group();
scene.add(robotGroup);

function makeBox(w, h, d, material, x=0, y=0, z=0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// B01 桌面底座 (220×25×180mm)
const b01 = new THREE.Group();
b01.add(makeBox(220, 25, 180, mat(0x37474f, 0.8, 0.2), 0, 12.5, 0));
b01.userData = { id:"B01", name:"桌面底座", desc:"整机承载，橡胶脚垫防滑" };
robotGroup.add(b01);
parts.B01 = { group:b01, homePos:b01.position.clone(), homeRot:b01.rotation.clone() };

// B02 外壳框架 (200×180×160)
const b02 = new THREE.Group();
b02.add(makeBox(200, 180, 160, mat(0xeceff1, 0.7, 0.05), 0, 115, 0));
b02.userData = { id:"B02", name:"外壳框架", desc:"主体结构，容纳计算模块" };
robotGroup.add(b02);
parts.B02 = { group:b02, homePos:b02.position.clone(), homeRot:b02.rotation.clone() };

// B03 前面板 (190×170×12)
const b03 = new THREE.Group();
b03.add(makeBox(190, 170, 12, mat(0xffffff, 0.5, 0.05), 0, 115, 86));
b03.userData = { id:"B03", name:"前面板", desc:"嵌入显示模块与状态灯条" };
robotGroup.add(b03);
parts.B03 = { group:b03, homePos:b03.position.clone(), homeRot:b03.rotation.clone() };

// B04 显示模块 (150×90×8)
const b04 = new THREE.Group();
b04.add(makeBox(150, 90, 8, mat(0x1565c0, 0.3, 0.1), 0, 130, 93));
b04.userData = { id:"B04", name:"显示模块", desc:"LCD屏：显示状态与文字反馈" };
robotGroup.add(b04);
parts.B04 = { group:b04, homePos:b04.position.clone(), homeRot:b04.rotation.clone() };

// B05 状态灯条 (160×12×8)
const b05 = new THREE.Group();
const ledMesh = makeBox(160, 12, 8, mat(0x00838f, 0.3, 0.1), 0, 60, 93);
b05.add(ledMesh);
b05.userData = { id:"B05", name:"状态灯条", desc:"LED：绿=正常/黄=待确认/红=告警" };
robotGroup.add(b05);
parts.B05 = { group:b05, homePos:b05.position.clone(), homeRot:b05.rotation.clone() };

// B06 颈部支架 (40×60×40)
const b06 = new THREE.Group();
b06.add(makeBox(40, 60, 40, mat(0x455a64, 0.6, 0.3), 0, 235, 0));
b06.userData = { id:"B06", name:"颈部支架", desc:"连接外壳与摄像头头舱" };
robotGroup.add(b06);
parts.B06 = { group:b06, homePos:b06.position.clone(), homeRot:b06.rotation.clone() };

// B07 摄像头头舱 (70×50×60)
const b07 = new THREE.Group();
b07.add(makeBox(70, 50, 60, mat(0x00838f, 0.4, 0.2), 0, 285, 0));
// Camera lens (small cylinder)
const lensGeo = new THREE.CylinderGeometry(8, 8, 5, 16);
const lens = new THREE.Mesh(lensGeo, mat(0x212121, 0.2, 0.8));
lens.rotation.x = Math.PI/2;
lens.position.set(0, 285, 32);
lens.castShadow = true;
b07.add(lens);
b07.userData = { id:"B07", name:"摄像头头舱", desc:"数字模型摄像头窗（未接真实视觉）" };
robotGroup.add(b07);
parts.B07 = { group:b07, homePos:b07.position.clone(), homeRot:b07.rotation.clone() };

// B08 双喇叭格栅 (180×30×10)
const b08 = new THREE.Group();
b08.add(makeBox(180, 30, 10, mat(0x263238, 0.8, 0.1), 0, 90, 93));
b08.userData = { id:"B08", name:"双喇叭格栅", desc:"音响出音孔（TTS未接入）" };
robotGroup.add(b08);
parts.B08 = { group:b08, homePos:b08.position.clone(), homeRot:b08.rotation.clone() };

// B09 侧盖 (10×160×140) x2
const b09 = new THREE.Group();
b09.add(makeBox(10, 160, 140, mat(0xb0bec5, 0.7, 0.1), 105, 115, 0));
b09.add(makeBox(10, 160, 140, mat(0xb0bec5, 0.7, 0.1), -105, 115, 0));
b09.userData = { id:"B09", name:"侧盖", desc:"左右对称，散热孔阵列" };
robotGroup.add(b09);
parts.B09 = { group:b09, homePos:b09.position.clone(), homeRot:b09.rotation.clone() };

// B10 计算模块 (140×30×120)
const b10 = new THREE.Group();
b10.add(makeBox(140, 30, 120, mat(0x263238, 0.5, 0.3), 0, 115, 0));
b10.userData = { id:"B10", name:"计算模块", desc:"教学演示计算板（不接串口/LLM）" };
robotGroup.add(b10);
parts.B10 = { group:b10, homePos:b10.position.clone(), homeRot:b10.rotation.clone() };

// Robot on table at x=80, z=0
robotGroup.position.set(80, 0, 0);

// ===== Scene objects =====
// Table (1200×750×800) - top surface at y=0
const table = new THREE.Group();
table.add(makeBox(1200, 10, 800, mat(0x5d4037, 0.8, 0.05), 0, -5, 0));
scene.add(table);

// PSU (160×80×200) at x=-150
const psu = new THREE.Group();
psu.add(makeBox(160, 80, 200, mat(0x455a64, 0.6, 0.2), 0, 40, 0));
psu.add(makeBox(120, 40, 5, mat(0x1565c0, 0.3, 0.1), 0, 50, 103));
psu.position.set(-200, 0, -50);
scene.add(psu);

// Breadboard (170×10×55) at x=-50
const breadboard = new THREE.Group();
breadboard.add(makeBox(170, 10, 55, mat(0xffffff, 0.5, 0.02), 0, 5, 0));
// R1 resistor (cylinder)
const r1Geo = new THREE.CylinderGeometry(4, 4, 30, 12);
const r1 = new THREE.Mesh(r1Geo, mat(0x8d6e63, 0.5, 0.3));
r1.rotation.z = Math.PI/2;
r1.position.set(-30, 12, 0);
r1.castShadow = true;
breadboard.add(r1);
// R2 resistor
const r2Geo = new THREE.CylinderGeometry(4, 4, 30, 12);
const r2 = new THREE.Mesh(r2Geo, mat(0x8d6e63, 0.5, 0.3));
r2.rotation.z = Math.PI/2;
r2.position.set(30, 12, 0);
r2.castShadow = true;
breadboard.add(r2);
breadboard.position.set(-50, 0, 30);
scene.add(breadboard);

// DMM (120×60×40) at x=180, z=-80
const dmm = new THREE.Group();
dmm.add(makeBox(120, 60, 40, mat(0x263238, 0.6, 0.2), 0, 30, 0));
dmm.add(makeBox(100, 40, 5, mat(0x0d47a1, 0.3, 0.1), 0, 35, 22));
dmm.position.set(-180, 0, 100);
scene.add(dmm);

// ===== UI elements =====
const banner = document.getElementById('state-banner');
const roU2 = document.getElementById('roU2');
const roI = document.getElementById('roI');
const roDev = document.getElementById('roDev');
const roR2 = document.getElementById('roR2');
const roTags = document.getElementById('roTags');
const logBox = document.getElementById('log');
const gatesEl = document.getElementById('gates');
const statusBar = document.getElementById('status-bar');
const partList = document.getElementById('part-list');
const partDetail = document.getElementById('part-detail');

function log(msg, cls='') {
  const d = document.createElement('div');
  if(cls) d.className = cls;
  d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  logBox.appendChild(d);
  logBox.scrollTop = logBox.scrollHeight;
}

let selectedPart = null;
let explodeTarget = 0;
let explodeCurrent = 0;

// Build part list
Object.values(parts).forEach(p => {
  const item = document.createElement('div');
  item.className = 'part-item';
  item.textContent = p.group.userData.id + ' ' + p.group.userData.name;
  item.addEventListener('click', () => selectPart(p.group.userData.id));
  partList.appendChild(item);
});

function selectPart(id) {
  selectedPart = id;
  document.querySelectorAll('.part-item').forEach((el, i) => {
    const pid = Object.keys(parts)[i];
    el.classList.toggle('selected', pid === id);
  });
  const p = parts[id];
  partDetail.innerHTML = '<strong>' + p.group.userData.id + ' ' + p.group.userData.name + '</strong><br>' + p.group.userData.desc;
}

// Explode slider
document.getElementById('explode-slider').addEventListener('input', (e) => {
  explodeTarget = parseFloat(e.target.value);
});

function updateExplode() {
  explodeCurrent += (explodeTarget - explodeCurrent) * 0.1;
  Object.entries(parts).forEach(([id, p]) => {
    const offset = explodeCurrent * 60;
    // Direction based on part id
    const dirs = {
      B01: new THREE.Vector3(0, -offset*0.3, 0),
      B02: new THREE.Vector3(0, offset*0.2, 0),
      B03: new THREE.Vector3(0, 0, offset),
      B04: new THREE.Vector3(0, 10, offset*1.2),
      B05: new THREE.Vector3(0, -20, offset*1.2),
      B06: new THREE.Vector3(0, offset*1.5, 0),
      B07: new THREE.Vector3(0, offset*2, 0),
      B08: new THREE.Vector3(0, -30, offset*1.2),
      B09: new THREE.Vector3(offset*1.5, 0, 0),
      B10: new THREE.Vector3(0, 0, -offset*0.5)
    };
    p.group.position.copy(p.homePos).add(dirs[id] || new THREE.Vector3());
  });
}

// ===== State transition =====
function transitionTo(target) {
  const prev = state.current;
  const prevIdx = ORDER.indexOf(prev), tgtIdx = ORDER.indexOf(target);
  if(tgtIdx <= ORDER.indexOf("S3")) {
    state.studentReplaced = false; state.safetyConfirmed = false; state.reflectionDone = false;
    state.teacherTakeover = false; state.teacherPowerOff = false; state.teacherPartCheck = false;
  }
  if(target === "S4") { state.safetyConfirmed = false; state.reflectionDone = false; }
  if(target === "S5") { state.reflectionDone = false; }
  state.current = target;
  renderState();
  log(STATES[target].log, STATES[target].cls === "S2" ? "err" : STATES[target].cls === "S1" || STATES[target].cls === "S3" || STATES[target].cls === "S5" ? "warn" : "ok");
}

function renderState() {
  const s = STATES[state.current];
  banner.textContent = s.name;
  banner.className = s.cls;
  roU2.textContent = s.u2 === "—" ? "—" : s.u2 + " V";
  roI.textContent = s.i === "—" ? "—" : s.i + " mA";
  roDev.textContent = s.dev;
  roR2.textContent = s.r2 + (s.r2.indexOf("k") >= 0 || s.r2 === "—" ? "" : " kΩ");
  roTags.innerHTML = s.tags.map(t => '<span class="tag">' + t + '</span>').join('');

  // LED color
  const ledColors = { green:0x2e7d32, yellow:0xf57f17, red:0xc62828, blue:0x1565c0 };
  ledMesh.material.color.setHex(ledColors[s.led] || 0x00838f);

  // Head animation targets
  const headTargets = {
    frown: { yaw:-0.3, tilt:0.15 },
    concerned: { yaw:0.2, tilt:0.1 },
    neutral: { yaw:0, tilt:0.2 },
    happy: { yaw:0.15, tilt:-0.05 }
  };
  headTargetYaw = headTargets[s.face].yaw;
  headTargetTilt = headTargets[s.face].tilt;

  updateGates();
  updateStatus();
}

function updateGates() {
  const st = state.current, role = state.currentRole;
  let html = '';
  html += '<label style="display:block;font-size:11px;margin:2px 0;"><input type="checkbox" id="chkPowerOff" ' + (state.teacherPowerOff ? 'checked' : '') + ' ' + (st !== "S3" || role !== "teacher" ? 'disabled' : '') + '> 教师：已指导断电（演示动作）</label>';
  html += '<label style="display:block;font-size:11px;margin:2px 0;"><input type="checkbox" id="chkPartCheck" ' + (state.teacherPartCheck ? 'checked' : '') + ' ' + (st !== "S3" || role !== "teacher" ? 'disabled' : '') + '> 教师：已核对元件标称（演示）</label>';
  html += '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">';
  html += '<button id="btnTakeover" ' + (!(st === "S2" && role === "teacher" && !state.teacherTakeover) ? 'disabled' : '') + '>教师已接管(模拟)</button>';
  html += '<button id="btnTeacherDone" ' + (!(st === "S3" && role === "teacher" && state.teacherPowerOff && state.teacherPartCheck) ? 'disabled' : '') + '>教师核验完成(S3)</button>';
  html += '<button id="btnStudentReplace" ' + (!(st === "S4" && role === "student") ? 'disabled' : '') + '>学生确认更换 R2</button>';
  html += '<button id="btnSafetyConfirm" ' + (!(st === "S5" && role === "teacher" && !state.safetyConfirmed) ? 'disabled' : '') + '>教师安全确认(独立门)</button>';
  html += '</div>';
  gatesEl.innerHTML = html;

  // Attach event listeners
  const chkP = document.getElementById('chkPowerOff');
  const chkC = document.getElementById('chkPartCheck');
  if(chkP) chkP.onchange = () => { state.teacherPowerOff = chkP.checked; updateGates(); };
  if(chkC) chkC.onchange = () => { state.teacherPartCheck = chkC.checked; updateGates(); };
  const bt = document.getElementById('btnTakeover');
  if(bt) bt.onclick = () => { state.teacherTakeover = true; log('[教师] 已接管本案例，进入核验。','ok'); updateGates(); };
  const btd = document.getElementById('btnTeacherDone');
  if(btd) btd.onclick = () => { log('[教师] 核验完成，发现 R2=1kΩ 错件。','ok'); transitionTo("S4"); };
  const bsr = document.getElementById('btnStudentReplace');
  if(bsr) bsr.onclick = () => { state.studentReplaced = true; log('[学生] 已断电更换 R2=2kΩ。','ok'); updateGates(); };
  const bsc = document.getElementById('btnSafetyConfirm');
  if(bsc) bsc.onclick = () => { state.safetyConfirmed = true; log('[教师] 独立安全确认，允许通电复测。','ok'); updateGates(); };
}

function updateStatus() {
  statusBar.textContent = state.current + ' | zoom ' + camera.position.distanceTo(controls.target).toFixed(0) + ' | head yaw ' + headYaw.toFixed(2);
}

// ===== Head animation =====
let headYaw = 0, headTilt = 0;
let headTargetYaw = 0, headTargetTilt = 0;
let headElapsed = 0;
let headAnimating = false;

function startHeadTween() {
  headElapsed = 0;
  headAnimating = true;
}

// ===== Buttons =====
document.getElementById('btnNext').addEventListener('click', () => {
  const idx = ORDER.indexOf(state.current);
  if(idx >= ORDER.length - 1) return;
  const next = ORDER[idx + 1];
  if(state.current === "S2" && next === "S3" && !state.teacherTakeover) { log("门禁：教师须先接管。","err"); return; }
  if(state.current === "S3" && next === "S4" && !(state.teacherPowerOff && state.teacherPartCheck)) { log("门禁：教师须勾选两项。","err"); return; }
  if(state.current === "S4" && next === "S5" && !state.studentReplaced) { log("门禁：学生须先更换。","err"); return; }
  if(state.current === "S5" && next === "S6" && !state.safetyConfirmed) { log("门禁：须教师安全确认。","err"); return; }
  transitionTo(next);
});

document.getElementById('btnPrev').addEventListener('click', () => {
  const idx = ORDER.indexOf(state.current);
  if(idx > 0) transitionTo(ORDER[idx - 1]);
});

document.getElementById('btnReset').addEventListener('click', () => {
  stopAuto();
  state.paused = false;
  state.teacherPowerOff = false; state.teacherPartCheck = false;
  state.studentReplaced = false; state.safetyConfirmed = false;
  state.teacherTakeover = false; state.reflectionDone = false;
  state.currentRole = "teacher";
  logBox.innerHTML = '';
  transitionTo("S0");
  log("已重置。","ok");
});

document.getElementById('btnPause').addEventListener('click', () => {
  if(state.auto) { stopAuto(); }
  state.paused = true;
  log("已暂停（动画冻结）。","warn");
});

// Auto demo
let autoTimer = null;
function startAuto() {
  state.auto = true; state.paused = false;
  log("自动演示开始。","warn");
  autoTimer = setInterval(autoStep, 2500);
}
function stopAuto() {
  state.auto = false;
  if(autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}
function autoStep() {
  const idx = ORDER.indexOf(state.current);
  if(idx >= ORDER.length - 1) {
    if(!state.reflectionDone) {
      state.currentRole = "student";
      state.reflectionDone = true;
      log("[自动扮演] 学生输入示例反思。本页内存记录。","warn");
      renderState();
    }
    stopAuto(); log("自动演示完成。","ok"); return;
  }
  const next = ORDER[idx + 1];
  if(state.current === "S2" && next === "S3") {
    state.currentRole = "teacher";
    state.teacherTakeover = true;
    log("[自动扮演] 教师接管本案例。","warn");
  }
  if(next === "S4") { state.teacherPowerOff = true; state.teacherPartCheck = true; log("[自动扮演] 教师勾选两项。","warn"); }
  if(next === "S5") { state.currentRole = "student"; state.studentReplaced = true; log("[自动扮演] 学生更换 R2。","warn"); }
  if(next === "S6") { state.currentRole = "teacher"; state.safetyConfirmed = true; log("[自动扮演] 教师安全确认。","warn"); }
  transitionTo(next);
}

document.getElementById('btnPlay').addEventListener('click', () => {
  if(state.paused) {
    state.paused = false;
    if(state.auto) { autoTimer = setInterval(autoStep, 2500); }
  } else {
    if(state.current !== "S0") document.getElementById('btnReset').click();
    startAuto();
  }
});

// View buttons
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.view;
    const views = {
      front: { pos:[0, 80, 280], target:[0, 60, 0] },
      iso: { pos:[180, 140, 220], target:[0, 40, 0] },
      side: { pos:[280, 80, 0], target:[0, 60, 0] },
      top: { pos:[0, 280, 0.1], target:[0, 0, 0] }
    };
    if(views[v]) {
      camera.position.set(...views[v].pos);
      controls.target.set(...views[v].target);
    }
  });
});

document.getElementById('btnZoomIn').addEventListener('click', () => {
  camera.position.multiplyScalar(0.85);
});
document.getElementById('btnZoomOut').addEventListener('click', () => {
  camera.position.multiplyScalar(1.15);
});

// Role buttons
document.getElementById('roleTeacher').addEventListener('click', () => {
  state.currentRole = "teacher";
  document.getElementById('roleTeacher').classList.add('active');
  document.getElementById('roleStudent').classList.remove('active');
  updateGates();
});
document.getElementById('roleStudent').addEventListener('click', () => {
  state.currentRole = "student";
  document.getElementById('roleStudent').classList.add('active');
  document.getElementById('roleTeacher').classList.remove('active');
  updateGates();
});

// Tabs
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// GLB Export
document.getElementById('btnExportAll').addEventListener('click', () => {
  const exporter = new GLTFExporter();
  exporter.parse(robotGroup, (result) => {
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'robot_full.glb'; a.click();
    log("已导出整机 GLB。","ok");
  }, (err) => { log("导出失败: " + err, "err"); }, { binary: true });
});

document.getElementById('btnExportPart').addEventListener('click', () => {
  if(!selectedPart) { log("请先选择部件。","warn"); return; }
  const exporter = new GLTFExporter();
  exporter.parse(parts[selectedPart].group, (result) => {
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = selectedPart + '.glb'; a.click();
    log("已导出 " + selectedPart + " GLB。","ok");
  }, (err) => { log("导出失败: " + err, "err"); }, { binary: true });
});

// ===== Public interface (read-only observation) =====
window.demo = {
  getState: () => Object.assign({}, state),
  getSnapshot: () => ({
    state: state.current,
    stateName: STATES[state.current].name,
    head: { yaw: headYaw, tilt: headTilt }
  }),
  reset: () => document.getElementById('btnReset').click()
};

// ===== Animation loop =====
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  if(!state.paused) {
    // Head tween
    if(headAnimating) {
      headElapsed += dt;
      const t = Math.min(1, headElapsed / 800);
      const e = t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;
      headYaw = headTargetYaw * e;
      headTilt = headTargetTilt * e;
      if(t >= 1) headAnimating = false;
    }
    b07.rotation.y = headYaw;
    b07.rotation.x = headTilt;

    // Explode animation
    updateExplode();
  }

  controls.update();
  renderer.render(scene, camera);
}

// Initial render
renderState();
log("原型加载完成：S0 理论示例。","ok");
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
});
