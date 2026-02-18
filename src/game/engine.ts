import type {
  RoomState,
  Player,
  Tile,
  Arrangement,
  RoundPlayerResult,
  RevealData,
} from "./types";
import { createDeck, getTileById } from "./tiles";
import {
  evaluatePair,
  compareOneRoad,
  calculatePayout,
  isArrangementValid,
  findBestArrangement,
} from "./rules";
import { shuffleDeck } from "../utils/random";

const INITIAL_BID = 100;
const MIN_BET = 50;
const MAX_BET = 2000;
const ARRANGE_TIME_LIMIT = 60; // seconds

export type EngineEvent =
  | { type: "bid_phase"; bidderId: string; bidOrder: string[] }
  | { type: "player_bid"; playerId: string; amount: number }
  | { type: "player_skip_bid"; playerId: string }
  | { type: "banker_decided"; bankerId: string; bidAmount: number }
  | { type: "bet_phase" }
  | { type: "player_bet"; playerId: string; amount: number }
  | { type: "tiles_dealt"; playerId: string; tiles: Tile[] }
  | { type: "arrange_phase"; timeLimit: number }
  | { type: "player_arranged"; playerId: string }
  | { type: "arrange_invalid"; playerId: string; reason: string }
  | { type: "round_result"; results: RoundPlayerResult[]; bankerResult: RoundPlayerResult }
  | { type: "reveal_start"; revealData: RevealData }
  | { type: "player_eliminated"; playerId: string; playerName: string }
  | { type: "game_over"; reason: string; rankings: Array<{ name: string; chips: number; stats: import("./types").PlayerStats }>; totalRounds: number }
  | { type: "error"; playerId: string; message: string };

/**
 * 游戏引擎 - 管理一个房间的游戏逻辑
 */
export class GameEngine {
  private room: RoomState;
  private eventQueue: EngineEvent[] = [];
  private arrangeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 当异步事件（超时自动配牌等）触发后回调，由 ws-handler 注册 */
  onAutoEvent: ((roomId: string) => void) | null = null;

  constructor(room: RoomState) {
    this.room = room;
  }

