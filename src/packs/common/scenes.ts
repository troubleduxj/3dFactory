import type { LayoutData, LayoutItem } from '../../core/types';
import { C, R90 } from '../../core/layout';

/* ---------------- 空白场景 ---------------- */
export function blankScene(): LayoutData {
  return {
    env: { name: '空白场景', ground: { w: 60, d: 60, cx: 0, cz: 0 }, groundColor: '#2a3038', background: '#11161d',
      camera: { pos: [22, 18, 26], target: [0, 0, 0] } },
    objects: [],
  };
}


/* ---------------- 通用工厂 ---------------- */
export function factoryScene(): LayoutData {
  const o: LayoutItem[] = [];
  o.push(C('common/cabin', -24, 0, -24, { name: '车间控制室' }));
  // 加工线：数控机床 + 机械臂 + 传送带
  for (let i = 0; i < 4; i++) {
    const x = -18 + i * 6;
    o.push(C('common/cnc', x, 0, -14));
    o.push(C('common/robot', x + 2.4, 0, -11.5));
    o.push(C('common/conveyor', x + 1, 0, -9));
  }
  // 冲压 + 焊接
  for (let i = 0; i < 3; i++) o.push(C('common/press', -18 + i * 5, 0, 0, { name: `冲压机 ${i + 1}` }));
  for (let i = 0; i < 3; i++) o.push(C('common/welder', 2 + i * 4, 0, 0));
  o.push(C('common/paintbooth', 18, 0, 0, { ry: R90 }));
  o.push(C('common/bridgecrane', -8, 0, -2, { s: [1.6, 1, 1.2], name: '20t 行车' }));
  // 仓储区
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) o.push(C('common/shelf', -18 + i * 4, 0, 14 + j * 3));
  for (let i = 0; i < 6; i++) o.push(C('common/pallet', 2 + (i % 3) * 1.6, 0, 14 + Math.floor(i / 3) * 1.4));
  o.push(C('common/forklift', 0, 0, 20, { ry: -0.6 }));
  o.push(C('common/agv', 6, 0, 8, { ry: 0.3 }), C('common/agv', -4, 0, 7));
  o.push(C('common/machine', 12, 0, 14), C('common/machine', 16, 0, 14), C('common/crate', 12, 0, 19), C('common/crate', 13.2, 0, 19), C('common/crate', 12.6, 1, 19));
  // 能源区
  o.push(C('common/tank', 24, 0, -20, { s: 1.4 }), C('common/tank', 24, 0, -15, { s: 1.4 }), C('common/pipe', 20, 0, -17.5, { ry: R90 }));
  o.push(C('common/transformer', 24, 0, 22), C('common/platform', 18, 0, -22));
  // 围墙
  for (let i = 0; i < 6; i++) o.push(C('common/fence', -25 + i * 10, 0, -29.5), C('common/fence', -25 + i * 10, 0, 29.5));
  o.push(C('common/worker', -6, 0, -6), C('common/worker', 8, 0, 4, { ry: 1 }), C('common/cone', -2, 0, 9), C('common/cone', -1, 0, 9));
  return {
    env: { name: '通用工厂', ground: { w: 60, d: 60, cx: 0, cz: 0 }, groundColor: '#2a3038', background: '#11161d',
      sun: { intensity: 2.4, azimuth: 35, elevation: 55 }, camera: { pos: [34, 30, 40], target: [0, 0, 0] } },
    objects: o,
  };
}

