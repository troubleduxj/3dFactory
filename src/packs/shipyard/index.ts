import type { AssetPack } from '../../core/types';
import * as A from './assets';
import { shipyardScene } from './scenes';

/** 船舶制造资产包 */
export const shipyardPack: AssetPack = {
  id: 'shipyard',
  name: '船舶制造',
  industry: 'shipbuilding',
  description: '船坞、码头、大型起重设备、船体与分段',
  categories: [
    { id: 'cranes', name: '大型起重' },
    { id: 'dock', name: '船坞码头' },
    { id: 'vessel', name: '船舶分段' },
  ],
  assets: {
    gantry:      { name: '门式起重机', cat: 'cranes', icon: '🏗️', color: '#f0b429', build: A.buildGantry, animate: A.animGantry, tags: ['龙门吊'] },
    portalcrane: { name: '门座起重机', cat: 'cranes', icon: '🏗️', color: '#e04b3a', build: A.buildPortalCrane, animate: A.animPortal, tags: ['门机'] },

    drydock:     { name: '干船坞',     cat: 'dock', icon: '⚓', color: '#a7a49b', build: A.buildDryDock },
    quay:        { name: '码头岸壁',   cat: 'dock', icon: '🧱', color: '#b3b0a6', build: A.buildQuay },
    bollard:     { name: '系船柱',     cat: 'dock', icon: '🪝', color: '#2b323c', build: A.buildBollard },
    keelblock:   { name: '墩木',       cat: 'dock', icon: '🪵', color: '#a67c52', build: A.buildKeelBlock },

    ship:        { name: '散货船',     cat: 'vessel', icon: '🚢', color: '#1f3b5c', build: A.buildShip },
    hullwip:     { name: '在建船体',   cat: 'vessel', icon: '🛳️', color: '#a8553a', build: A.buildHullWip },
    hullblock:   { name: '船体分段',   cat: 'vessel', icon: '🧩', color: '#9c5a3c', build: A.buildHullBlock },
    tug:         { name: '拖船',       cat: 'vessel', icon: '⛴️', color: '#c0392b', build: A.buildTug, animate: A.animTug },
  },
  scenes: {
    shipyard: { name: '造船厂 Demo', description: '干船坞、龙门吊、舾装码头、钢材堆场与车间', build: shipyardScene },
  },
};
