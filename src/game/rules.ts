import type { Tile, TilePair, PairEvaluation, CompareResult, Arrangement } from "./types";

// ============================
// 特殊组合排名常量
// 排名越小越大, 0 = 至尊（最强）
// ============================

const SPECIAL_SUPREME = 0;
const CIVIL_PAIR_BASE = 1;     // 1~11: 文牌对子（天对=1, 地对=2, ...伶冧六对=11）
const MILITARY_PAIR_BASE = 12; // 12~15: 武牌对子（杂九对=12, 杂八对=13, 杂七对=14, 杂五对=15）
const SPECIAL_HEAVEN_KING = 20; // 天王（天+九）
const SPECIAL_EARTH_KING = 21;  // 地王（地+九）
const SPECIAL_HEAVEN_GANG = 22; // 天杠（天+八）
const SPECIAL_EARTH_GANG = 23;  // 地杠（地+八）
const SPECIAL_HEAVEN_HIGH9 = 24; // 天高九（天+七）
const SPECIAL_EARTH_HIGH9 = 25;  // 地高九（地+七）
const NOT_SPECIAL = 999;

/**
 * 判断两张牌是否为"至尊"组合（丁三 + 二四）
 */
function isSupreme(a: Tile, b: Tile): boolean {
  return (
    (a.pairId === 16 && b.pairId === 16) &&
    a.id !== b.id
  );
}

/**
 * 判断两张牌是否为文牌对子（同名文牌两张）
 */
function isCivilPair(a: Tile, b: Tile): boolean {
  return (
    a.type === "civil" &&
    b.type === "civil" &&
    a.pairId === b.pairId &&
    a.id !== b.id
  );
}

/**
 * 判断两张牌是否为武牌对子（同名武牌两张，不含至尊）
 */
function isMilitaryPair(a: Tile, b: Tile): boolean {
  return (
    a.type === "military" &&
    b.type === "military" &&
    a.pairId === b.pairId &&
    a.pairId !== 16 &&
    a.id !== b.id
  );
}

/**
 * 获取武牌对子排名
 */
function getMilitaryPairRank(pairId: number): number {
  const map: Record<number, number> = {
    12: MILITARY_PAIR_BASE,     // 杂九对
    13: MILITARY_PAIR_BASE + 1, // 杂八对
    14: MILITARY_PAIR_BASE + 2, // 杂七对
    15: MILITARY_PAIR_BASE + 3, // 杂五对
  };
  return map[pairId] ?? NOT_SPECIAL;
}

/**
 * 检测天/地 + 九 的"王"组合
 */
function isKingCombo(a: Tile, b: Tile): number {
  const tiles = [a, b];
  const hasHeaven = tiles.some((t) => t.name === "heaven");
  const hasEarth = tiles.some((t) => t.name === "earth");
  const hasNine = tiles.some((t) => t.totalPoints === 9 && t.type === "military");

  if (hasHeaven && hasNine) return SPECIAL_HEAVEN_KING;
  if (hasEarth && hasNine) return SPECIAL_EARTH_KING;
  return NOT_SPECIAL;
}

/**
 * 检测天/地 + 八 的"杠"组合
 */
function isGangCombo(a: Tile, b: Tile): number {
  const tiles = [a, b];
  const hasHeaven = tiles.some((t) => t.name === "heaven");
  const hasEarth = tiles.some((t) => t.name === "earth");
  const hasEight = tiles.some((t) => t.totalPoints === 8 && t.type === "military");

  if (hasHeaven && hasEight) return SPECIAL_HEAVEN_GANG;
  if (hasEarth && hasEight) return SPECIAL_EARTH_GANG;
  return NOT_SPECIAL;
}

/**
 * 检测天/地 + 七 的"高九"组合
 */
