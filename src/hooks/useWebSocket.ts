import { useEffect, useCallback, useSyncExternalStore } from "react";
import type { ClientMessage, ServerMessage, RoomState, Tile, RevealData, PlayerStats } from "../game/types";

interface GameOverData {
  reason: string;
  rankings: Array<{ name: string; chips: number; stats: PlayerStats }>;
  totalRounds: number;
}

interface GameStore {
  connected: boolean;
  reconnecting: boolean;
  roomId: string | null;
  playerId: string | null;
  gameState: RoomState | null;
  myTiles: Tile[];
  lastError: string | null;
  lastResult: ServerMessage | null;
  revealData: RevealData | null;
  gameOverData: GameOverData | null;
  eliminatedPlayers: Array<{ playerId: string; playerName: string }>;
  isSpectator: boolean;
}

const INITIAL_STATE: GameStore = {
  connected: false,
  reconnecting: false,
  roomId: null,
  playerId: null,
  gameState: null,
  myTiles: [],
  lastError: null,
  lastResult: null,
  revealData: null,
  gameOverData: null,
  eliminatedPlayers: [],
  isSpectator: false,
};

// ============ 全局 WebSocket 单例 ============
let globalWs: WebSocket | null = null;
let globalState: GameStore = INITIAL_STATE;
const listeners = new Set<() => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsInitialized = false;
let pongTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let waitingPong = false;

const HEARTBEAT_INTERVAL = 15_000; // 每 15 秒发一次 ping
const PONG_TIMEOUT = 5_000;        // 5 秒内没收到 pong 判定死连接

function notifyAll() {
  listeners.forEach((fn) => fn());
}

function updateState(partial: Partial<GameStore>) {
  globalState = { ...globalState, ...partial };
  notifyAll();
}

function sendRaw(msg: ClientMessage) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(msg));
  }
}

