// CircuitBridge v3.1 · 循证观察桥 — Scene (contract 1.0)
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GLTFExporter } from '../vendor/GLTFExporter.js';

// Rounded rectangle shape helper
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w/2 + r, -h/2);
  s.lineTo(w/2 - r, -h/2);
  s.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
  s.lineTo(w/2, h/2 - r);
  s.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
  s.lineTo(-w/2 + r, h/2);
  s.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
  s.lineTo(-w/2, -h/2 + r);
  s.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
  return s;
}

export function createProductScene(container, opts = {}) {
  const onTerminalClick = opts.onTerminalClick || (() => {});
  const onWireClick = opts.onWireClick || (() => {});

  // ===== Renderer / Scene / Camera =====
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeee8de);

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1200);
  camera.position.set(-220, 200, 380); // front-left student view

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 100, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 100;
  controls.maxDistance = 800;

  // ===== Lights =====
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff5e6, 1.2);
  key.position.set(150, 350, 250);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -250; key.shadow.camera.right = 250;
  key.shadow.camera.top = 300; key.shadow.camera.bottom = -200;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.3);
  fill.position.set(-200, 150, -100);
  scene.add(fill);

  // ===== Materials =====
  const matFrame = new THREE.MeshStandardMaterial({ color: 0xf0ebe2, roughness: 0.55, metalness: 0.08 });
  const matGraphite = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.45, metalness: 0.4 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6 });
  const matTeal = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.35, emissive: 0x00838f, emissiveIntensity: 0.5 });
  const matBoard = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.75 });
  const matTerminal = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.25, metalness: 0.9, emissive: 0x000000, emissiveIntensity: 0 });
  const matResistor = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.65 });
  const matWireRed = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.4 });
  const matWireBlue = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.4 });
  const matWireBlack = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.4 });

  // ===== Root =====
  const robot = new THREE.Group();
  scene.add(robot);
  const parts = {};
  function addPart(id, name, desc, group) {
    group.userData = { id, name, desc, homePos: group.position.clone(), homeQuat: group.quaternion.clone() };
    robot.add(group);
    parts[id] = { group, homePos: group.position.clone(), homeQuat: group.quaternion.clone(), homeScale: group.scale.clone(), name, desc };
  }

  // ===== B01: Rear base (rounded, z=80..140) =====
  {
    const g = new THREE.Group();
    const shape = roundedRectShape(210, 60, 12);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 28, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 2 });
    geom.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geom, matGraphite);
    m.position.y = 0; m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    g.position.set(0, 0, 110);
    addPart('B01', '后底座', '台架后置圆角基座', g);
  }

  // ===== B02: Left post (rounded column) =====
  {
    const g = new THREE.Group();
    const shape = roundedRectShape(22, 230, 8);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    geom.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geom, matFrame);
    m.position.y = 115; m.castShadow = true;
    g.add(m);
    g.position.set(-95, 28, 110);
    addPart('B02', '左立柱', '观察桥左支撑柱', g);
  }

  // ===== B03: Right post =====
  {
    const g = new THREE.Group();
    const shape = roundedRectShape(22, 230, 8);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    geom.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geom, matFrame);
    m.position.y = 115; m.castShadow = true;
    g.add(m);
    g.position.set(95, 28, 110);
    addPart('B03', '右立柱', '观察桥右支撑柱', g);
  }

  // ===== B04: Rear beam (rounded) =====
  {
    const g = new THREE.Group();
    const shape = roundedRectShape(210, 28, 8);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 24, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    const m = new THREE.Mesh(geom, matFrame);
    m.castShadow = true;
    g.add(m);
    g.position.set(0, 268, 110);
    addPart('B04', '后横梁', '连接两立柱，承载传感臂', g);
  }

  // ===== Shared LED material (F5 fix: all light strips update together) =====
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x00838f, roughness: 0.3, emissive: 0x00838f, emissiveIntensity: 0.6 });

  // ===== B05: Sensor arm — continuous from beam to head (F1 fix: no gaps) =====
  {
    const g = new THREE.Group();
    // Long arm spanning z=0 to z=100, connecting beam to head
    const armShape = roundedRectShape(14, 14, 5);
    const armGeom = new THREE.ExtrudeGeometry(armShape, { depth: 100, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    const arm = new THREE.Mesh(armGeom, matFrame);
    arm.position.set(0, 0, -50); // center at local z=0, spans z=-50..50
    arm.castShadow = true;
    g.add(arm);
    g.position.set(0, 256, 50); // world z center = 50, spans z=0..100
    addPart('B05', '传感横臂', '后梁前伸至传感头，刚性连续支撑', g);
  }

  // ===== B06: Sensor head (rounded housing, lens pointing down) =====
  let sensorHead;
  {
    const g = new THREE.Group();
    // Rounded housing
    const shape = roundedRectShape(55, 38, 12);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 42, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 3 });
    const housing = new THREE.Mesh(geom, matFrame);
    housing.position.z = -21;
    housing.castShadow = true;
    g.add(housing);
    // Lens (visible at bottom, pointing down)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 6, 24), matDark);
    lens.position.y = -21;
    g.add(lens);
    // LED ring around lens (shared material)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 1.8, 8, 24), ledMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -19;
    g.add(ring);
    g.position.set(0, 235, 0);
    sensorHead = g;
    addPart('B06', '传感头舱', '俯视成像头，可见镜头+状态光环', g);
  }

  // ===== B07: Evidence screen (right side, facing operator z<0) =====
  let screenCanvas, screenCtx, screenTex;
  {
    const g = new THREE.Group();
    // Stand base
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 8, 20), matGraphite);
    stand.position.y = 4;
    g.add(stand);
    // Screen body
    const shape = roundedRectShape(130, 90, 10);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    const body = new THREE.Mesh(geom, matGraphite);
    body.position.y = 55; body.castShadow = true;
    g.add(body);
    // Screen face texture
    screenCanvas = document.createElement('canvas');
    screenCanvas.width = 320; screenCanvas.height = 220;
    screenCtx = screenCanvas.getContext('2d');
    screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    drawScreenInit();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(118, 78),
      new THREE.MeshStandardMaterial({ map: screenTex, roughness: 0.25, side: THREE.DoubleSide })
    );
    face.position.set(0, 55, -5.5);
    face.rotation.y = Math.PI;
    g.add(face);
    // Embedded LED strip (shared material, F5 fix)
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 2), ledMat);
    ledStrip.position.set(0, 12, -6);
    g.add(ledStrip);
    g.position.set(140, 0, -20);
    addPart('B07', '证据屏', '侧置竖屏，面向学生操作侧', g);
  }

  // ===== B08: Status light bar (shared material, F5 fix) =====
  {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(100, 4, 3), ledMat);
    g.add(m);
    g.position.set(140, 12, -14);
    addPart('B08', '状态光带', '屏边嵌入式状态灯条', g);
  }

  // ===== B09: Breadboard with terminals, resistors, hole array =====
  const terminals = {};
  let breadboard;
  {
    const g = new THREE.Group();
    // Board base (rounded)
    const shape = roundedRectShape(170, 110, 6);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2 });
    geom.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(geom, matBoard);
    board.position.y = 0; board.receiveShadow = true;
    g.add(board);

    // Hole array (visual pattern, not real holes)
    const holeMat = new THREE.MeshBasicMaterial({ color: 0xd0d0d0 });
    for (let ix = -7; ix <= 7; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const h = new THREE.Mesh(new THREE.CircleGeometry(1.2, 8), holeMat);
        h.rotation.x = -Math.PI / 2;
        h.position.set(ix * 10, 8.2, iz * 10);
        g.add(h);
      }
    }

    // 6 terminals (metal posts with label rings)
    const termDefs = [
      ['E_pos', -55, -25],
      ['R1_a', -18, -25],
      ['R1_b', -18, 25],
      ['R2_a', 18, -25],
      ['R2_b', 18, 25],
      ['E_neg', 55, 25],
    ];
    termDefs.forEach(([id, x, z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 8, 16), matTerminal);
      post.position.set(x, 12, z);
      post.userData.terminalId = id;
      post.castShadow = true;
      g.add(post);
      terminals[id] = post;
    });

    // R1 resistor body (cylinder with color bands)
    const r1Body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 32, 12), matResistor);
    r1Body.rotation.x = Math.PI / 2;
    r1Body.position.set(-18, 12, 0);
    g.add(r1Body);
    // R1 bands
    [-8, 0, 8].forEach(z => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 2, 12), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 }));
      band.rotation.x = Math.PI / 2;
      band.position.set(-18, 12, z);
      g.add(band);
    });

    // R2 resistor body
    const r2Body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 32, 12), matResistor);
    r2Body.rotation.x = Math.PI / 2;
    r2Body.position.set(18, 12, 0);
    g.add(r2Body);
    [-8, 0, 8].forEach(z => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 2, 12), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 }));
      band.rotation.x = Math.PI / 2;
      band.position.set(18, 12, z);
      g.add(band);
    });

    breadboard = g;
    g.position.set(0, 0, -10);
    addPart('B09', '面包板', '操作面，6端子+R1/R2电阻+插孔阵列', g);
  }

  // ===== B10: Power supply (left side, with display) =====
  {
    const g = new THREE.Group();
    const shape = roundedRectShape(45, 50, 6);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 35, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
    const body = new THREE.Mesh(geom, matGraphite);
    body.castShadow = true;
    g.add(body);
    // Small display
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(25, 12), new THREE.MeshStandardMaterial({ color: 0x1b5e20 }));
    disp.position.set(0, 10, 18);
    g.add(disp);
    g.position.set(-140, 25, -10);
    addPart('B10', '电源模块', '侧置数字电源示意', g);
  }

  // ===== B11: Patch wires (3 colored wires with endpoints) =====
  const wireMeshes = [];
  {
    const g = new THREE.Group();
    const wireDefs = [
      ['E_pos', 'R1_a', matWireRed],
      ['R1_b', 'R2_a', matWireBlue],
      ['R2_b', 'E_neg', matWireBlack],
    ];
    wireDefs.forEach(([a, b, mat]) => {
      const ta = terminals[a]; const tb = terminals[b];
      const posA = ta.position.clone(); const posB = tb.position.clone();
      const mid = posA.clone().add(posB).multiplyScalar(0.5);
      mid.y = 16; // arc up slightly
      const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 1.2, 6, false), mat);
      tube.userData.wireA = a; tube.userData.wireB = b;
      g.add(tube);
      wireMeshes.push(tube);
    });
    g.position.set(0, 0, -10);
    addPart('B11', '接线', '3根 patch wire：E_pos-R1_a / R1_b-R2_a / R2_b-E_neg', g);
  }

  // ===== Desk (environment only) =====
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(420, 8, 320),
    new THREE.MeshStandardMaterial({ color: 0xc9b8a0, roughness: 0.9 })
  );
  desk.position.y = -4; desk.receiveShadow = true;
  scene.add(desk);

  // ===== FOV frustum helper (F4 fix: rectangular pinhole frustum, not cone) =====
  let fovCone = null;
  {
    // Lens at y=235, board at y=8, h=227mm
    // HFOV=60° → half-width X = 227*tan(30°) = 131.05mm
    // VFOV=45° → half-depth Z = 227*tan(22.5°) = 94.08mm
    const h = 227;
    const hw = h * Math.tan(Math.PI / 6);   // 131.05
    const hd = h * Math.tan(Math.PI / 8);   // 94.08
    const topHW = 6, topHD = 4; // lens opening
    const verts = new Float32Array([
      // top (lens, y=0 local)
      -topHW, 0, -topHD,  topHW, 0, -topHD,  topHW, 0, topHD,  -topHW, 0, topHD,
      // bottom (board, y=-h local)
      -hw, -h, -hd,  hw, -h, -hd,  hw, -h, hd,  -hw, -h, hd,
    ]);
    const indices = [
      0,1,2, 0,2,3, // top
      4,6,5, 4,7,6, // bottom
      0,4,5, 0,5,1, // front
      1,5,6, 1,6,2, // right
      2,6,7, 2,7,3, // back
      3,7,4, 3,4,0, // left
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x00838f, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    fovCone = new THREE.Mesh(geom, mat);
    fovCone.name = 'fovCone';
    fovCone.userData.isHelper = true;
    fovCone.position.set(0, 235, 0);
    fovCone.visible = false;
    scene.add(fovCone);
  }

  // ===== Screen drawing =====
  function drawScreenInit() {
    const c = screenCtx;
    c.fillStyle = '#0a1628'; c.fillRect(0, 0, 320, 220);
    c.fillStyle = '#e0e0e0'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
    c.fillText('CircuitBridge', 160, 40);
    c.fillStyle = '#80cbc4'; c.font = '12px sans-serif';
    c.fillText('循证观察桥', 160, 62);
    screenTex.needsUpdate = true;
  }
  function drawStatus(status, detail) {
    const c = screenCtx;
    c.fillStyle = '#0a1628'; c.fillRect(0, 0, 320, 220);
    c.fillStyle = '#e0e0e0'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
    c.fillText(status, 160, 40);
    if (detail) {
      c.fillStyle = '#b0bec5'; c.font = '11px sans-serif';
      c.fillText(detail, 160, 65);
    }
    screenTex.needsUpdate = true;
  }

  const statusColors = {
    orientation: 0x9e9e9e, prediction: 0xffb74d, measurement_valid: 0x66bb6a,
    ambiguous: 0xffb74d, invalid_observation: 0xef5350,
    teacher_intervention: 0x42a5f5, evidence_submitted: 0x26c6da, teacher_reviewed: 0x66bb6a,
  };

  // ===== Terminal label sprites (runtime only, excluded from GLB) =====
  const terminalLabels = {};
  function makeLabel(text) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,22,40,0.85)';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 21);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(30, 7.5, 1);
    sprite.userData.isHelper = true;
    return sprite;
  }
  Object.entries(terminals).forEach(([id, mesh]) => {
    const label = makeLabel(id);
    label.position.copy(mesh.position);
    label.position.y += 15;
    mesh.parent.add(label);
    terminalLabels[id] = label;
  });

  // ===== updateScene (F6 full: netMap + observation + manual state) =====
  function updateScene(s) {
    if (!s) return;
    Object.values(terminals).forEach(t => { t.material.emissive.setHex(0x000000); t.material.emissiveIntensity = 0; });

    const netMap = s.terminalNetMap || s.netMap || null;

    let status = s.status || 'orientation';
    let detail = '';
    if (s.teacherReview?.classification) { status = 'teacher_reviewed'; detail = s.teacherReview.classification; }
    else if (s.claim?.submitted) { status = 'evidence_submitted'; detail = 'Claim submitted'; }
    else if (s.teacherIntervention?.confusionClass) { status = 'teacher_intervention'; detail = s.teacherIntervention.confusionClass; }
    else if (s.lastMeasurement?.usable === false) { status = 'invalid_observation'; detail = s.lastMeasurement.reason || 'Invalid'; }
    else if (s.candidatesOpen?.length > 1) { status = 'ambiguous'; detail = s.candidatesOpen.length + ' candidates'; }
    else if (s.lastMeasurement?.value != null) { status = 'measurement_valid'; detail = s.lastMeasurement.value.toFixed(2) + 'V'; }
    else if (s.prediction?.submitted) { status = 'prediction'; detail = (s.prediction.value || 0).toFixed(2) + 'V'; }

    if (s.observation?.mode === 'unknown') { status = 'orientation'; detail = '定位待确认'; }
    if (s.observation?.manualConfirmed) { detail = '手动确认(模拟)'; }

    const color = statusColors[status] || 0x9e9e9e;
    ledMat.emissive.setHex(color);
    ledMat.color.setHex(color);
    drawStatus(status.replace(/_/g, ' '), detail);

    // Update terminal labels with netMap aliases
    Object.entries(terminalLabels).forEach(([tid, label]) => {
      const alias = netMap?.[tid] || tid;
      const ctx = label.material.map.image.getContext('2d');
      ctx.clearRect(0, 0, 128, 32);
      ctx.fillStyle = 'rgba(10,22,40,0.85)';
      ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = s.observation?.mode === 'unknown' ? '#ffb74d' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(alias, 64, 21);
      label.material.map.needsUpdate = true;
    });

    // Occluded terminals → red overlay
    const occluded = s.observation?.occludedTerminals || s.observation?.occludedIds || [];
    occluded.forEach(tid => {
      if (terminals[tid]) {
        terminals[tid].material.emissive.setHex(0xff0000);
        terminals[tid].material.emissiveIntensity = 0.8;
      }
    });

    if (s.probes?.a) {
      ['a','b'].forEach(k => {
        const tid = s.probes[k];
        if (terminals[tid]) { terminals[tid].material.emissive.setHex(0xffeb3b); terminals[tid].material.emissiveIntensity = 0.7; }
      });
      const target = terminals[s.probes.b] || terminals[s.probes.a];
      if (target) {
        const tp = new THREE.Vector3(); target.getWorldPosition(tp);
        sensorHead.lookAt(tp);
      }
    } else if (s.teacherPrompt?.focus) {
      const tid = s.teacherPrompt.focus;
      if (terminals[tid]) {
        const tp = new THREE.Vector3(); terminals[tid].getWorldPosition(tp);
        sensorHead.lookAt(tp);
      }
    } else {
      sensorHead.rotation.set(0, 0, 0);
    }
  }

  // ===== Raycaster =====
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let modelMode = false;
  renderer.domElement.addEventListener('click', (e) => {
    if (modelMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const tHits = raycaster.intersectObjects(Object.values(terminals));
    if (tHits.length > 0) { onTerminalClick(tHits[0].object.userData.terminalId); return; }
    const wHits = raycaster.intersectObjects(wireMeshes);
    if (wHits.length > 0) onWireClick([wHits[0].object.userData.wireA, wHits[0].object.userData.wireB]);
  });

  // ===== Camera fit =====
  function fitView() {
    const box = new THREE.Box3().setFromObject(robot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim / (2 * Math.tan(Math.PI / 9)) * 1.5; // 40° FOV, 1.5x margin
    controls.target.copy(center);
    camera.position.set(center.x - dist * 0.55, center.y + dist * 0.35, center.z + dist * 0.65);
    camera.near = 1;
    camera.far = dist * 5;
    camera.updateProjectionMatrix();
    controls.update();
  }

  // ===== Explosion =====
  let explodeTarget = 0, explodeCurrent = 0;
  const explodeDirs = {
    B01: [0, -20, 0], B02: [-70, 0, 0], B03: [70, 0, 0], B04: [0, 50, 0],
    B05: [0, 30, -40], B06: [0, 70, 0], B07: [120, 0, 0], B08: [120, -20, 0],
    B09: [0, -30, 0], B10: [-120, 0, 0], B11: [0, -50, 0],
  };
  function updateExplode() {
    explodeCurrent += (explodeTarget - explodeCurrent) * 0.08;
    Object.entries(parts).forEach(([id, p]) => {
      const d = explodeDirs[id] || [0,0,0];
      p.group.position.set(p.homePos.x + d[0]*explodeCurrent, p.homePos.y + d[1]*explodeCurrent, p.homePos.z + d[2]*explodeCurrent);
    });
  }

  // ===== Export GLB =====
  async function exportGLB(partId) {
    const exporter = new GLTFExporter();
    function removeAux(root) {
      const toRemove = [];
      root.traverse(c => { if (c.name === 'fovCone' || c.userData.isHelper) toRemove.push(c); });
      toRemove.forEach(c => c.parent && c.parent.remove(c));
    }
    function buildMeter(mmClone, name) {
      mmClone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mmClone);
      const center = box.getCenter(new THREE.Vector3());
      mmClone.position.sub(center);
      const root = new THREE.Group();
      root.name = name; root.scale.set(0.001, 0.001, 0.001);
      root.add(mmClone); root.updateMatrixWorld(true);
      return root;
    }
    let target;
    if (partId && parts[partId]) {
      const c = parts[partId].group.clone();
      c.position.copy(parts[partId].homePos);
      c.quaternion.copy(parts[partId].homeQuat);
      removeAux(c);
      target = buildMeter(c, partId);
    } else {
      const mmRoot = new THREE.Group();
      Object.entries(parts).forEach(([id, p]) => {
        const c = p.group.clone();
        c.position.copy(p.homePos); c.quaternion.copy(p.homeQuat);
        c.visible = true; removeAux(c); mmRoot.add(c);
      });
      target = buildMeter(mmRoot, 'CircuitBridge');
    }
    const data = await exporter.parseAsync(target, { binary: true, trs: true, onlyVisible: false });
    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    return { ok: true, data, bbox_m: [size.x, size.y, size.z], partId: partId || 'whole' };
  }

  // ===== Diagnostics =====
  function getDiagnostics() {
    const box = new THREE.Box3().setFromObject(robot);
    const size = box.getSize(new THREE.Vector3());
    const termDiag = {};
    Object.entries(terminals).forEach(([name, mesh]) => {
      const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
      const proj = wp.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      termDiag[name] = {
        worldXYZ: [wp.x, wp.y, wp.z],
        canvasXY: [(proj.x + 1)/2*rect.width, (1-proj.y)/2*rect.height],
        visible: mesh.visible && !modelMode,
      };
    });
    return {
      threeRevision: THREE.REVISION,
      visibleParts: Object.keys(parts).filter(id => parts[id].group.visible),
      bbox: { w: size.x, h: size.y, d: size.z },
      sensorHeadPos: sensorHead.position.toArray(),
      sensorHeadQuat: sensorHead.quaternion.toArray(),
      ledColor: ledMat.emissive.getHex(),
      terminals: termDiag,
      fovConeVisible: fovCone.visible,
      modelMode,
    };
  }

  function resize() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  let rafId;
  function start() {
    resize(); fitView();
    (function loop() {
      rafId = requestAnimationFrame(loop);
      updateExplode(); controls.update();
      renderer.render(scene, camera);
    })();
  }

  return {
    updateScene,
    setView(v) {
      const c = new THREE.Vector3(0, 100, 0);
      if (v === 'front') camera.position.set(-300, 180, -500);
      else if (v === 'side') camera.position.set(600, 150, 0);
      else if (v === 'top') camera.position.set(0, 600, 0.01);
      else camera.position.set(-320, 220, -450);
      controls.target.copy(c); controls.update();
    },
    setObservationCone(on) { fovCone.visible = on; },
    setPartMode(id) {
      Object.values(parts).forEach(p => p.group.visible = !id || p.id === id);
      modelMode = !!id;
      if (!id) Object.values(parts).forEach(p => p.group.visible = true);
      fitView();
    },
    setExploded(v) { explodeTarget = v; },
    exportGLB,
    getDiagnostics,
    resize, start,
    dispose() { cancelAnimationFrame(rafId); renderer.dispose(); container.removeChild(renderer.domElement); },
  };
}
