// fixtures/scenarios.mjs
// 教学场景与候选假设空间。groundTruth 仅测试使用；engine snapshot 永不暴露。
// mode: 'exploration' 自由探索（学生可 setConfiguration 改电路）；'blind' 盲诊断（actual 隐藏，
//       学生只能测量，改电路须 applyCorrection 经教师批准）。

export const SCENARIOS = {
  // 自由探索：E=5V, R1=1kΩ, R2=2kΩ
  'divider-normal': {
    id: 'divider-normal',
    mode: 'exploration',
    setup: { E: 5, R1: 1000, R2: 2000, topology: 'series' },
    actual: { E: 5, R1: 1000, R2: 2000, topology: 'series' },
    candidates: [
      { id: 'H_correct', desc: '配置正确：E=5V，R1=1kΩ，R2=2kΩ', params: { E: 5, R1: 1000, R2: 2000 }, topology: 'series' },
    ],
    groundTruth: 'H_correct',
  },

  // 盲诊断 A：学生按 E=5/R1=1k/R2=2k 接线，actual 隐藏 —— R2 实际错装 1kΩ
  'divider-ambiguity-wrongR2': {
    id: 'divider-ambiguity-wrongR2',
    mode: 'blind',
    setup: { E: 5, R1: 1000, R2: 2000, topology: 'series' },
    actual: { E: 5, R1: 1000, R2: 1000, topology: 'series' },
    candidates: [
      { id: 'H_correct', desc: '配置正确：E=5V，R1=1kΩ，R2=2kΩ', params: { E: 5, R1: 1000, R2: 2000 }, topology: 'series' },
      { id: 'H_wrongR2', desc: 'R2 错装为 1kΩ（标称 2kΩ）', params: { E: 5, R1: 1000, R2: 1000 }, topology: 'series' },
      { id: 'H_sourceDrift', desc: '电源实际输出 3.75V（设定 5V）', params: { E: 3.75, R1: 1000, R2: 2000 }, topology: 'series' },
    ],
    groundTruth: 'H_wrongR2',
  },

  // 盲诊断 B：同一 U_NG=2.50V，真因为电源偏差
  'divider-ambiguity-source': {
    id: 'divider-ambiguity-source',
    mode: 'blind',
    setup: { E: 5, R1: 1000, R2: 2000, topology: 'series' },
    actual: { E: 3.75, R1: 1000, R2: 2000, topology: 'series' },
    candidates: [
      { id: 'H_correct', desc: '配置正确：E=5V，R1=1kΩ，R2=2kΩ', params: { E: 5, R1: 1000, R2: 2000 }, topology: 'series' },
      { id: 'H_wrongR2', desc: 'R2 错装为 1kΩ（标称 2kΩ）', params: { E: 5, R1: 1000, R2: 1000 }, topology: 'series' },
      { id: 'H_sourceDrift', desc: '电源实际输出 3.75V（设定 5V）', params: { E: 3.75, R1: 1000, R2: 2000 }, topology: 'series' },
    ],
    groundTruth: 'H_sourceDrift',
  },

  // 拓扑对比：R2 短接（N≡G），候选自带 topology 参与判断
  'divider-shorted-r2': {
    id: 'divider-shorted-r2',
    mode: 'exploration',
    setup: { E: 5, R1: 1000, R2: 2000, topology: 'series' },
    actual: { E: 5, R1: 1000, R2: 2000, topology: 'shortedR2' },
    candidates: [
      { id: 'H_correct', desc: '完整串联：E=5V，R1=1kΩ，R2=2kΩ', params: { E: 5, R1: 1000, R2: 2000 }, topology: 'series' },
      { id: 'H_shortedR2', desc: 'R2 被短接，N 点直通地', params: { E: 5, R1: 1000, R2: 2000 }, topology: 'shortedR2' },
    ],
    groundTruth: 'H_shortedR2',
  },
};

export default SCENARIOS;
