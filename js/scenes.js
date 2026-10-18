/* =========================================================
   演示场景：以布局数据（与导出 JSON 相同格式）描述
   ========================================================= */
const R90 = Math.PI / 2;

/** 组件：C(类型, x, y, z, { ry, s, color, name, locked }) */
function C(type, x, y, z, o = {}) {
  const s = o.s === undefined ? [1, 1, 1] : Array.isArray(o.s) ? o.s : [o.s, o.s, o.s];
  const d = { kind: 'component', type, position: [x, y, z], rotation: [0, o.ry || 0, 0], scale: s };
  if (o.color) d.color = o.color;
  if (o.name) d.name = o.name;
  if (o.locked !== undefined) d.locked = o.locked;
  return d;
}
/** 分组：子物体坐标相对分组原点 */
function G(name, x, z, children) {
  return { kind: 'group', name, position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1], children };
}

/* ---------------- 空白场景 ---------------- */
function blank() {
  return {
    env: { name: '空白场景', ground: { w: 60, d: 60, cx: 0, cz: 0 }, groundColor: '#2a3038', background: '#11161d',
      camera: { pos: [22, 18, 26], target: [0, 0, 0] } },
    objects: [],
  };
}

/* ---------------- 通用工厂 ---------------- */
function factory() {
  const o = [];
  o.push(C('cabin', -24, 0, -24, { name: '车间控制室' }));
  // 加工线：数控机床 + 机械臂 + 传送带
  for (let i = 0; i < 4; i++) {
    const x = -18 + i * 6;
    o.push(C('cnc', x, 0, -14));
    o.push(C('robot', x + 2.4, 0, -11.5));
    o.push(C('conveyor', x + 1, 0, -9));
  }
  // 冲压 + 焊接
  for (let i = 0; i < 3; i++) o.push(C('press', -18 + i * 5, 0, 0, { name: `冲压机 ${i + 1}` }));
  for (let i = 0; i < 3; i++) o.push(C('welder', 2 + i * 4, 0, 0));
  o.push(C('paintbooth', 18, 0, 0, { ry: R90 }));
  o.push(C('bridgecrane', -8, 0, -2, { s: [1.6, 1, 1.2], name: '20t 行车' }));
  // 仓储区
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) o.push(C('shelf', -18 + i * 4, 0, 14 + j * 3));
  for (let i = 0; i < 6; i++) o.push(C('pallet', 2 + (i % 3) * 1.6, 0, 14 + Math.floor(i / 3) * 1.4));
  o.push(C('forklift', 0, 0, 20, { ry: -0.6 }));
  o.push(C('agv', 6, 0, 8, { ry: 0.3 }), C('agv', -4, 0, 7));
  o.push(C('machine', 12, 0, 14), C('machine', 16, 0, 14), C('crate', 12, 0, 19), C('crate', 13.2, 0, 19), C('crate', 12.6, 1, 19));
  // 能源区
  o.push(C('tank', 24, 0, -20, { s: 1.4 }), C('tank', 24, 0, -15, { s: 1.4 }), C('pipe', 20, 0, -17.5, { ry: R90 }));
  o.push(C('transformer', 24, 0, 22), C('platform', 18, 0, -22));
  // 围墙
  for (let i = 0; i < 6; i++) o.push(C('fence', -25 + i * 10, 0, -29.5), C('fence', -25 + i * 10, 0, 29.5));
  o.push(C('worker', -6, 0, -6), C('worker', 8, 0, 4, { ry: 1 }), C('cone', -2, 0, 9), C('cone', -1, 0, 9));
  return {
    env: { name: '通用工厂', ground: { w: 60, d: 60, cx: 0, cz: 0 }, groundColor: '#2a3038', background: '#11161d',
      sun: { intensity: 2.4, azimuth: 35, elevation: 55 }, camera: { pos: [34, 30, 40], target: [0, 0, 0] } },
    objects: o,
  };
}

/* ---------------- 造船厂 ----------------
   坐标约定：陆域 z ∈ [-30, 120]，z < -30 为港池水域；码头前沿 z = -30
   1 号干船坞位于 x = -50，沿 z 方向，坞门朝向水域            */