function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case "room_created":
      try { localStorage.setItem("pai_gow_room", msg.roomId); } catch {}
      try { localStorage.setItem("pai_gow_player", msg.playerId); } catch {}
      updateState({ roomId: msg.roomId, playerId: msg.playerId });
      break;

    case "room_joined":
      try { localStorage.setItem("pai_gow_room", msg.roomId); } catch {}
      try { localStorage.setItem("pai_gow_player", msg.playerId); } catch {}
      updateState({ roomId: msg.roomId, playerId: msg.playerId, isSpectator: false });
      break;

    case "room_spectating":
      try { localStorage.setItem("pai_gow_room", msg.roomId); } catch {}
      try { localStorage.setItem("pai_gow_player", msg.playerId); } catch {}
      updateState({ roomId: msg.roomId, playerId: msg.playerId, isSpectator: true });
      break;

    case "game_state": {
      const myPlayer = msg.state.players.find((p: { id: string }) => p.id === msg.yourPlayerId);
      updateState({
        gameState: msg.state,
        playerId: msg.yourPlayerId,
        myTiles: msg.yourTiles,
        roomId: msg.state.roomId,
        isSpectator: myPlayer?.isSpectator ?? globalState.isSpectator,
        reconnecting: false,
      });
      break;
    }

    case "tiles_dealt":
      updateState({ myTiles: msg.tiles });
      break;

    case "error":
      if (globalState.reconnecting) {
        try { localStorage.removeItem("pai_gow_room"); } catch {}
        try { localStorage.removeItem("pai_gow_player"); } catch {}
        updateState({ reconnecting: false, lastError: null });
      } else {
        updateState({ lastError: msg.message });
        setTimeout(() => updateState({ lastError: null }), 5000);
      }
      break;

    case "arrange_invalid":
      updateState({ lastError: msg.reason });
      setTimeout(() => updateState({ lastError: null }), 5000);
      break;

    case "reveal_start":
      updateState({ revealData: msg.revealData });
      break;

    case "round_result":
      updateState({ lastResult: msg });
      break;

    case "player_eliminated":
      updateState({
        eliminatedPlayers: [
          ...globalState.eliminatedPlayers,
          { playerId: msg.playerId, playerName: msg.playerName },
        ],
      });
      break;

    case "game_over":
      updateState({
        gameOverData: { reason: msg.reason, rankings: msg.rankings, totalRounds: msg.totalRounds },
      });
      break;

    case "player_joined": {
      const gs = globalState.gameState;
      if (gs && !gs.players.some((p) => p.id === msg.player.id)) {
        const newPlayer: import("../game/types").Player = {
          id: msg.player.id,
          name: msg.player.name,
          chips: msg.player.chips,
          isReady: false,
          isHost: false,
          tiles: [],
          arrangement: null,
          betAmount: 0,
          connected: true,
          isSpectator: msg.player.isSpectator,
          stats: { wins: 0, losses: 0, draws: 0, totalRounds: 0 },
        };
        updateState({
          gameState: { ...gs, players: [...gs.players, newPlayer] },
        });
      }
      break;
    }

    case "banker_assigned": {
      const gsBA = globalState.gameState;
      if (gsBA) {
        updateState({
          gameState: { ...gsBA, bankerId: msg.bankerId },
        });
      }
      break;
    }

    case "bidding_phase": {
      const gsBP = globalState.gameState;
      if (gsBP) {
        updateState({
          gameState: {
            ...gsBP,
            phase: "bidding",
            biddingOrder: msg.biddingOrder,
            biddingCurrentId: msg.currentBidderId,
            biddingHighScore: 0,
            biddingHighPlayerId: null,
            biddingDone: [],
            biddingScores: {},
          },
        });
      }
      break;
    }

    case "player_bid": {
      const gsPB = globalState.gameState;
      if (gsPB) {
        const newDone = gsPB.biddingDone.includes(msg.playerId)
          ? gsPB.biddingDone
          : [...gsPB.biddingDone, msg.playerId];
        updateState({
          gameState: {
            ...gsPB,
            biddingDone: newDone,
            biddingScores: { ...gsPB.biddingScores, [msg.playerId]: msg.score },
            biddingHighScore: msg.score > gsPB.biddingHighScore ? msg.score : gsPB.biddingHighScore,
            biddingHighPlayerId: msg.score > gsPB.biddingHighScore ? msg.playerId : gsPB.biddingHighPlayerId,
          },
        });
      }
      break;
    }

    case "bidding_next": {
      const gsBN = globalState.gameState;
      if (gsBN) {
        updateState({
          gameState: {
            ...gsBN,
            biddingCurrentId: msg.currentBidderId,
            biddingHighScore: msg.highScore,
            biddingHighPlayerId: msg.highPlayerId,
          },
        });
      }
      break;
    }

    case "next_round_vote": {
      const gsVote = globalState.gameState;
      if (gsVote) {
        const newVotes = gsVote.nextRoundVotes.includes(msg.playerId)
          ? gsVote.nextRoundVotes
          : [...gsVote.nextRoundVotes, msg.playerId];
        updateState({
          gameState: {
            ...gsVote,
            nextRoundVotes: newVotes,
            nextRoundVoteTotal: msg.totalCount,
          },
        });
      }
      break;
    }

    case "spectator_to_player": {
      const gs3 = globalState.gameState;
      if (gs3) {
        updateState({
          gameState: {
            ...gs3,
            players: gs3.players.map((p) =>
              p.id === msg.playerId ? { ...p, isSpectator: false, wantToPlay: false } : p
            ),
          },
          isSpectator: msg.playerId === globalState.playerId ? false : globalState.isSpectator,
        });
      }
      break;
    }

    case "join_playing_queued": {
      const gsQ = globalState.gameState;
      if (gsQ) {
        updateState({
          gameState: {
            ...gsQ,
            players: gsQ.players.map((p) =>
              p.id === msg.playerId ? { ...p, wantToPlay: true } : p
            ),
          },
        });
      }
      break;
    }

    case "player_left": {
      const gs2 = globalState.gameState;
      if (gs2) {
        updateState({
          gameState: {
            ...gs2,
            players: gs2.players.filter((p) => p.id !== msg.playerId),
          },
        });
      }
      break;
    }

    case "player_ready": {
      const gs4 = globalState.gameState;
      if (gs4) {
        updateState({
          gameState: {
            ...gs4,
            players: gs4.players.map((p) =>
              p.id === msg.playerId ? { ...p, isReady: msg.isReady } : p
            ),
          },
        });
      }
      break;
    }

    case "player_toggle_spectator": {
      const gs5 = globalState.gameState;
      if (gs5) {
        updateState({
          gameState: {
            ...gs5,
            players: gs5.players.map((p) =>
              p.id === msg.playerId ? { ...p, isSpectator: msg.isSpectator, isReady: false } : p
            ),
          },
          isSpectator: msg.playerId === globalState.playerId ? msg.isSpectator : globalState.isSpectator,
        });
      }
      break;
    }

    case "pong":
      waitingPong = false;
      if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
      break;

    default:
      break;
  }
}

function sendPing() {
  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) return;
  if (waitingPong) return;
  waitingPong = true;
  try {
    globalWs.send(JSON.stringify({ type: "ping" }));
  } catch {
    waitingPong = false;
    forceReconnect();
    return;
  }
  pongTimer = setTimeout(() => {
    waitingPong = false;
    forceReconnect();
  }, PONG_TIMEOUT);
}