function isHighNineCombo(a: Tile, b: Tile): number {
  const tiles = [a, b];
  const hasHeaven = tiles.some((t) => t.name === "heaven");
  const hasEarth = tiles.some((t) => t.name === "earth");
  const hasSeven = tiles.some((t) => t.totalPoints === 7 && t.type === "military");

  if (hasHeaven && hasSeven) return SPECIAL_HEAVEN_HIGH9;
  if (hasEarth && hasSeven) return SPECIAL_EARTH_HIGH9;
  return NOT_SPECIAL;
}

/**
 * 计算两张牌的点数（取个位）
 */
export function calcPoints(a: Tile, b: Tile): number {
  return (a.totalPoints + b.totalPoints) % 10;
}

/**
 * 获取两张牌中较大的单牌排名（用于同点数时比较）
 * 文牌 > 武牌，文牌间按 civilRank 比较
 */
function getSingleTileRank(t: Tile): number {
  if (t.type === "civil") {
    return 100 - t.civilRank;
  }
  return t.totalPoints;
}

function getHigherTileRank(a: Tile, b: Tile): number {
  return Math.max(getSingleTileRank(a), getSingleTileRank(b));
}

/**
 * 评估一对牌的强度
 */
export function evaluatePair(pair: TilePair): PairEvaluation {
  const [a, b] = pair.tiles;
  const points = calcPoints(a, b);

  // 至尊
  if (isSupreme(a, b)) {
    return {
      points,
      isPair: true,
      isSpecial: true,
      specialRank: SPECIAL_SUPREME,
      pairRank: SPECIAL_SUPREME,
      description: "至尊",
    };
  }

  // 文牌对子
  if (isCivilPair(a, b)) {
    const rank = CIVIL_PAIR_BASE + a.civilRank - 1;
    return {
      points,
      isPair: true,
      isSpecial: true,
      specialRank: rank,
      pairRank: rank,
      description: `双${a.nameCN}`,
    };
  }

  // 武牌对子
  if (isMilitaryPair(a, b)) {
    const rank = getMilitaryPairRank(a.pairId);
    return {
      points,
      isPair: true,
      isSpecial: true,
      specialRank: rank,
      pairRank: rank,
      description: `双${a.nameCN.replace(/[ab]$/, "")}`,
    };
  }

  // 天王/地王
  const kingRank = isKingCombo(a, b);
  if (kingRank !== NOT_SPECIAL) {
    const name = kingRank === SPECIAL_HEAVEN_KING ? "天王" : "地王";
    return {
      points,
      isPair: false,
      isSpecial: true,
      specialRank: kingRank,
      pairRank: NOT_SPECIAL,
      description: name,
    };
  }

  // 天杠/地杠
  const gangRank = isGangCombo(a, b);
  if (gangRank !== NOT_SPECIAL) {
    const name = gangRank === SPECIAL_HEAVEN_GANG ? "天杠" : "地杠";
    return {
      points,
      isPair: false,
      isSpecial: true,
      specialRank: gangRank,
      pairRank: NOT_SPECIAL,
      description: name,
    };
  }

  // 天高九/地高九
  const high9Rank = isHighNineCombo(a, b);
  if (high9Rank !== NOT_SPECIAL) {
    const name = high9Rank === SPECIAL_HEAVEN_HIGH9 ? "天高九" : "地高九";
    return {
      points,
      isPair: false,
      isSpecial: true,
      specialRank: high9Rank,
      pairRank: NOT_SPECIAL,
      description: name,
    };
  }

  // 普通牌
  return {
    points,
    isPair: false,
    isSpecial: false,
    specialRank: NOT_SPECIAL,
    pairRank: NOT_SPECIAL,
    description: `${points}点`,
  };
}

/**
 * 比较两对牌的大小
 * 返回 > 0 表示 evalA 赢, < 0 表示 evalB 赢, = 0 表示相同（庄家赢/拷贝）
 */