function shipyard() {
  const o = [];
  const dockX = -50;

  // —— 水域与码头 ——
  o.push(C('water', 0, -1.2, -90, { s: [2.2, 1, 1], name: '港池水域', locked: true }));
  for (let x = -110; x <= 110; x += 20) {
    if (Math.abs(x - dockX) < 14) continue;
    o.push(C('quay', x, 0, -27, { name: `码头岸壁 ${(x + 130) / 20}` }));
  }

  // —— 干船坞 + 在建船舶 ——
  o.push(C('drydock', dockX, 0, 10, { ry: R90, name: '1号干船坞' }));
  o.push(C('hullwip', dockX, 1.5, 14, { ry: R90, name: '在建 8.2万吨散货船' }));
  o.push(C('hullblock', dockX, 1.5, -10, { ry: R90, name: '首部分段 B12' }));
  for (const x of [dockX - 17, dockX + 17]) o.push(C('rail', x, 0, 10, { ry: R90, s: [2.1, 1, 1], name: '龙门吊轨道' }));
  o.push(C('gantry', dockX, 0, 22, { name: '800吨龙门起重机' }));
  o.push(C('gantry', dockX, 0, -12, { color: '#d9472b', name: '300吨龙门起重机' }));
  o.push(C('cabin', dockX, 0, 58, { name: '船坞控制室' }));

  // —— 分段堆场（船坞东侧） ——
  o.push(G('分段堆场', -20, 23, [
    C('hullblock', -6, 0, -7), C('hullblock', 6, 0, -7, { color: '#8a6d3b' }),
    C('hullblock', -6, 0, 7, { ry: R90 }), C('keelblock', 6, 0, 4), C('keelblock', 6, 0, 8), C('keelblock', 8, 0, 6),
  ]));
  o.push(C('transporter', -16, 0, -6, { name: '分段运输车' }));
  o.push(C('hullblock', -16, 1.3, -6, { name: '在运分段 B13' }));
  o.push(C('towercrane', -28, 0, 48, { name: '塔吊 T1' }));

  // —— 钢材堆场（西侧） ——
  const plates = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 5; j++) plates.push(C('steelplates', -4.5 + i * 9, 0, -10 + j * 5));
  o.push(G('钢板堆场', -96, 5, plates));
  o.push(C('bridgecrane', -96, 0, 5, { s: [1.6, 1.2, 1.6], name: '堆场行车' }));
  o.push(C('pipestack', -108, 0, 32), C('pipestack', -96, 0, 32));
  o.push(C('cutter', -108, 0, 44), C('cutter', -96, 0, 44));
  o.push(C('forklift', -86, 0, 28, { ry: R90 }));

  // —— 舾装码头 ——
  o.push(C('ship', 40, -4.4, -38, { name: '舾装中 散货船' }));
  for (const x of [-25, 35, 95]) for (const z of [-24, -18]) o.push(C('rail', x, 0, z, { s: [1.5, 1, 1], name: '门机轨道' }));
  o.push(C('portalcrane', 8, 0, -21, { name: '门机 Q1', ry: -0.3 }), C('portalcrane', 38, 0, -21, { name: '门机 Q2' }), C('portalcrane', 68, 0, -21, { name: '门机 Q3', ry: 0.4 }));
  o.push(C('tug', 95, -2.4, -45, { ry: 0.4, name: '拖轮 1' }), C('tug', -8, -2.4, -52, { ry: -2.2, name: '拖轮 2', color: '#2f6fd6' }));
  const boxes = [], colors = ['#c0392b', '#2f6fd6', '#2fa36b', '#f0b429', '#7b4fd6'];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const h = 1 + ((i * 2 + j) % 3);
    for (let k = 0; k < h; k++) boxes.push(C('container', i * 7, k * 2.6, j * 3, { color: colors[(i + j * 2 + k) % colors.length] }));
  }
  o.push(G('集装箱堆场', 100, -21, boxes));
  o.push(C('truck', 82, 0, -8, { ry: Math.PI }));
  for (const [x, z, ry] of [[18, -26, 0], [24, -25, 2], [-30, -2, 1], [-22, 10, -1], [-60, -24, 0.5]]) o.push(C('worker', x, 0, z, { ry }));
  for (const x of [14, 16, 18]) o.push(C('cone', x, 0, -14));

  // —— 道路 + 路灯 ——
  for (let x = -27; x <= 113; x += 20) o.push(C('road', x, 0, 4));
  for (let x = -105; x <= 115; x += 20) o.push(C('road', x, 0, 66));
  for (const z of [-12, 8, 28, 48, 86, 106]) o.push(C('road', -77, 0, z, { ry: R90 }));
  for (const z of [18, 38, 86, 106]) o.push(C('road', -3, 0, z, { ry: R90 }));
  for (let x = -20; x <= 110; x += 26) o.push(C('lamp', x, 0, -0.5, { ry: -R90 }));

  // —— 车间 ——
  o.push(C('workshop', 18, 0, 30, { name: '钢材切割车间' }));
  o.push(C('workshop', 54, 0, 30, { s: [1, 1.1, 1.3], color: '#b7c7d6', name: '分段制作车间' }));
  o.push(C('workshop', 90, 0, 30, { color: '#d6c9b7', name: '涂装车间' }));
  o.push(C('truck', 30, 0, 12, { ry: 0, color: '#2fa36b' }), C('forklift', 40, 0, 13, { ry: R90 }), C('agv', 74, 0, 12));
  for (let i = 0; i < 4; i++) o.push(C('pallet', 62 + i * 1.6, 0, 12));

  // —— 办公 / 能源 ——
  o.push(C('office', 20, 0, 92, { s: [1.4, 1, 1.2], name: '综合办公楼' }));
  o.push(C('workshop', -100, 0, 92, { s: [0.8, 0.9, 0.9], name: '机修车间' }));
  for (const x of [55, 62, 69]) o.push(C('tank', x, 0, 88, { s: 2.5, name: '储气罐' }));
  o.push(C('coolingtower', 92, 0, 96), C('chimney', 108, 0, 84, { name: '动力站烟囱' }));
  o.push(C('transformer', 40, 0, 80), C('transformer', 44, 0, 80));
  for (let i = 0; i < 2; i++) o.push(C('fence', 37 + i * 10, 0, 76));
  o.push(C('truck', -40, 0, 92, { ry: R90 }), C('truck', -34, 0, 92, { ry: R90, color: '#c0392b' }));

  return {
    env: {
      name: '造船厂 Demo',
      ground: { w: 250, d: 150, cx: 0, cz: 45 },
      groundColor: '#7b7f84', background: '#a9bfd1',
      sun: { intensity: 2.6, azimuth: 40, elevation: 50 },
      camera: { pos: [95, 75, 120], target: [-10, 0, 10] },
    },
    objects: o,
  };
}

export const SCENES = {
  shipyard: { name: '造船厂 Demo', build: shipyard },
  factory: { name: '通用工厂', build: factory },
  blank: { name: '空白场景', build: blank },
};