function forceReconnect() {
  stopHeartbeat();
  if (globalWs) {
    try { globalWs.close(); } catch {}
    globalWs = null;
  }
  doConnect();
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(sendPing, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
  waitingPong = false;
}

function handleVisibilityChange() {
  if (document.visibilityState !== "visible") return;

  if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
    globalWs = null;
    doConnect();
    return;
  }

  // 切回前台时立刻做一次 ping 探测
  sendPing();
}

function connectWs() {
  if (typeof window === "undefined") return;
  if (wsInitialized) return;
  wsInitialized = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  doConnect();
}

function doConnect() {
  if (typeof window === "undefined") return;
  if (globalWs?.readyState === WebSocket.CONNECTING) return;
  if (globalWs?.readyState === WebSocket.OPEN) return;
  if (globalWs) {
    try { globalWs.close(); } catch {}
    globalWs = null;
  }

  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/_ws`);

    ws.onopen = () => {
      updateState({ connected: true, lastError: null });
      startHeartbeat();
      try {
        const savedRoom = localStorage.getItem("pai_gow_room");
        const savedPlayer = localStorage.getItem("pai_gow_player");
        if (savedRoom && savedPlayer) {
          ws.send(JSON.stringify({
            type: "rejoin_room",
            roomId: savedRoom,
            playerId: savedPlayer,
          }));
          updateState({ reconnecting: true });
        }
      } catch {}
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch {}
    };

    ws.onclose = () => {
      stopHeartbeat();
      updateState({ connected: false });
      globalWs = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => doConnect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    globalWs = ws;
  } catch {
    // WebSocket 构造失败
    setTimeout(() => doConnect(), 3000);
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return globalState;
}

function getServerSnapshot() {
  return INITIAL_STATE;
}

// ============ React Hook ============
export function useWebSocket() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 客户端首次挂载时建立 WebSocket 连接
  useEffect(() => {
    connectWs();
  }, []);

  const createRoom = useCallback((playerName: string) => {
    sendRaw({ type: "create_room", playerName });
  }, []);

  const joinRoom = useCallback((roomId: string, playerName: string) => {
    sendRaw({ type: "join_room", roomId: roomId.toUpperCase(), playerName });
  }, []);

  const startGame = useCallback(() => {
    sendRaw({ type: "start_game" });
  }, []);

  const voteNextRound = useCallback(() => {
    sendRaw({ type: "vote_next_round" });
  }, []);

  const callBanker = useCallback((score: number) => {
    sendRaw({ type: "call_banker", score });
  }, []);

  const placeBet = useCallback((amount: number) => {
    sendRaw({ type: "place_bet", amount });
  }, []);

  const arrangeTiles = useCallback((front: [number, number], back: [number, number]) => {
    sendRaw({ type: "arrange_tiles", front, back });
  }, []);

  const spectateRoom = useCallback((roomId: string, playerName: string) => {
    sendRaw({ type: "spectate_room", roomId: roomId.toUpperCase(), playerName });
  }, []);

  const joinPlaying = useCallback(() => {
    sendRaw({ type: "join_playing" });
  }, []);

  const toggleSpectator = useCallback(() => {
    sendRaw({ type: "toggle_spectator" });
  }, []);

  const toggleReady = useCallback(() => {
    sendRaw({ type: "toggle_ready" });
  }, []);

  const leaveRoom = useCallback(() => {
    sendRaw({ type: "leave_room" });
    try { localStorage.removeItem("pai_gow_room"); } catch {}
    try { localStorage.removeItem("pai_gow_player"); } catch {}
    updateState({
      reconnecting: false,
      roomId: null,
      playerId: null,
      gameState: null,
      myTiles: [],
      lastError: null,
      lastResult: null,
      revealData: null,
      gameOverData: null,
      eliminatedPlayers: [],
      isSpectator: false,
    });
  }, []);

  const clearError = useCallback(() => {
    updateState({ lastError: null });
  }, []);

  const clearResult = useCallback(() => {
    updateState({ lastResult: null });
  }, []);

  const clearRevealData = useCallback(() => {
    updateState({ revealData: null });
  }, []);

  const clearGameOver = useCallback(() => {
    updateState({ gameOverData: null, eliminatedPlayers: [] });
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    spectateRoom,
    joinPlaying,
    toggleSpectator,
    toggleReady,
    startGame,
    voteNextRound,
    callBanker,
    placeBet,
    arrangeTiles,
    leaveRoom,
    clearError,
    clearResult,
    clearRevealData,
    clearGameOver,
  };
}