export function comparePairs(
  pairA: TilePair,
  evalA: PairEvaluation,
  pairB: TilePair,
  evalB: PairEvaluation
): number {
  // 两边都有特殊组合：按 specialRank 比较（越小越大）
  if (evalA.isSpecial && evalB.isSpecial) {
    return evalB.specialRank - evalA.specialRank;
  }

  // 只有一边有特殊组合
  if (evalA.isSpecial && !evalB.isSpecial) return 1;
  if (!evalA.isSpecial && evalB.isSpecial) return -1;

  // 都是普通牌：比点数
  if (evalA.points !== evalB.points) {
    return evalA.points - evalB.points;
  }

  // 点数相同：比较最大单牌
  const rankA = getHigherTileRank(pairA.tiles[0], pairA.tiles[1]);
  const rankB = getHigherTileRank(pairB.tiles[0], pairB.tiles[1]);
  return rankA - rankB;
}

/**
 * 比较闲家一道 vs 庄家一道
 * bankerWinOnTie: true 表示同点同牌型庄家赢
 */
export function compareOneRoad(
  playerPair: TilePair,
  bankerPair: TilePair,
  bankerWinOnTie: boolean = true
): CompareResult {
  const playerEval = evaluatePair(playerPair);
  const bankerEval = evaluatePair(bankerPair);
  const cmp = comparePairs(playerPair, playerEval, bankerPair, bankerEval);

  if (cmp > 0) {
    return { result: 1, description: `${playerEval.description} 胜 ${bankerEval.description}` };
  }
  if (cmp < 0) {
    return { result: -1, description: `${playerEval.description} 负 ${bankerEval.description}` };
  }
  // 平局/拷贝
  if (bankerWinOnTie) {
    return { result: -1, description: `${playerEval.description} 拷贝 庄家赢` };
  }
  return { result: 0, description: `${playerEval.description} 平局` };
}

/**
 * 计算一组搭配的总盈亏
 * 前道 x1 倍, 后道 x2 倍
 */
export function calculatePayout(
  frontResult: CompareResult,
  backResult: CompareResult,
  betAmount: number
): { frontPayout: number; backPayout: number; totalPayout: number } {
  const frontPayout = frontResult.result * betAmount;
  const backPayout = backResult.result * betAmount * 2;
  return {
    frontPayout,
    backPayout,
    totalPayout: frontPayout + backPayout,
  };
}

/**
 * 验证搭配是否合法：后道 >= 前道
 */
export function isArrangementValid(arrangement: Arrangement): boolean {
  const frontEval = evaluatePair(arrangement.front);
  const backEval = evaluatePair(arrangement.back);
  const cmp = comparePairs(
    arrangement.back,
    backEval,
    arrangement.front,
    frontEval
  );
  return cmp >= 0;
}

/**
 * 从4张牌中获取所有可能的搭配方式（3种）
 */
export function getAllArrangements(tiles: Tile[]): Arrangement[] {
  if (tiles.length !== 4) throw new Error("Must have exactly 4 tiles");
  const [a, b, c, d] = tiles;

  return [
    { front: { tiles: [a, b] }, back: { tiles: [c, d] } },
    { front: { tiles: [a, c] }, back: { tiles: [b, d] } },
    { front: { tiles: [a, d] }, back: { tiles: [b, c] } },
  ];
}

/**
 * 自动帮玩家找最优搭配（用于超时自动配牌）
 */
export function findBestArrangement(tiles: Tile[]): Arrangement {
  const arrangements = getAllArrangements(tiles);
  const validArrangements = arrangements.filter(isArrangementValid);

  if (validArrangements.length === 0) {
    // 如果没有合法搭配（极端情况），就取第一种
    return arrangements[0];
  }

  // 选择后道最强的搭配
  let best = validArrangements[0];
  let bestBackEval = evaluatePair(best.back);

  for (let i = 1; i < validArrangements.length; i++) {
    const arr = validArrangements[i];
    const backEval = evaluatePair(arr.back);
    const cmp = comparePairs(arr.back, backEval, best.back, bestBackEval);
    if (cmp > 0) {
      best = arr;
      bestBackEval = backEval;
    }
  }

  return best;
}
