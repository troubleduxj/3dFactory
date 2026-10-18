import type { LayoutData, LayoutItem } from '../../core/types';
import { C, G, R90 } from '../../core/layout';

/* ---------------- 造船厂 ----------------
   坐标约定：陆域 z ∈ [-30, 120]，z < -30 为港池水域；码头前沿 z = -30
   1 号干船坞位于 x = -50，沿 z 方向，坞门朝向水域            */
export function shipyardScene(): LayoutData {
  const o: LayoutItem[] = [];
  const dockX = -50;

  // —— 水域与码头 ——
  o.push(C('common/water', 0, -1.2, -90, { s: [2.2, 1, 1], name: '港池水域', locked: true }));
  for (let x = -110; x <= 110; x += 20) {
    if (Math.abs(x - dockX) < 14) continue;
    o.push(C('shipyard/quay', x, 0, -27, { name: `码头岸壁 ${(x + 130) / 20}` }));
  }

  // —— 干船坞 + 在建船舶 ——
  o.push(C('shipyard/drydock', dockX, 0, 10, { ry: R90, name: '1号干船坞' }));
  o.push(C('shipyard/hullwip', dockX, 1.5, 14, { ry: R90, name: '在建 8.2万吨散货船' }));
  o.push(C('shipyard/hullblock', dockX, 1.5, -10, { ry: R90, name: '首部分段 B12' }));
  for (const x of [dockX - 17, dockX + 17]) o.push(C('common/rail', x, 0, 10, { ry: R90, s: [2.1, 1, 1], name: '龙门吊轨道' }));
  o.push(C('shipyard/gantry', dockX, 0, 22, { name: '800吨龙门起重机' }));
  o.push(C('shipyard/gantry', dockX, 0, -12, { color: '#d9472b', name: '300吨龙门起重机' }));
  o.push(C('common/cabin', dockX, 0, 58, { name: '船坞控制室' }));

  // —— 分段堆场（船坞东侧） ——
  o.push(G('分段堆场', -20, 23, [
    C('shipyard/hullblock', -6, 0, -7), C('shipyard/hullblock', 6, 0, -7, { color: '#8a6d3b' }),
    C('shipyard/hullblock', -6, 0, 7, { ry: R90 }), C('shipyard/keelblock', 6, 0, 4), C('shipyard/keelblock', 6, 0, 8), C('shipyard/keelblock', 8, 0, 6),
  ]));
  o.push(C('common/transporter', -16, 0, -6, { name: '分段运输车' }));
  o.push(C('shipyard/hullblock', -16, 1.3, -6, { name: '在运分段 B13' }));
  o.push(C('common/towercrane', -28, 0, 48, { name: '塔吊 T1' }));

  // —— 钢材堆场（西侧） ——
  const plates: LayoutItem[] = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 5; j++) plates.push(C('common/steelplates', -4.5 + i * 9, 0, -10 + j * 5));
  o.push(G('钢板堆场', -96, 5, plates));
  o.push(C('common/bridgecrane', -96, 0, 5, { s: [1.6, 1.2, 1.6], name: '堆场行车' }));
  o.push(C('common/pipestack', -108, 0, 32), C('common/pipestack', -96, 0, 32));
  o.push(C('common/cutter', -108, 0, 44), C('common/cutter', -96, 0, 44));
  o.push(C('common/forklift', -86, 0, 28, { ry: R90 }));

  // —— 舾装码头 ——
  o.push(C('shipyard/ship', 40, -4.4, -38, { name: '舾装中 散货船' }));
  for (const x of [-25, 35, 95]) for (const z of [-24, -18]) o.push(C('common/rail', x, 0, z, { s: [1.5, 1, 1], name: '门机轨道' }));
  o.push(C('shipyard/portalcrane', 8, 0, -21, { name: '门机 Q1', ry: -0.3 }), C('shipyard/portalcrane', 38, 0, -21, { name: '门机 Q2' }), C('shipyard/portalcrane', 68, 0, -21, { name: '门机 Q3', ry: 0.4 }));
  o.push(C('shipyard/tug', 95, -2.4, -45, { ry: 0.4, name: '拖轮 1' }), C('shipyard/tug', -8, -2.4, -52, { ry: -2.2, name: '拖轮 2', color: '#2f6fd6' }));
  const boxes: LayoutItem[] = [], colors = ['#c0392b', '#2f6fd6', '#2fa36b', '#f0b429', '#7b4fd6'];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const h = 1 + ((i * 2 + j) % 3);
    for (let k = 0; k < h; k++) boxes.push(C('common/container', i * 7, k * 2.6, j * 3, { color: colors[(i + j * 2 + k) % colors.length] }));
  }
  o.push(G('集装箱堆场', 100, -21, boxes));
  o.push(C('common/truck', 82, 0, -8, { ry: Math.PI }));
  for (const [x, z, ry] of [[18, -26, 0], [24, -25, 2], [-30, -2, 1], [-22, 10, -1], [-60, -24, 0.5]]) o.push(C('common/worker', x, 0, z, { ry }));
  for (const x of [14, 16, 18]) o.push(C('common/cone', x, 0, -14));

  // —— 道路 + 路灯 ——
  for (let x = -27; x <= 113; x += 20) o.push(C('common/road', x, 0, 4));
  for (let x = -105; x <= 115; x += 20) o.push(C('common/road', x, 0, 66));
  for (const z of [-12, 8, 28, 48, 86, 106]) o.push(C('common/road', -77, 0, z, { ry: R90 }));
  for (const z of [18, 38, 86, 106]) o.push(C('common/road', -3, 0, z, { ry: R90 }));
  for (let x = -20; x <= 110; x += 26) o.push(C('common/lamp', x, 0, -0.5, { ry: -R90 }));

  // —— 车间 ——
  o.push(C('common/workshop', 18, 0, 30, { name: '钢材切割车间' }));
  o.push(C('common/workshop', 54, 0, 30, { s: [1, 1.1, 1.3], color: '#b7c7d6', name: '分段制作车间' }));
  o.push(C('common/workshop', 90, 0, 30, { color: '#d6c9b7', name: '涂装车间' }));
  o.push(C('common/truck', 30, 0, 12, { ry: 0, color: '#2fa36b' }), C('common/forklift', 40, 0, 13, { ry: R90 }), C('common/agv', 74, 0, 12));
  for (let i = 0; i < 4; i++) o.push(C('common/pallet', 62 + i * 1.6, 0, 12));

  // —— 办公 / 能源 ——
  o.push(C('common/office', 20, 0, 92, { s: [1.4, 1, 1.2], name: '综合办公楼' }));
  o.push(C('common/workshop', -100, 0, 92, { s: [0.8, 0.9, 0.9], name: '机修车间' }));
  for (const x of [55, 62, 69]) o.push(C('common/tank', x, 0, 88, { s: 2.5, name: '储气罐' }));
  o.push(C('common/coolingtower', 92, 0, 96), C('common/chimney', 108, 0, 84, { name: '动力站烟囱' }));
  o.push(C('common/transformer', 40, 0, 80), C('common/transformer', 44, 0, 80));
  for (let i = 0; i < 2; i++) o.push(C('common/fence', 37 + i * 10, 0, 76));
  o.push(C('common/truck', -40, 0, 92, { ry: R90 }), C('common/truck', -34, 0, 92, { ry: R90, color: '#c0392b' }));

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