  getEvents(): EngineEvent[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  private emit(event: EngineEvent) {
    this.eventQueue.push(event);
  }

  /** 获取参战玩家（非观战者） */
  private getActivePlayers(): Player[] {
    return this.room.players.filter((p) => !p.isSpectator && p.connected);
  }

  /** 开始游戏（从等待 -> 抢庄） */
  startGame(): { ok: boolean; reason?: string } {
    if (this.room.phase !== "waiting") return { ok: false, reason: "游戏已开始" };
    const active = this.getActivePlayers();
    if (active.length < this.room.minPlayersToStart) return { ok: false, reason: "参战人数不足" };

    // 检查所有参战玩家是否已准备（第一局需要准备，房主自动视为已准备）
    const notReady = active.filter((p) => !p.isReady && !p.isHost);
    if (notReady.length > 0) {
      return { ok: false, reason: `等待玩家准备：${notReady.map((p) => p.name).join("、")}` };
    }

    this.room.roundNumber++;
    // 开始后重置所有准备状态
    for (const p of this.room.players) {
      p.isReady = false;
    }
    this.startBidPhase();
    return { ok: true };
  }

  /** 开始抢庄阶段 */
  private startBidPhase() {
    this.room.phase = "bidding";
    this.room.highestBid = INITIAL_BID;
    this.room.highestBidderId = null;

    // 抢庄顺序：只有参战玩家参与
    const playerIds = this.getActivePlayers().map((p) => p.id);

    if (this.room.bankerId) {
      const bankerIdx = playerIds.indexOf(this.room.bankerId);
      if (bankerIdx >= 0) {
        const rotated = [
          ...playerIds.slice(bankerIdx + 1),
          ...playerIds.slice(0, bankerIdx + 1),
        ];
        this.room.bidOrder = rotated;
      } else {
        this.room.bidOrder = playerIds;
      }
    } else {
      this.room.bidOrder = playerIds;
    }

    this.room.bidIndex = 0;
    this.room.currentBidderId = this.room.bidOrder[0] || null;

    // 重置参战玩家状态
    for (const p of this.room.players) {
      if (p.isSpectator) continue;
      p.tiles = [];
      p.arrangement = null;
      p.betAmount = 0;
      p.bidAmount = 0;
    }
    this.room.results = [];
    this.room.bankerArrangement = null;

    this.emit({
      type: "bid_phase",
      bidderId: this.room.currentBidderId!,
      bidOrder: this.room.bidOrder,
    });
  }

  /** 玩家抢庄 */
  bidBanker(playerId: string, amount: number): boolean {
    if (this.room.phase !== "bidding") return false;
    if (this.room.currentBidderId !== playerId) return false;
    if (amount <= this.room.highestBid) {
      this.emit({ type: "error", playerId, message: "出价必须高于当前最高价" });
      return false;
    }

    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (amount > player.chips) {
      this.emit({ type: "error", playerId, message: "筹码不足" });
      return false;
    }

    player.bidAmount = amount;
    this.room.highestBid = amount;
    this.room.highestBidderId = playerId;

    this.emit({ type: "player_bid", playerId, amount });
    this.advanceBid();
    return true;
  }

  /** 放弃抢庄 */
  skipBid(playerId: string): boolean {
    if (this.room.phase !== "bidding") return false;
    if (this.room.currentBidderId !== playerId) return false;

    this.emit({ type: "player_skip_bid", playerId });
    this.advanceBid();
    return true;
  }

  /** 推进抢庄流程 */
  private advanceBid() {
    this.room.bidIndex++;

    // 跳过断线/观战玩家
    while (
      this.room.bidIndex < this.room.bidOrder.length
    ) {
      const nextId = this.room.bidOrder[this.room.bidIndex];
      const nextPlayer = this.room.players.find((p) => p.id === nextId);
      if (nextPlayer && nextPlayer.connected && !nextPlayer.isSpectator) break;
      this.emit({ type: "player_skip_bid", playerId: nextId });
      this.room.bidIndex++;
    }

    if (this.room.bidIndex >= this.room.bidOrder.length) {
      this.decideBanker();
    } else {
      this.room.currentBidderId = this.room.bidOrder[this.room.bidIndex];
      this.emit({
        type: "bid_phase",
        bidderId: this.room.currentBidderId!,
        bidOrder: this.room.bidOrder,
      });
    }
  }

  /** 确定庄家 */
  private decideBanker() {
    if (this.room.highestBidderId) {
      this.room.bankerId = this.room.highestBidderId;
    } else {
      // 没人抢庄，从参战玩家中随机指定
      const active = this.getActivePlayers();
      this.room.bankerId = active[Math.floor(Math.random() * active.length)].id;
      this.room.highestBid = INITIAL_BID;
    }

    this.emit({
      type: "banker_decided",
      bankerId: this.room.bankerId!,
      bidAmount: this.room.highestBid,
    });

    this.startBetPhase();
  }

  /** 开始下注阶段 */
  private startBetPhase() {
    this.room.phase = "betting";
    this.emit({ type: "bet_phase" });
  }

  /** 闲家下注 */
  placeBet(playerId: string, amount: number): boolean {
    if (this.room.phase !== "betting") return false;
    if (playerId === this.room.bankerId) {
      this.emit({ type: "error", playerId, message: "庄家不需要下注" });
      return false;
    }

    const player = this.room.players.find((p) => p.id === playerId);
    if (!player || !player.connected || player.isSpectator) return false;

    const bet = Math.max(MIN_BET, Math.min(MAX_BET, amount));
    if (bet > player.chips) {
      this.emit({ type: "error", playerId, message: "筹码不足" });
      return false;
    }

    player.betAmount = bet;
    this.emit({ type: "player_bet", playerId, amount: bet });

    // 检查是否所有闲家都下注了（排除观战者）
    const nonBanker = this.room.players.filter(
      (p) => p.id !== this.room.bankerId && p.connected && !p.isSpectator
    );
    const allBet = nonBanker.every((p) => p.betAmount > 0);

    if (allBet) {
      this.dealTiles();
    }

    return true;
  }

  /** 发牌 */
  private dealTiles() {
    this.room.phase = "dealing";

    const deck = shuffleDeck(createDeck());
    const activePlayers = this.getActivePlayers();

    // 每人发4张
    for (let i = 0; i < activePlayers.length; i++) {
      const playerTiles = deck.slice(i * 4, i * 4 + 4);
      activePlayers[i].tiles = playerTiles;
      this.emit({ type: "tiles_dealt", playerId: activePlayers[i].id, tiles: playerTiles });
    }

    this.startArrangePhase();
  }

  /** 开始搭配阶段 */
  private startArrangePhase() {
    this.room.phase = "arranging";
    this.emit({ type: "arrange_phase", timeLimit: ARRANGE_TIME_LIMIT });

    // 设置超时自动配牌
    this.arrangeTimer = setTimeout(() => {
      this.autoArrangeRemaining();
    }, ARRANGE_TIME_LIMIT * 1000);
  }

  /** 玩家提交搭配 */
  arrangeTiles(
    playerId: string,
    frontIds: [number, number],
    backIds: [number, number]
  ): boolean {
    if (this.room.phase !== "arranging") return false;

    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (player.arrangement) return false; // 已经配过了

    // 验证牌ID属于该玩家
    const allIds = [...frontIds, ...backIds];
    const playerTileIds = player.tiles.map((t) => t.id);
    const allBelong = allIds.every((id) => playerTileIds.includes(id));
    if (!allBelong) {
      this.emit({ type: "arrange_invalid", playerId, reason: "牌不属于你" });
      return false;
    }

    // 验证4张牌不重复
    const unique = new Set(allIds);
    if (unique.size !== 4) {
      this.emit({ type: "arrange_invalid", playerId, reason: "牌不能重复" });
      return false;
    }

    const arrangement: Arrangement = {
      front: { tiles: [getTileById(frontIds[0]), getTileById(frontIds[1])] },
      back: { tiles: [getTileById(backIds[0]), getTileById(backIds[1])] },
    };

    // 验证后道 >= 前道
    if (!isArrangementValid(arrangement)) {
      this.emit({ type: "arrange_invalid", playerId, reason: "后道必须大于等于前道" });
      return false;
    }

    player.arrangement = arrangement;
    this.emit({ type: "player_arranged", playerId });

    // 检查是否所有参战玩家都配完了
    const active = this.getActivePlayers();
    const allArranged = active.every((p) => p.arrangement !== null);

    if (allArranged) {
      if (this.arrangeTimer) {
        clearTimeout(this.arrangeTimer);
        this.arrangeTimer = null;
      }
      this.compareAndSettle();
    }

    return true;
  }

  /** 超时自动配牌 */
  private autoArrangeRemaining() {
    const active = this.getActivePlayers();
    for (const player of active) {
      if (!player.arrangement && player.tiles.length === 4) {
        player.arrangement = findBestArrangement(player.tiles);
        this.emit({ type: "player_arranged", playerId: player.id });
      }
    }
    this.compareAndSettle();
    // 异步超时触发，通知 ws-handler 消费并广播事件
    if (this.onAutoEvent) {
      this.onAutoEvent(this.room.roomId);
    }
  }

  /** 比牌和结算 */
  private compareAndSettle() {
    this.room.phase = "revealing";

    const banker = this.room.players.find((p) => p.id === this.room.bankerId);
    if (!banker || !banker.arrangement) return;

    this.room.bankerArrangement = banker.arrangement;
    const bankerFrontEval = evaluatePair(banker.arrangement.front);
    const bankerBackEval = evaluatePair(banker.arrangement.back);

    let bankerTotalPayout = 0;
    const results: RoundPlayerResult[] = [];

    const nonBankerPlayers = this.room.players.filter(
      (p) => p.id !== this.room.bankerId && p.connected && !p.isSpectator && p.arrangement
    );

    // 开牌顺序：按座位顺序（非庄家闲家列表）
    const revealOrder = nonBankerPlayers.map((p) => p.id);

    for (const player of nonBankerPlayers) {
      const arr = player.arrangement!;
      const frontEval = evaluatePair(arr.front);
      const backEval = evaluatePair(arr.back);

      const frontResult = compareOneRoad(arr.front, banker.arrangement.front, true);
      const backResult = compareOneRoad(arr.back, banker.arrangement.back, true);
      const payout = calculatePayout(frontResult, backResult, player.betAmount);

      // 更新筹码
      player.chips += payout.totalPayout;
      bankerTotalPayout -= payout.totalPayout;

      results.push({
        playerId: player.id,
        playerName: player.name,
        arrangement: arr,
        frontEval,
        backEval,
        frontResult,
        backResult,
        betAmount: player.betAmount,
        frontPayout: payout.frontPayout,
        backPayout: payout.backPayout,
        totalPayout: payout.totalPayout,
      });
    }

    // 更新庄家筹码
    banker.chips += bankerTotalPayout;

    // 更新胜负统计
    for (const r of results) {
      const p = this.room.players.find((pl) => pl.id === r.playerId);
      if (p) {
        p.stats.totalRounds++;
        if (r.totalPayout > 0) p.stats.wins++;
        else if (r.totalPayout < 0) p.stats.losses++;
        else p.stats.draws++;
      }
    }
    banker.stats.totalRounds++;
    if (bankerTotalPayout > 0) banker.stats.wins++;
    else if (bankerTotalPayout < 0) banker.stats.losses++;
    else banker.stats.draws++;

    // 庄家结算信息
    const bankerResult: RoundPlayerResult = {
      playerId: banker.id,
      playerName: banker.name,
      arrangement: banker.arrangement,
      frontEval: bankerFrontEval,
      backEval: bankerBackEval,
      frontResult: { result: 0, description: "庄家" },
      backResult: { result: 0, description: "庄家" },
      betAmount: 0,
      frontPayout: 0,
      backPayout: 0,
      totalPayout: bankerTotalPayout,
    };

    this.room.results = results;

    // 先发 reveal_start，客户端进入逐步开牌演出
    const revealData: RevealData = {
      bankerResult,
      playerResults: results,
      revealOrder,
    };
    this.emit({ type: "reveal_start", revealData });

    // 同时发 round_result（客户端在开牌演出结束后使用）
    this.room.phase = "settlement";
    this.emit({ type: "round_result", results, bankerResult });
  }

  /** 下一局（从结算 -> 抢庄） */
  nextRound(): boolean {
    if (this.room.phase !== "settlement") return false;

    // 检查并移除破产的参战玩家（筹码 <= 0）
    const eliminatedPlayers = this.room.players.filter(
      (p) => p.chips <= 0 && p.connected && !p.isSpectator
    );
    for (const p of eliminatedPlayers) {
      this.emit({
        type: "player_eliminated",
        playerId: p.id,
        playerName: p.name,
      });
    }

    // 将破产玩家转为观战者而非移除
    for (const p of eliminatedPlayers) {
      p.isSpectator = true;
      p.chips = 0;
    }

    // 检查剩余参战在线人数是否足够
    const connectedCount = this.getActivePlayers().length;
    if (connectedCount < this.room.minPlayersToStart) {
      // 生成最终排名（按筹码降序，包含所有连接的玩家）
      const rankings = this.room.players
        .filter((p) => p.connected)
        .sort((a, b) => b.chips - a.chips)
        .map((p) => ({ name: p.name, chips: p.chips, stats: { ...p.stats } }));

      this.emit({
        type: "game_over",
        reason:
          eliminatedPlayers.length > 0
            ? `${eliminatedPlayers.map((p) => p.name).join("、")} 已破产，剩余玩家不足，游戏结束`
            : "在线玩家不足，游戏结束",
        rankings,
        totalRounds: this.room.roundNumber,
      });

      // 回到大厅：重置所有玩家状态
      this.room.phase = "waiting";
      this.room.roundNumber = 0;
      this.room.bankerId = null;
      for (const p of this.room.players) {
        if (!p.connected) continue;
        p.isSpectator = false;
        p.isReady = false;
        p.wantToPlay = false;
        p.chips = 10000; // 重置筹码
        p.stats = { wins: 0, losses: 0, draws: 0, totalRounds: 0 };
        p.tiles = [];
        p.arrangement = null;
        p.betAmount = 0;
        p.bidAmount = 0;
      }
      return false;
    }

    // 将申请了"下局参战"的观战者转为参战玩家
    for (const p of this.room.players) {
      if (p.wantToPlay && p.isSpectator && p.connected) {
        p.isSpectator = false;
        p.isReady = false;
        p.wantToPlay = false;
        if (p.chips <= 0) p.chips = 10000;
      }
    }

    this.room.roundNumber++;
    this.startBidPhase();
    return true;
  }

  /** 掉线：仅标记断线状态，不自动执行操作（由 ws-handler 的计时器控制） */
  handlePlayerDisconnect(playerId: string): void {
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connected = false;
  }

  /** 检查掉线玩家是否正阻塞当前流程 */
  isPlayerBlockingGame(playerId: string): boolean {
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player || player.connected) return false;

    if (this.room.phase === "bidding" && this.room.currentBidderId === playerId) return true;
    if (this.room.phase === "betting" && playerId !== this.room.bankerId && player.betAmount === 0 && !player.isSpectator) return true;
    if (this.room.phase === "arranging" && !player.arrangement && player.tiles.length === 4) return true;

    return false;
  }

