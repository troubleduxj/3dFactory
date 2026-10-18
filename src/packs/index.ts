import type { AssetPack } from '../core/types';
import { commonPack } from './common/index';
import { shipyardPack } from './shipyard/index';

/**
 * 已安装的行业资产包。新增行业：在 src/packs/<industry>/ 下导出一个 AssetPack 并加入此列表。
 * 列表顺序 = 素材库中的显示顺序；第一个包含场景的包的第一个场景为默认场景（可用 ?scene= 覆盖）。
 */
export const BUILTIN_PACKS: AssetPack[] = [shipyardPack, commonPack];
