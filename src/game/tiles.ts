import type { Tile } from "./types";

/**
 * 牌九 32 张骨牌完整定义
 *
 * 文牌(civil): 11对 x 2 = 22张
 * 武牌(military): 杂九x2, 杂八x2, 杂七x2, 杂五x2, 至尊(丁三+二四) = 10张
 * 总计: 32张
 *
 * top/bottom 代表骨牌上下两半的点数
 * civilRank: 文牌对子排名(1=天最大, 11=伶冧六最小), 武牌为-1
 * pairId: 同名牌的配对组ID，同一对牌有相同 pairId
 */
export const ALL_TILES: Tile[] = [
  // ===== 文牌 (11对, 22张) =====
  // 天牌 (12点): [6,6] x2
  { id: 1,  name: "heaven",  nameCN: "天牌", top: 6, bottom: 6, totalPoints: 12, type: "civil", civilRank: 1, pairId: 1 },
  { id: 2,  name: "heaven",  nameCN: "天牌", top: 6, bottom: 6, totalPoints: 12, type: "civil", civilRank: 1, pairId: 1 },
  // 地牌 (2点): [1,1] x2
  { id: 3,  name: "earth",   nameCN: "地牌", top: 1, bottom: 1, totalPoints: 2,  type: "civil", civilRank: 2, pairId: 2 },
  { id: 4,  name: "earth",   nameCN: "地牌", top: 1, bottom: 1, totalPoints: 2,  type: "civil", civilRank: 2, pairId: 2 },
  // 人牌 (8点): [4,4] x2
  { id: 5,  name: "man",     nameCN: "人牌", top: 4, bottom: 4, totalPoints: 8,  type: "civil", civilRank: 3, pairId: 3 },
  { id: 6,  name: "man",     nameCN: "人牌", top: 4, bottom: 4, totalPoints: 8,  type: "civil", civilRank: 3, pairId: 3 },
  // 和牌/鹅牌 (4点): [1,3] x2
  { id: 7,  name: "harmony", nameCN: "和牌", top: 1, bottom: 3, totalPoints: 4,  type: "civil", civilRank: 4, pairId: 4 },
  { id: 8,  name: "harmony", nameCN: "和牌", top: 1, bottom: 3, totalPoints: 4,  type: "civil", civilRank: 4, pairId: 4 },
  // 梅花 (10点): [5,5] x2
  { id: 9,  name: "plum",    nameCN: "梅花", top: 5, bottom: 5, totalPoints: 10, type: "civil", civilRank: 5, pairId: 5 },
  { id: 10, name: "plum",    nameCN: "梅花", top: 5, bottom: 5, totalPoints: 10, type: "civil", civilRank: 5, pairId: 5 },
  // 长三 (6点): [3,3] x2
  { id: 11, name: "long3",   nameCN: "长三", top: 3, bottom: 3, totalPoints: 6,  type: "civil", civilRank: 6, pairId: 6 },
  { id: 12, name: "long3",   nameCN: "长三", top: 3, bottom: 3, totalPoints: 6,  type: "civil", civilRank: 6, pairId: 6 },
  // 板凳 (4点): [2,2] x2
  { id: 13, name: "bench",   nameCN: "板凳", top: 2, bottom: 2, totalPoints: 4,  type: "civil", civilRank: 7, pairId: 7 },
  { id: 14, name: "bench",   nameCN: "板凳", top: 2, bottom: 2, totalPoints: 4,  type: "civil", civilRank: 7, pairId: 7 },
  // 斧头 (11点): [5,6] x2
  { id: 15, name: "axe",     nameCN: "斧头", top: 5, bottom: 6, totalPoints: 11, type: "civil", civilRank: 8, pairId: 8 },
  { id: 16, name: "axe",     nameCN: "斧头", top: 5, bottom: 6, totalPoints: 11, type: "civil", civilRank: 8, pairId: 8 },
  // 红头十 (10点): [4,6] x2
  { id: 17, name: "redhead", nameCN: "红头十", top: 4, bottom: 6, totalPoints: 10, type: "civil", civilRank: 9, pairId: 9 },
  { id: 18, name: "redhead", nameCN: "红头十", top: 4, bottom: 6, totalPoints: 10, type: "civil", civilRank: 9, pairId: 9 },
  // 高脚七 (7点): [1,6] x2
  { id: 19, name: "highfoot",nameCN: "高脚七", top: 1, bottom: 6, totalPoints: 7, type: "civil", civilRank: 10, pairId: 10 },
  { id: 20, name: "highfoot",nameCN: "高脚七", top: 1, bottom: 6, totalPoints: 7, type: "civil", civilRank: 10, pairId: 10 },
  // 伶冧六 (6点): [1,5] x2
  { id: 21, name: "ling6",   nameCN: "伶冧六", top: 1, bottom: 5, totalPoints: 6, type: "civil", civilRank: 11, pairId: 11 },
  { id: 22, name: "ling6",   nameCN: "伶冧六", top: 1, bottom: 5, totalPoints: 6, type: "civil", civilRank: 11, pairId: 11 },

  // ===== 武牌 (10张) =====
  // 杂九 (9点): [3,6] 和 [4,5]
  { id: 23, name: "mixed9a", nameCN: "杂九", top: 3, bottom: 6, totalPoints: 9, type: "military", civilRank: -1, pairId: 12 },
  { id: 24, name: "mixed9b", nameCN: "杂九", top: 4, bottom: 5, totalPoints: 9, type: "military", civilRank: -1, pairId: 12 },
  // 杂八 (8点): [3,5] 和 [2,6]
  { id: 25, name: "mixed8a", nameCN: "杂八", top: 3, bottom: 5, totalPoints: 8, type: "military", civilRank: -1, pairId: 13 },
  { id: 26, name: "mixed8b", nameCN: "杂八", top: 2, bottom: 6, totalPoints: 8, type: "military", civilRank: -1, pairId: 13 },
  // 杂七 (7点): [2,5] 和 [3,4]
  { id: 27, name: "mixed7a", nameCN: "杂七", top: 2, bottom: 5, totalPoints: 7, type: "military", civilRank: -1, pairId: 14 },
  { id: 28, name: "mixed7b", nameCN: "杂七", top: 3, bottom: 4, totalPoints: 7, type: "military", civilRank: -1, pairId: 14 },
  // 杂五 (5点): [2,3] 和 [1,4]
  { id: 29, name: "mixed5a", nameCN: "杂五", top: 2, bottom: 3, totalPoints: 5, type: "military", civilRank: -1, pairId: 15 },
  { id: 30, name: "mixed5b", nameCN: "杂五", top: 1, bottom: 4, totalPoints: 5, type: "military", civilRank: -1, pairId: 15 },
  // 至尊: 丁三 (3点, [1,2]) 和 二四 (6点, [2,4])
  { id: 31, name: "supreme1", nameCN: "丁三", top: 1, bottom: 2, totalPoints: 3, type: "military", civilRank: -1, pairId: 16 },
  { id: 32, name: "supreme2", nameCN: "二四", top: 2, bottom: 4, totalPoints: 6, type: "military", civilRank: -1, pairId: 16 },
];

/** 根据ID查找骨牌 */
export function getTileById(id: number): Tile {
  const tile = ALL_TILES.find((t) => t.id === id);
  if (!tile) throw new Error(`Tile not found: ${id}`);
  return tile;
}

/** 复制一副新牌 */
export function createDeck(): Tile[] {
  return ALL_TILES.map((t) => ({ ...t }));
}
