/** 骨牌类型 */
export type TileType = "civil" | "military";

/** 单张骨牌 */
export interface Tile {
  id: number;
  name: string;
  nameCN: string;
  top: number;
  bottom: number;
  totalPoints: number;
  type: TileType;
  /** 文牌对子排名（越小越大），武牌为 -1 */
  civilRank: number;
  /** 文牌中同名的配对ID */
  pairId: number;
}

/** 一对牌（前道或后道） */
export interface TilePair {
  tiles: [Tile, Tile];
}

/** 牌对的评估结果 */
export interface PairEvaluation {
  points: number;
  isPair: boolean;
  isSpecial: boolean;
  specialRank: number;
  pairRank: number;
  description: string;
}

/** 搭配（前道+后道） */
export interface Arrangement {
  front: TilePair;
  back: TilePair;
}

/** 单道比较结果 */
export interface CompareResult {
  /** >0 表示 a 赢, <0 表示 b 赢, =0 庄家赢（拷贝） */
  result: number;
  description: string;
}

/** 一局的结算明细 */
export interface RoundPlayerResult {
  playerId: string;
  playerName: string;
  arrangement: Arrangement;
  frontEval: PairEvaluation;
  backEval: PairEvaluation;
  frontResult: CompareResult;
  backResult: CompareResult;
  betAmount: number;
  /** 前道盈亏(x1) */
  frontPayout: number;
  /** 后道盈亏(x2) */
  backPayout: number;
  /** 总盈亏 */
  totalPayout: number;
}

/** 游戏阶段 */
export type GamePhase =
  | "waiting"
  | "betting"
  | "dealing"
  | "arranging"
  | "revealing"
  | "comparing"
  | "settlement";

/** 开牌数据（由服务端一次性计算完成后发给客户端，客户端逐步播放） */
export interface RevealData {
  /** 庄家结算信息 */
  bankerResult: RoundPlayerResult;
  /** 闲家结算信息（按开牌顺序排列） */
  playerResults: RoundPlayerResult[];
  /** 开牌顺序（闲家playerId列表） */
  revealOrder: string[];
}

/** 玩家战绩统计 */
export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  totalRounds: number;
}

/** 玩家信息 */
export interface Player {
  id: string;
  name: string;
  chips: number;
  isReady: boolean;
  isHost: boolean;
  tiles: Tile[];
  arrangement: Arrangement | null;
  betAmount: number;
  connected: boolean;
  /** 是否为观战者 */
  isSpectator: boolean;
  /** 观战者已申请下一局参战 */
  wantToPlay?: boolean;
  /** 胜负记录 */
  stats: PlayerStats;
}

/** 房间状态 */
export interface RoomState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  bankerId: string | null;
  roundNumber: number;
  bankerArrangement: Arrangement | null;
  results: RoundPlayerResult[];
  maxPlayers: number;
  minPlayersToStart: number;
  /** 投票下一局：已投票的玩家ID集合 */
  nextRoundVotes: string[];
  /** 投票下一局：需要投票的总人数 */
  nextRoundVoteTotal: number;
}

/** 客户端消息 */
export type ClientMessage =
  | { type: "create_room"; playerName: string }
  | { type: "join_room"; roomId: string; playerName: string }
  | { type: "spectate_room"; roomId: string; playerName: string }
  | { type: "join_playing" }
  | { type: "toggle_spectator" }
  | { type: "toggle_ready" }
  | { type: "start_game" }
  | { type: "vote_next_round" }
  | { type: "place_bet"; amount: number }
  | { type: "arrange_tiles"; front: [number, number]; back: [number, number] }
  | { type: "leave_room" }
  | { type: "rejoin_room"; roomId: string; playerId: string }
  | { type: "ping" };

/** 服务端消息 */
export type ServerMessage =
  | { type: "room_created"; roomId: string; playerId: string }
  | { type: "room_joined"; roomId: string; playerId: string }
  | { type: "room_spectating"; roomId: string; playerId: string }
  | { type: "player_joined"; player: { id: string; name: string; chips: number; isSpectator: boolean } }
  | { type: "player_left"; playerId: string }
  | { type: "spectator_to_player"; playerId: string; playerName: string }
  | { type: "join_playing_queued"; playerId: string }
  | { type: "game_started" }
  | { type: "banker_assigned"; bankerId: string }
  | { type: "bet_phase" }
  | { type: "player_bet"; playerId: string; amount: number }
  | { type: "tiles_dealt"; tiles: Tile[] }
  | { type: "arrange_phase"; timeLimit: number }
  | { type: "player_arranged"; playerId: string }
  | { type: "arrange_invalid"; reason: string }
  | { type: "round_result"; results: RoundPlayerResult[]; bankerResult: RoundPlayerResult }
  | { type: "reveal_start"; revealData: RevealData }
  | { type: "game_state"; state: RoomState; yourPlayerId: string; yourTiles: Tile[] }
  | { type: "player_eliminated"; playerId: string; playerName: string }
  | { type: "game_over"; reason: string; rankings: Array<{ name: string; chips: number; stats: PlayerStats }> ; totalRounds: number }
  | { type: "player_ready"; playerId: string; isReady: boolean }
  | { type: "player_toggle_spectator"; playerId: string; isSpectator: boolean }
  | { type: "next_round_vote"; playerId: string; votedCount: number; totalCount: number }
  | { type: "error"; message: string }
  | { type: "chat"; playerId: string; playerName: string; text: string }
  | { type: "pong" };
