import type { Player, RoomState, GamePhase, PlayerStats } from "./types";
import { generateRoomId, generatePlayerId } from "../utils/random";

const DEFAULT_CHIPS = 10000;
const MAX_PLAYERS = 12;
const MIN_PLAYERS_TO_START = 2;

const DEFAULT_STATS: PlayerStats = { wins: 0, losses: 0, draws: 0, totalRounds: 0 };

/** 所有房间 */
const rooms = new Map<string, RoomState>();

/** playerId -> roomId 映射 */
const playerRoomMap = new Map<string, string>();

export function createRoom(playerName: string): { room: RoomState; playerId: string } {
  let roomId = generateRoomId();
  while (rooms.has(roomId)) {
    roomId = generateRoomId();
  }

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: playerName,
    chips: DEFAULT_CHIPS,
    isReady: false,
    isHost: true,
    tiles: [],
    arrangement: null,
    betAmount: 0,
    bidAmount: 0,
    connected: true,
    isSpectator: false,
    stats: { ...DEFAULT_STATS },
  };

  const room: RoomState = {
    roomId,
    phase: "waiting",
    players: [player],
    bankerId: null,
    currentBidderId: null,
    bidOrder: [],
    bidIndex: 0,
    highestBid: 0,
    highestBidderId: null,
    roundNumber: 0,
    bankerArrangement: null,
    results: [],
    maxPlayers: MAX_PLAYERS,
    minPlayersToStart: MIN_PLAYERS_TO_START,
  };

  rooms.set(roomId, room);
  playerRoomMap.set(playerId, roomId);

  return { room, playerId };
}

export function joinRoom(
  roomId: string,
  playerName: string
): { room: RoomState; playerId: string } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "房间不存在" };

  const nameExists = room.players.some((p) => p.name === playerName);
  if (nameExists) return { error: "该昵称已被使用" };

  // 如果游戏已开始，自动以观战者身份加入
  if (room.phase !== "waiting") {
    return spectateRoom(roomId, playerName);
  }

  const activePlayers = room.players.filter((p) => !p.isSpectator);
  if (activePlayers.length >= room.maxPlayers) return { error: "房间已满" };

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: playerName,
    chips: DEFAULT_CHIPS,
    isReady: false,
    isHost: false,
    tiles: [],
    arrangement: null,
    betAmount: 0,
    bidAmount: 0,
    connected: true,
    isSpectator: false,
    stats: { ...DEFAULT_STATS },
  };

  room.players.push(player);
  playerRoomMap.set(playerId, roomId);

  return { room, playerId };
}

export function spectateRoom(
  roomId: string,
  playerName: string
): { room: RoomState; playerId: string; isSpectator: true } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "房间不存在" };

  const nameExists = room.players.some((p) => p.name === playerName);
  if (nameExists) return { error: "该昵称已被使用" };

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: playerName,
    chips: DEFAULT_CHIPS,
    isReady: false,
    isHost: false,
    tiles: [],
    arrangement: null,
    betAmount: 0,
    bidAmount: 0,
    connected: true,
    isSpectator: true,
    stats: { ...DEFAULT_STATS },
  };

  room.players.push(player);
  playerRoomMap.set(playerId, roomId);

  return { room, playerId, isSpectator: true };
}

/** 观战者请求下一局参战 */
export function requestJoinPlaying(
  roomId: string,
  playerId: string
): { success: boolean; queued?: boolean; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "房间不存在" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { success: false, error: "玩家不在房间" };
  if (!player.isSpectator) return { success: false, error: "你已经是参战玩家" };
  if (player.wantToPlay) return { success: false, error: "已申请，等待本局结束" };

  const activePlayers = room.players.filter((p) => !p.isSpectator);
  if (activePlayers.length >= room.maxPlayers) {
    return { success: false, error: "参战玩家已满" };
  }

  if (room.phase === "waiting") {
    player.isSpectator = false;
    player.isReady = false;
    player.wantToPlay = false;
    return { success: true };
  }

  player.wantToPlay = true;
  return { success: true, queued: true };
}

/** 在大厅中切换观战/参战状态 */
export function toggleSpectator(
  roomId: string,
  playerId: string
): { success: boolean; isSpectator?: boolean; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "房间不存在" };
  if (room.phase !== "waiting") return { success: false, error: "游戏已开始，无法切换" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { success: false, error: "玩家不在房间" };

  if (player.isSpectator) {
    // 切换回参战
    const activePlayers = room.players.filter((p) => !p.isSpectator);
    if (activePlayers.length >= room.maxPlayers) {
      return { success: false, error: "参战人数已满" };
    }
    player.isSpectator = false;
    player.isReady = false;
  } else {
    // 切换到观战
    player.isSpectator = true;
    player.isReady = false;
  }

  return { success: true, isSpectator: player.isSpectator };
}

/** 切换准备状态 */
export function toggleReady(
  roomId: string,
  playerId: string
): { success: boolean; isReady?: boolean; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "房间不存在" };
  if (room.phase !== "waiting") return { success: false, error: "游戏已开始" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { success: false, error: "玩家不在房间" };
  if (player.isSpectator) return { success: false, error: "观战者无需准备" };
  if (player.isHost) return { success: false, error: "房主无需准备" };

  player.isReady = !player.isReady;
  return { success: true, isReady: player.isReady };
}

export function leaveRoom(playerId: string): { room: RoomState | null; removed: boolean } {
  const roomId = playerRoomMap.get(playerId);
  if (!roomId) return { room: null, removed: false };

  const room = rooms.get(roomId);
  if (!room) return { room: null, removed: false };

  // 如果在等待阶段，直接移除
  if (room.phase === "waiting") {
    room.players = room.players.filter((p) => p.id !== playerId);
    playerRoomMap.delete(playerId);

    if (room.players.length === 0) {
      rooms.delete(roomId);
      return { room: null, removed: true };
    }

    // 如果房主离开，转移房主
    if (!room.players.some((p) => p.isHost)) {
      room.players[0].isHost = true;
    }

    return { room, removed: true };
  }

  // 游戏进行中，标记断线
  const player = room.players.find((p) => p.id === playerId);
  if (player) {
    player.connected = false;
  }
  return { room, removed: false };
}

export function rejoinRoom(
  roomId: string,
  playerId: string
): { room: RoomState; player: Player } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "房间不存在" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "玩家不在此房间" };

  player.connected = true;
  playerRoomMap.set(playerId, roomId);
  return { room, player };
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function getRoomByPlayerId(playerId: string): RoomState | undefined {
  const roomId = playerRoomMap.get(playerId);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

export function getPlayer(room: RoomState, playerId: string): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

export function setPlayerRoom(playerId: string, roomId: string) {
  playerRoomMap.set(playerId, roomId);
}

export function removePlayerRoom(playerId: string) {
  playerRoomMap.delete(playerId);
}

export function deleteRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    for (const p of room.players) {
      playerRoomMap.delete(p.id);
    }
    rooms.delete(roomId);
  }
}
