import type { ComponentItem, GroupItem, LayoutItem, Vec3 } from './types';

/** 场景编写辅助（资产包里的演示场景使用） */
export const R90 = Math.PI / 2;

export interface COpts {
  ry?: number;
  s?: number | Vec3;
  color?: string;
  name?: string;
  locked?: boolean;
}

/** 组件：C(资产ID, x, y, z, { ry, s, color, name, locked }) */
export function C(type: string, x: number, y: number, z: number, o: COpts = {}): ComponentItem {
  const s: Vec3 = o.s === undefined ? [1, 1, 1] : Array.isArray(o.s) ? o.s : [o.s, o.s, o.s];
  const d: ComponentItem = { kind: 'component', type, position: [x, y, z], rotation: [0, o.ry || 0, 0], scale: s };
  if (o.color) d.color = o.color;
  if (o.name) d.name = o.name;
  if (o.locked !== undefined) d.locked = o.locked;
  return d;
}

/** 分组：子物体坐标相对分组原点 */
export function G(name: string, x: number, z: number, children: LayoutItem[]): GroupItem {
  return { kind: 'group', name, position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1], children };
}

/** 遍历布局中的所有组件（含分组内） */
export function* walkComponents(items: LayoutItem[]): Generator<ComponentItem> {
  for (const it of items) {
    if (it.kind === 'group') yield* walkComponents(it.children);
    else if (it.kind !== 'custom') yield it;
  }
}