  /** 操作超时（30s）：掉线玩家仍未重连，自动执行其待处理操作 */
  handlePlayerActionTimeout(playerId: string): void {
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player || player.connected) return;

    if (this.room.phase === "bidding" && this.room.currentBidderId === playerId) {
      this.skipBid(playerId);
    }

    if (this.room.phase === "betting" && playerId !== this.room.bankerId && player.betAmount === 0 && !player.isSpectator) {
      const bet = Math.min(MIN_BET, player.chips);
      if (bet > 0) {
        player.betAmount = bet;
        this.emit({ type: "player_bet", playerId, amount: bet });
        const nonBanker = this.room.players.filter(
          (p) => p.id !== this.room.bankerId && p.connected && !p.isSpectator
        );
        if (nonBanker.every((p) => p.betAmount > 0)) {
          this.dealTiles();
        }
      }
    }

    if (this.room.phase === "arranging" && !player.arrangement && player.tiles.length === 4) {
      player.arrangement = findBestArrangement(player.tiles);
      this.emit({ type: "player_arranged", playerId });
      const active = this.getActivePlayers();
      if (active.every((p) => p.arrangement !== null)) {
        if (this.arrangeTimer) {
          clearTimeout(this.arrangeTimer);
          this.arrangeTimer = null;
        }
        this.compareAndSettle();
      }
    }
  }

  /** 踢出（60s）：重连窗口到期，将玩家转为观战者并检查人数 */
  handlePlayerKick(playerId: string): void {
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player || player.connected) return;

    player.isSpectator = true;

    // 再次执行操作超时逻辑，确保该玩家不阻塞流程（可能在 30s~60s 之间阶段发生了变化）
    this.handlePlayerActionTimeout(playerId);

    if (this.room.phase !== "waiting" && this.room.phase !== "settlement") {
      const activeCount = this.getActivePlayers().length;
      if (activeCount < this.room.minPlayersToStart) {
        if (this.arrangeTimer) {
          clearTimeout(this.arrangeTimer);
          this.arrangeTimer = null;
        }
        const rankings = this.room.players
          .filter((p) => p.connected || p.id === playerId)
          .sort((a, b) => b.chips - a.chips)
          .map((p) => ({ name: p.name, chips: p.chips, stats: { ...p.stats } }));
        this.emit({
          type: "game_over",
          reason: `${player.name} 断线超时，在线玩家不足，游戏结束`,
          rankings,
          totalRounds: this.room.roundNumber,
        });
        this.room.phase = "waiting";
        this.room.roundNumber = 0;
        this.room.bankerId = null;
        for (const p of this.room.players) {
          if (!p.connected) continue;
          p.isSpectator = false;
          p.isReady = false;
          p.wantToPlay = false;
          p.chips = 10000;
          p.stats = { wins: 0, losses: 0, draws: 0, totalRounds: 0 };
          p.tiles = [];
          p.arrangement = null;
          p.betAmount = 0;
          p.bidAmount = 0;
        }
      }
    }
  }

  /** 获取房间的安全状态（隐藏其他玩家手牌） */
  getSafeState(forPlayerId: string): RoomState {
    const state = { ...this.room };
    const requester = this.room.players.find((p) => p.id === forPlayerId);
    const isSpectator = requester?.isSpectator ?? false;

    state.players = this.room.players.map((p) => {
      if (p.id === forPlayerId) return { ...p };
      // 隐藏其他玩家的手牌（观战者也看不到进行中的手牌）
      return {
        ...p,
        tiles: p.tiles.map(() => ({
          id: 0,
          name: "hidden",
          nameCN: "暗牌",
          top: 0,
          bottom: 0,
          totalPoints: 0,
          type: "civil" as const,
          civilRank: 0,
          pairId: 0,
        })),
        arrangement:
          this.room.phase === "settlement" || this.room.phase === "comparing" || this.room.phase === "revealing"
            ? p.arrangement
            : null,
      };
    });
    return state;
  }
}

/** 房间 -> 引擎实例 */
const engines = new Map<string, GameEngine>();

export function getEngine(roomId: string): GameEngine | undefined {
  return engines.get(roomId);
}

export function createEngine(room: RoomState): GameEngine {
  const engine = new GameEngine(room);
  engines.set(room.roomId, engine);
  return engine;
}

export function removeEngine(roomId: string) {
  engines.delete(roomId);
}
