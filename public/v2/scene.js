// scene.js — CircuitBridge 3D product scene module
// Exports createProductScene(container, {onProbeSelect}) with clean API
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFExporter } from '../vendor/GLTFExporter.js';

// ===== Helpers =====
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w/2+r, -h/2);
  s.lineTo(w/2-r, -h/2);
  s.quadraticCurveTo(w/2, -h/2, w/2, -h/2+r);
  s.lineTo(w/2, h/2-r);
  s.quadraticCurveTo(w/2, h/2, w/2-r, h/2);
  s.lineTo(-w/2+r, h/2);
  s.quadraticCurveTo(-w/2, h/2, -w/2, h/2-r);
  s.lineTo(-w/2, -h/2+r);
  s.quadraticCurveTo(-w/2, -h/2, -w/2+r, -h/2);
  s.closePath();
  return s;
}

// ===== Materials =====
const matShell = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6, metalness: 0.05 });
const matShellInner = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.7 });
const matGraphite = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.3 });
const matBlack = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const matTeal = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.3, emissive: 0x00838f, emissiveIntensity: 0.3 });
const matPCB = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.6 });
const matCopper = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.4, metalness: 0.8 });
const matMetal = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.3, metalness: 0.9 });

// ===== Scene Factory =====
export function createProductScene(container, opts = {}) {
  const onProbeSelect = opts.onProbeSelect || (() => {});

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Scene & camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeee8de);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  camera.position.set(300, 250, 400);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  controls.minDistance = 80;
  controls.maxDistance = 800;

  // Lights
  const hemi = new THREE.HemisphereLight(0xfff5e6, 0x8d6e63, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff8e7, 1.2);
  key.position.set(200, 350, 200);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -300; key.shadow.camera.right = 300;
  key.shadow.camera.top = 300; key.shadow.camera.bottom = -300;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb3e5fc, 0.3);
  fill.position.set(-150, 200, -150);
  scene.add(fill);

  // Desk
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(600, 8, 400),
    new THREE.MeshStandardMaterial({ color: 0xd7ccc0, roughness: 0.8 })
  );
  desk.position.y = -4;
  desk.receiveShadow = true;
  scene.add(desk);

  // Robot root
  const robot = new THREE.Group();
  scene.add(robot);

  // Parts registry
  const parts = {};
  function addPart(id, name, desc, group) {
    group.userData = { id, name, desc, homePos: group.position.clone() };
    robot.add(group);
    parts[id] = {
      group,
      homePos: group.position.clone(),
      homeQuat: group.quaternion.clone(),
      homeScale: group.scale.clone(),
      name, desc,
    };
  }

  // ===== B01: 圆角底座 =====
  {
    const g = new THREE.Group();
    const baseShape = roundedRectShape(178, 150, 40);
    // 6 real through-holes (Shape holes, not solid cylinders)
    [[-70,-55], [70,-55], [-70,55], [70,55], [0,-65], [0,65]].forEach(([x,y]) => {
      const hole = new THREE.Path();
      hole.absarc(x, y, 3, 0, Math.PI * 2, true);
      baseShape.holes.push(hole);
    });
    const baseGeom = new THREE.ExtrudeGeometry(baseShape, { depth: 25, bevelEnabled: true, bevelThickness: 4, bevelSize: 4, bevelSegments: 3 });
    baseGeom.rotateX(-Math.PI / 2); // XY plane → XZ plane (lay flat)
    baseGeom.translate(0, 12.5, 0); // center at y=12.5
    const base = new THREE.Mesh(baseGeom, matGraphite);
    base.castShadow = true;
    g.add(base);
    g.position.set(0, 0, 0);
    addPart('B01', '圆角底座', '低重心圆角矩形底座，6真通孔', g);
  }

  // ===== B02: 中空主壳 =====
  {
    const g = new THREE.Group();
    const outerW = 180, outerH = 150, wallT = 6;

    // Back wall with USB port opening
    const backShape = roundedRectShape(outerW, outerH, 18);
    const usbHole = new THREE.Path();
    usbHole.moveTo(50, -50); usbHole.lineTo(80, -50); usbHole.lineTo(80, -40); usbHole.lineTo(50, -40);
    usbHole.closePath();
    backShape.holes.push(usbHole);
    const backGeom = new THREE.ExtrudeGeometry(backShape, { depth: wallT, bevelEnabled: false });
    backGeom.translate(0, 0, -65);
    g.add(new THREE.Mesh(backGeom, matShell));

    // Top / bottom walls
    const topGeom = new THREE.BoxGeometry(outerW - wallT*2, wallT, 130);
    const topWall = new THREE.Mesh(topGeom, matShell);
    topWall.position.set(0, outerH/2 - wallT/2, 0);
    g.add(topWall);
    const bottomWall = new THREE.Mesh(topGeom, matShell);
    bottomWall.position.set(0, -outerH/2 + wallT/2, 0);
    g.add(bottomWall);

    // Left wall with 6 true ventilation slots
    const leftShape = new THREE.Shape();
    leftShape.moveTo(-65, -outerH/2+wallT);
    leftShape.lineTo(65, -outerH/2+wallT);
    leftShape.lineTo(65, outerH/2-wallT);
    leftShape.lineTo(-65, outerH/2-wallT);
    leftShape.closePath();
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Path();
      const y = -30 + i * 12;
      slot.moveTo(-45, y-2.5); slot.lineTo(45, y-2.5); slot.lineTo(45, y+2.5); slot.lineTo(-45, y+2.5);
      slot.closePath();
      leftShape.holes.push(slot);
    }
    const leftGeom = new THREE.ExtrudeGeometry(leftShape, { depth: wallT, bevelEnabled: false });
    leftGeom.rotateY(Math.PI/2);
    leftGeom.translate(-outerW/2 + wallT, 0, 0);
    g.add(new THREE.Mesh(leftGeom, matShell));

    // Right wall
    const rightGeom = new THREE.BoxGeometry(wallT, outerH - wallT*2, 130);
    const rightWall = new THREE.Mesh(rightGeom, matShell);
    rightWall.position.set(outerW/2 - wallT/2, 0, 0);
    g.add(rightWall);

    // 4 hollow stand-offs
    [[-60,-40], [60,-40], [-60,40], [60,40]].forEach(([x,y]) => {
      const postOuter = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 12, 16), matShellInner);
      postOuter.position.set(x, y, -55);
      g.add(postOuter);
      const postHole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 13, 12), matBlack);
      postHole.position.set(x, y, -55);
      g.add(postHole);
    });

    g.position.set(0, 95, 0);
    addPart('B02', '中空主壳', '中空弧形主壳，壁厚6mm，左侧6透空槽，背板USB口，内4空心螺柱', g);
  }

  // ===== B03: 前盖屏窗 =====
  {
    const g = new THREE.Group();
    const plateW = 178, plateH = 148;
    const plateShape = roundedRectShape(plateW, plateH, 20);
    // Screen window: 130x72, offset up 15mm
    const win = new THREE.Path();
    const sw = 130, sh = 72, sr = 10, wy = 15;
    win.moveTo(-sw/2+sr, wy-sh/2);
    win.lineTo(sw/2-sr, wy-sh/2);
    win.quadraticCurveTo(sw/2, wy-sh/2, sw/2, wy-sh/2+sr);
    win.lineTo(sw/2, wy+sh/2-sr);
    win.quadraticCurveTo(sw/2, wy+sh/2, sw/2-sr, wy+sh/2);
    win.lineTo(-sw/2+sr, wy+sh/2);
    win.quadraticCurveTo(-sw/2, wy+sh/2, -sw/2, wy+sh/2-sr);
    win.lineTo(-sw/2, wy-sh/2+sr);
    win.quadraticCurveTo(-sw/2, wy-sh/2, -sw/2+sr, wy-sh/2);
    win.closePath();
    plateShape.holes.push(win);
    // 4 screw holes
    [[-78,-62], [78,-62], [-78,62], [78,62]].forEach(([x,y]) => {
      const hole = new THREE.Path();
      hole.absellipse(x, y, 2.5, 2.5, 0, Math.PI*2, true);
      plateShape.holes.push(hole);
    });
    const plateGeom = new THREE.ExtrudeGeometry(plateShape, { depth: 5, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 3 });
    const plate = new THREE.Mesh(plateGeom, matShell);
    plate.castShadow = true;
    g.add(plate);
    g.position.set(0, 95, 66);
    addPart('B03', '前盖屏窗', '完整前盖板，178x148，矩形屏窗+4真螺钉孔', g);
  }

  // ===== B04: 显示模块 =====
  let screenCanvas, screenCtx, screenTex;
  {
    const g = new THREE.Group();
    // Thin PCB back plate (1mm thick, real mesh)
    const pcbBack = new THREE.Mesh(
      new THREE.BoxGeometry(128, 70, 1),
      new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.6 })
    );
    g.add(pcbBack);
    // Screen face with texture
    screenCanvas = document.createElement('canvas');
    screenCanvas.width = 256; screenCanvas.height = 160;
    screenCtx = screenCanvas.getContext('2d');
    drawScreen('Ready', 'neutral');
    screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(127, 69),
      new THREE.MeshStandardMaterial({ map: screenTex, roughness: 0.2 })
    );
    screen.position.set(0, 0, 0.55);
    g.add(screen);
    g.position.set(0, 110, 72);
    addPart('B04', '显示模块', '宽屏显示，表情与读数动态，嵌入前盖屏窗', g);
  }

  function drawScreen(text, mode = 'neutral') {
    const ctx = screenCtx;
    ctx.fillStyle = '#1a3a5c'; ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(80, 55, 16, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(176, 55, 16, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath();
    if (mode === 'error') ctx.arc(128, 90, 30, 1.2*Math.PI, 1.8*Math.PI);
    else ctx.arc(128, 75, 30, 0.2*Math.PI, 0.8*Math.PI);
    ctx.stroke();
    // Label line
    ctx.fillStyle = '#80cbc4'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    const labels = { neutral: 'READY', predict: 'PREDICT', measure: 'MEASURE', error: 'ERROR' };
    ctx.fillText(labels[mode] || 'READY', 128, 125);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace';
    ctx.fillText(text, 128, 145);
    if (screenTex) screenTex.needsUpdate = true;
  }

  // ===== B05: LED灯条 (moved forward to z=70, in front of plate) =====
  {
    const g = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.BoxGeometry(160, 3, 6), matTeal);
    strip.castShadow = true;
    g.add(strip);
    g.position.set(0, 28, 70);
    addPart('B05', 'LED灯条', '下唇LED灯条，薄嵌式自发光', g);
  }

  // ===== B06: 短颈支架 =====
  {
    const g = new THREE.Group();
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(12, 15, 40, 16), matGraphite);
    neck.castShadow = true;
    g.add(neck);
    g.position.set(0, 180, -20);
    addPart('B06', '短颈支架', '短颈支架，连接头舱', g);
  }

  // ===== B07: 俯拍镜头头舱 =====
  let fovConeMesh = null;
  {
    const g = new THREE.Group();
    const headShape = roundedRectShape(55, 28, 14);
    const headGeom = new THREE.ExtrudeGeometry(headShape, { depth: 45, bevelEnabled: true, bevelThickness: 6, bevelSize: 6, bevelSegments: 4 });
    headGeom.translate(0, 0, -22.5);
    const head = new THREE.Mesh(headGeom, matShell);
    head.castShadow = true;
    g.add(head);
    // Lens: center at z=34, outside head front (max z = 22.5+6=28.5, 5.5mm clearance)
    // Direction a = (0, -sin30°, cos30°) = (0, -0.5, 0.866)
    const lensGroup = new THREE.Group();
    lensGroup.position.set(0, 0, 34);
    lensGroup.rotation.x = Math.PI/2 - Math.PI/6;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 6, 24), matBlack);
    lensGroup.add(lens);
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 1.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.1, metalness: 0.5 })
    );
    glass.position.z = 4;
    lensGroup.add(glass);
    g.add(lensGroup);
    // FOV cone: from lens to desk
    // Head at y=210, direction (0,-0.5,0.866). Length = 210/0.5 = 420mm
    const coneLen = 420;
    const coneGeom = new THREE.ConeGeometry(35, coneLen, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x00838f, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    fovConeMesh = new THREE.Mesh(coneGeom, coneMat);
    fovConeMesh.name = 'fovCone';
    fovConeMesh.userData.isHelper = true;
    fovConeMesh.rotation.x = Math.PI * 2/3; // +y → (0,-0.5,0.866)
    fovConeMesh.position.set(0, -105, 196);
    fovConeMesh.visible = false;
    g.add(fovConeMesh);
    g.position.set(0, 210, -20);
    addPart('B07', '俯拍镜头头舱', '圆角长条头舱，镜头俯角30°面向桌面实验区', g);
  }

  // ===== B08: 侧维护板 =====
  {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4, 90, 110), matShellInner);
    g.add(panel);
    [[-35,-25], [35,-25], [-35,25], [35,25]].forEach(([x,y]) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 12), matMetal);
      screw.rotation.z = Math.PI/2;
      screw.position.set(2.5, y, x);
      g.add(screw);
    });
    g.position.set(92, 95, 0);
    addPart('B08', '侧维护板', '右侧维护板，4颗十字沉头螺钉', g);
  }

  // ===== B09: 格栅盖板 =====
  {
    const g = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(3, 50, 90), matGraphite);
    g.add(cover);
    g.position.set(-92, 110, 0);
    addPart('B09', '格栅盖板', '左侧格栅盖板，覆盖6透空槽', g);
  }

  // ===== B10: PCB承载板 =====
  {
    const g = new THREE.Group();
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(130, 2, 90), matPCB);
    g.add(pcb);
    [[-40,-20], [0,-20], [40,-20], [-40,20], [0,20], [40,20]].forEach(([x,y]) => {
      const comp = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), matBlack);
      comp.position.set(x, 4, y);
      g.add(comp);
    });
    // Wires
    const wire1 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 35, 8), matCopper);
    wire1.rotation.z = Math.PI/2; wire1.position.set(-62, 5, -20); g.add(wire1);
    const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 8), matCopper);
    wire2.rotation.z = Math.PI/2; wire2.position.set(20, 5, -20); g.add(wire2);
    const wire3 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 120, 8), matCopper);
    wire3.rotation.z = Math.PI/2; wire3.position.set(0, 5, 20); g.add(wire3);
    [[-65,-20], [65,-20], [-65,20], [65,20]].forEach(([x,y]) => {
      const conn = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 8), matBlack);
      conn.rotation.z = Math.PI/2; conn.position.set(x, 5, y); g.add(conn);
    });
    g.position.set(0, 75, 0);
    addPart('B10', 'PCB承载板', '内部PCB板，6元件+3束连接线带端点连接器', g);
  }

  // ===== Lab equipment =====
  const psu = new THREE.Group();
  const psuBody = new THREE.Mesh(new THREE.BoxGeometry(70, 50, 45), matGraphite);
  psuBody.position.y = 25; psuBody.castShadow = true;
  psu.add(psuBody);
  psu.position.set(-220, 0, -80);
  scene.add(psu);

  // Breadboard with probes (P/N/G clickable spheres)
  const bb = new THREE.Group();
  const bbBase = new THREE.Mesh(new THREE.BoxGeometry(110, 8, 70), matShell);
  bbBase.position.y = 4; bbBase.receiveShadow = true;
  bb.add(bbBase);
  // Probe spheres
  const probeColors = { P: 0xd32f2f, N: 0x1976d2, G: 0x388e3c };
  const probeMeshes = {};
  [['P', -30, 15], ['N', 0, 15], ['G', 30, 15]].forEach(([name, x, z]) => {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      new THREE.MeshStandardMaterial({ color: probeColors[name], roughness: 0.4, emissive: probeColors[name], emissiveIntensity: 0.2 })
    );
    s.position.set(x, 12, z);
    s.userData.probeName = name;
    bb.add(s);
    probeMeshes[name] = s;
  });
  bb.position.set(0, 0, 40);
  scene.add(bb);

  // Raycaster for probe clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(Object.values(probeMeshes));
    if (hits.length > 0) {
      onProbeSelect(hits[0].object.userData.probeName);
    }
  });

  // ===== Explosion =====
  let explodeTarget = 0, explodeCurrent = 0;
  let cameraFitPending = false;
  const explodeDirs = {
    B01: [0, -25, 0], B02: [0, 0, 0], B03: [0, 10, 70], B04: [0, 15, 100],
    B05: [0, -15, 60], B06: [0, 70, 0], B07: [0, 130, 0],
    B08: [110, 0, 0], B09: [-110, 0, 0], B10: [0, 0, -50]
  };

  function updateExplode() {
    explodeCurrent += (explodeTarget - explodeCurrent) * 0.08;
    Object.keys(parts).forEach(id => {
      const d = explodeDirs[id] || [0, 0, 0];
      parts[id].group.position.copy(parts[id].homePos);
      parts[id].group.position.x += d[0] * explodeCurrent;
      parts[id].group.position.y += d[1] * explodeCurrent;
      parts[id].group.position.z += d[2] * explodeCurrent;
    });
    // Auto-fit camera during explosion animation
    if (cameraFitPending && Math.abs(explodeTarget - explodeCurrent) < 2) {
      cameraFitPending = false;
      const box = new THREE.Box3();
      Object.values(parts).forEach(p => { if (p.group.visible) box.expandByObject(p.group); });
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 1.6;
        controls.target.copy(center);
        camera.position.set(center.x + dist*0.6, center.y + dist*0.5, center.z + dist*0.7);
      }
    }
  }

  // ===== Camera fit helpers =====
  function fitCameraToObject(obj, padding = 1.2) {
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * padding;
    controls.target.copy(center);
    return { center, dist };
  }

  // ===== Public API =====
  let selectedPartId = null;
  let modelMode = false;

  return {
    // Update scene from lab snapshot (called by external UI)
    updateLab(snapshot) {
      if (!snapshot) return;
      // Reset probe highlights first
      Object.values(probeMeshes).forEach(m => { m.material.emissiveIntensity = 0.2; });

      // Update screen based on phase and data
      if (snapshot.lastMeasurement && snapshot.lastMeasurement.value !== undefined && snapshot.lastMeasurement.value !== null) {
        const v = snapshot.lastMeasurement.value;
        const usable = snapshot.lastMeasurement.usable !== false;
        const nodes = snapshot.probes ? `${snapshot.probes.a}${snapshot.probes.b}` : 'U2';
        drawScreen(`${nodes}=${v.toFixed(2)}V`, usable ? 'measure' : 'error');
        // Highlight active probes
        if (snapshot.probes) {
          [snapshot.probes.a, snapshot.probes.b].forEach(p => {
            if (probeMeshes[p]) probeMeshes[p].material.emissiveIntensity = 0.8;
          });
        }
      } else if (snapshot.prediction && snapshot.prediction.submitted) {
        drawScreen(`Pred ${snapshot.prediction.value.toFixed(2)}V`, 'predict');
      } else if (snapshot.phase === 'closed') {
        drawScreen('DONE', 'neutral');
      } else {
        drawScreen('Ready', 'neutral');
      }
    },

    // Toggle between model viewer and lab scene
    setModelMode(on) {
      modelMode = on;
      psu.visible = !on;
      bb.visible = !on;
      desk.visible = !on;
      const { center, dist } = fitCameraToObject(robot, 1.5);
      camera.position.set(center.x + dist*0.6, center.y + dist*0.4, center.z + dist*0.7);
      controls.target.copy(center);
    },

    // Isolate a single part. null = return assembly.
    selectPart(id) {
      if (!id) { this.returnAssembly(); return true; }
      if (!parts[id]) return false;
      selectedPartId = id;
      Object.keys(parts).forEach(pid => { parts[pid].group.visible = (pid === id); });
      psu.visible = false; bb.visible = false; desk.visible = false;
      const { center, dist } = fitCameraToObject(parts[id].group, 2.5);
      camera.position.set(center.x + dist*0.6, center.y + dist*0.4, center.z + dist*0.7);
      controls.target.copy(center);
      return true;
    },

    // Return to full assembly
    returnAssembly() {
      selectedPartId = null;
      Object.keys(parts).forEach(pid => { parts[pid].group.visible = true; });
      psu.visible = !modelMode; bb.visible = !modelMode; desk.visible = !modelMode;
      const { center, dist } = fitCameraToObject(robot, 1.5);
      camera.position.set(center.x + dist*0.6, center.y + dist*0.4, center.z + dist*0.7);
      controls.target.copy(center);
    },

    // Set explosion amount 0..1
    setExplode(v) {
      explodeTarget = v;
      cameraFitPending = true;
    },

    // Camera views
    setView(view) {
      const { center, dist } = fitCameraToObject(robot, 1.5);
      if (view === 'front') camera.position.set(center.x, center.y, center.z + dist);
      else if (view === 'side') camera.position.set(center.x + dist, center.y, center.z);
      else if (view === 'top') camera.position.set(center.x, center.y + dist, center.z + 0.1);
      else if (view === 'iso') camera.position.set(center.x + dist*0.6, center.y + dist*0.5, center.z + dist*0.7);
      controls.target.copy(center);
    },

    // Toggle FOV cone visibility
    toggleFov(on) { if (fovConeMesh) fovConeMesh.visible = on; },

    // Export GLB (partId null = whole robot). Returns {data, ok, bbox_m, partId}
    async exportModel(opts = {}) {
      const exporter = new GLTFExporter();

      // Remove FOV cone and auxiliary objects recursively
      function removeAuxiliary(root) {
        const toRemove = [];
        root.traverse(child => {
          if (child.name === 'fovCone' || child.userData.isHelper === true) {
            toRemove.push(child);
          }
        });
        toRemove.forEach(c => {
          if (c.parent) c.parent.remove(c);
        });
      }

      // Build a properly scaled meter-space root group
      // mm-space child with position=-center, wrapped in meter root scaled by 0.001
      function buildMeterRoot(mmClone, rootName) {
        // Compute bbox in mm space
        mmClone.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mmClone);
        const center = box.getCenter(new THREE.Vector3());
        // Center the mm-space child
        mmClone.position.sub(center);
        mmClone.updateMatrixWorld(true);
        // Create meter root
        const meterRoot = new THREE.Group();
        meterRoot.name = rootName;
        meterRoot.scale.set(0.001, 0.001, 0.001);
        meterRoot.add(mmClone);
        meterRoot.updateMatrixWorld(true);
        return meterRoot;
      }

      let target;

      if (opts.partId && parts[opts.partId]) {
        const src = parts[opts.partId].group;
        const mmClone = src.clone();
        mmClone.position.copy(parts[opts.partId].homePos);
        mmClone.quaternion.copy(parts[opts.partId].homeQuat);
        mmClone.scale.copy(parts[opts.partId].homeScale);
        removeAuxiliary(mmClone);
        target = buildMeterRoot(mmClone, opts.partId);
      } else {
        // Whole robot: all parts at home pose
        const mmRoot = new THREE.Group();
        Object.entries(parts).forEach(([id, p]) => {
          const partClone = p.group.clone();
          partClone.position.copy(p.homePos);
          partClone.quaternion.copy(p.homeQuat);
          partClone.scale.copy(p.homeScale);
          partClone.visible = true;
          removeAuxiliary(partClone);
          mmRoot.add(partClone);
        });
        target = buildMeterRoot(mmRoot, 'CircuitBridge');
      }

      const arrayBuffer = await exporter.parseAsync(target, {
        binary: true,
        trs: true,
        onlyVisible: false,
      });

      // Return actual bbox in meters
      const box = new THREE.Box3().setFromObject(target);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      return {
        ok: true,
        data: arrayBuffer,
        bbox_m: [size.x, size.y, size.z],
        center_m: [center.x, center.y, center.z],
        partId: opts.partId || 'whole',
      };
    },

    // Get diagnostics
    getDiagnostics() {
      const box = new THREE.Box3().setFromObject(robot);
      const size = box.getSize(new THREE.Vector3());
      return {
        threeRevision: THREE.REVISION,
        rendererInfo: renderer.info,
        visibleParts: Object.keys(parts).filter(id => parts[id].group.visible),
        canvasWidth: renderer.domElement.width,
        canvasHeight: renderer.domElement.height,
        robotBBox: { w: size.x, h: size.y, d: size.z },
        cameraPosition: camera.position.toArray(),
        fovConeVisible: fovConeMesh ? fovConeMesh.visible : false,
      };
    },

    // Resize handler
    resize() {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    // Start render loop
    start() {
      this.resize();
      const animate = () => {
        requestAnimationFrame(animate);
        updateExplode();
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    },

    // Dispose
    dispose() {
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
