import type { AssetPack } from '../../core/types';
import * as A from './assets';
import { factoryScene, blankScene } from './scenes';

/** 通用工业资产包：适用于各行业的基础设备、建筑与场地设施 */
export const commonPack: AssetPack = {
  id: 'common',
  name: '通用工业',
  industry: 'general',
  description: '各行业通用的生产设备、物流、仓储、能源与建筑设施',
  categories: [
    { id: 'production', name: '生产设备' },
    { id: 'lifting', name: '起重设备' },
    { id: 'vehicle', name: '运输车辆' },
    { id: 'storage', name: '仓储物料' },
    { id: 'utility', name: '能源管线' },
    { id: 'building', name: '建筑结构' },
    { id: 'site', name: '场地设施' },
    { id: 'people', name: '人员标识' },
  ],
  assets: {
    machine:      { name: '加工中心',   cat: 'production', icon: '🏭', color: '#4f8fe8', build: A.buildMachine },
    cnc:          { name: '数控机床',   cat: 'production', icon: '⚙️', color: '#d9dee3', build: A.buildCNC },
    press:        { name: '冲压机',     cat: 'production', icon: '🔨', color: '#c0392b', build: A.buildPress, animate: A.animPress },
    cutter:       { name: '数控切割机', cat: 'production', icon: '✂️', color: '#2f6fd6', build: A.buildCutter, animate: A.animCutter },
    conveyor:     { name: '传送带',     cat: 'production', icon: '🛤️', color: '#9aa4b2', build: A.buildConveyor, animate: A.animConveyor },
    robot:        { name: '机械臂',     cat: 'production', icon: '🦾', color: '#ffb454', build: A.buildRobot, animate: A.animRobot },
    welder:       { name: '焊接机器人', cat: 'production', icon: '⚡', color: '#e8742a', build: A.buildWelder, animate: A.animWelder },
    paintbooth:   { name: '喷涂房',     cat: 'production', icon: '🎨', color: '#dfe6ec', build: A.buildPaintBooth },

    towercrane:   { name: '塔式起重机', cat: 'lifting', icon: '🗼', color: '#f2c12e', build: A.buildTowerCrane, animate: A.animTower },
    bridgecrane:  { name: '桥式行车',   cat: 'lifting', icon: '🌉', color: '#f0b429', build: A.buildBridgeCrane, animate: A.animBridge },

    forklift:     { name: '叉车',       cat: 'vehicle', icon: '🚜', color: '#f2b705', build: A.buildForklift },
    agv:          { name: 'AGV 小车',   cat: 'vehicle', icon: '🤖', color: '#ff8c1a', build: A.buildAGV },
    truck:        { name: '厢式货车',   cat: 'vehicle', icon: '🚚', color: '#2f6fd6', build: A.buildTruck },
    transporter:  { name: '平板运输车', cat: 'vehicle', icon: '🛻', color: '#e8742a', build: A.buildTransporter },

    shelf:        { name: '货架',       cat: 'storage', icon: '🗄️', color: '#2f6fd6', build: A.buildShelf },
    crate:        { name: '货箱',       cat: 'storage', icon: '📦', color: '#b5651d', build: A.buildCrate },
    pallet:       { name: '托盘货物',   cat: 'storage', icon: '🧱', color: '#c49a6c', build: A.buildPallet },
    container:    { name: '集装箱',     cat: 'storage', icon: '🚢', color: '#c0392b', build: A.buildContainer },
    steelplates:  { name: '钢板堆',     cat: 'storage', icon: '▤', color: '#7d8794', build: A.buildSteelPlates },
    pipestack:    { name: '钢管堆',     cat: 'storage', icon: '◎', color: '#6b7684', build: A.buildPipeStack },

    tank:         { name: '储罐',       cat: 'utility', icon: '🛢️', color: '#4fb286', build: A.buildTank },
    pipe:         { name: '管道',       cat: 'utility', icon: '🔧', color: '#6b7684', build: A.buildPipe },
    coolingtower: { name: '冷却塔',     cat: 'utility', icon: '♨️', color: '#c9c6bd', build: A.buildCoolingTower, animate: A.animPuffs },
    chimney:      { name: '烟囱',       cat: 'utility', icon: '🏭', color: '#c0392b', build: A.buildChimney, animate: A.animPuffs },
    transformer:  { name: '变压器',     cat: 'utility', icon: '🔌', color: '#6d8a7a', build: A.buildTransformer },

    workshop:     { name: '厂房',       cat: 'building', icon: '🏬', color: '#c8d0d8', build: A.buildWorkshop },
    office:       { name: '办公楼',     cat: 'building', icon: '🏢', color: '#9fb3c8', build: A.buildOffice },
    cabin:        { name: '控制室',     cat: 'building', icon: '🏠', color: '#3a7bd5', build: A.buildControlRoom },
    wall:         { name: '墙体',       cat: 'building', icon: '🧱', color: '#8a909a', build: A.buildWall },
    pillar:       { name: '立柱',       cat: 'building', icon: '🏛️', color: '#a7afba', build: A.buildPillar },
    platform:     { name: '钢平台',     cat: 'building', icon: '🪜', color: '#f2b705', build: A.buildPlatform },
    scaffold:     { name: '脚手架',     cat: 'building', icon: '🪜', color: '#c9a227', build: A.buildScaffold },

    road:         { name: '道路',       cat: 'site', icon: '🛣️', color: '#3a3d42', build: A.buildRoad },
    lamp:         { name: '路灯',       cat: 'site', icon: '💡', color: '#7b838d', build: A.buildLamp },
    fence:        { name: '围栏',       cat: 'site', icon: '🚧', color: '#9aa4b2', build: A.buildFence },
    rail:         { name: '轨道',       cat: 'site', icon: '🛤️', color: '#8f99a6', build: A.buildRail, tags: ['起重机轨道'] },
    water:        { name: '水域',       cat: 'site', icon: '🌊', color: '#1d4e6b', build: A.buildWater, animate: A.animWater, locked: true, placeY: -1.2, optimize: false },

    worker:       { name: '工人',       cat: 'people', icon: '👷', color: '#ff7a1a', build: A.buildWorker },
    cone:         { name: '安全锥',     cat: 'people', icon: '🔺', color: '#ff5a1f', build: A.buildCone },
  },
  scenes: {
    factory: { name: '通用工厂', description: '机加工、冲焊涂装、仓储与能源区', build: factoryScene },
    blank: { name: '空白场景', build: blankScene },
  },
};
