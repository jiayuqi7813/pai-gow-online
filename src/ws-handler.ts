import type { WebSocket as WSWebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./game/types";
import {
  createRoom,
  joinRoom,
  spectateRoom,
  requestJoinPlaying,
  toggleSpectator,
  toggleReady,
  leaveRoom,
  rejoinRoom,
  getRoom,
} from "./game/room";
import {
  createEngine,
  getEngine,
  type EngineEvent,
} from "./game/engine";

/** peerId -> WebSocket */
const peerSockets = new Map<string, WSWebSocket>();
/** WebSocket -> playerId */
const socketPlayerMap = new Map<WSWebSocket, string>();
/** playerId -> roomId */
const playerRoomCache = new Map<string, string>();
/** ws -> 是否存活标记（服务端心跳用） */
const wsAlive = new Map<WSWebSocket, boolean>();
/** ws -> 心跳定时器 */
const wsPingTimers = new Map<WSWebSocket, ReturnType<typeof setInterval>>();

const WS_PING_INTERVAL = 20_000;

/** 掉线计时器：30s 操作超时 + 60s 重连窗口 */
const disconnectTimers = new Map<string, {
  actionTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout>;
}>();

/** 绑定 playerId <-> ws，清理之前可能残留的旧映射 */
function bindSocket(playerId: string, ws: WSWebSocket) {
  const oldWs = peerSockets.get(playerId);
  if (oldWs && oldWs !== ws) {
    socketPlayerMap.delete(oldWs);
    try { oldWs.close(); } catch {}
  }
  const oldPlayerId = socketPlayerMap.get(ws);
  if (oldPlayerId && oldPlayerId !== playerId) {
    peerSockets.delete(oldPlayerId);
  }
  peerSockets.set(playerId, ws);
  socketPlayerMap.set(ws, playerId);
}

function clearDisconnectTimers(playerId: string) {
  const timers = disconnectTimers.get(playerId);
  if (!timers) return;
  if (timers.actionTimer) clearTimeout(timers.actionTimer);
  clearTimeout(timers.reconnectTimer);
  disconnectTimers.delete(playerId);
}

function send(ws: WSWebSocket, msg: ServerMessage) {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(msg));
  }
}

function sendToPlayer(playerId: string, msg: ServerMessage) {
  const ws = peerSockets.get(playerId);
  if (ws) send(ws, msg);
}

function broadcastToRoom(roomId: string, msg: ServerMessage, excludePlayerId?: string) {
  const room = getRoom(roomId);
  if (!room) return;
  for (const player of room.players) {
    if (player.id === excludePlayerId) continue;
    sendToPlayer(player.id, msg);
  }
}

/** 创建引擎并注册异步事件回调 */
function createAndBindEngine(room: import("./game/types").RoomState) {
  const engine = createEngine(room);
  engine.onAutoEvent = handleAutoEvent;
  return engine;
}

/** 引擎异步超时事件触发后，消费事件并广播+刷新状态 */
function handleAutoEvent(roomId: string) {
  const engine = getEngine(roomId);
  if (!engine) return;
  const events = engine.getEvents();
  if (events.length > 0) {
    processEngineEvents(roomId, events);
  }
  const room = getRoom(roomId);
  if (room) {
    for (const p of room.players) sendFullState(p.id, roomId);
  }
}

function processEngineEvents(roomId: string, events: EngineEvent[]) {
  for (const event of events) {
    switch (event.type) {
      case "banker_assigned":
        broadcastToRoom(roomId, { type: "banker_assigned", bankerId: event.bankerId });
        break;
      case "bidding_phase":
        broadcastToRoom(roomId, { type: "bidding_phase", biddingOrder: event.biddingOrder, currentBidderId: event.currentBidderId });
        break;
      case "player_bid":
        broadcastToRoom(roomId, { type: "player_bid", playerId: event.playerId, score: event.score });
        break;
      case "bidding_next":
        broadcastToRoom(roomId, { type: "bidding_next", currentBidderId: event.currentBidderId, highScore: event.highScore, highPlayerId: event.highPlayerId });
        break;
      case "bet_phase":
        broadcastToRoom(roomId, { type: "bet_phase" });
        break;
      case "player_bet":
        broadcastToRoom(roomId, { type: "player_bet", playerId: event.playerId, amount: event.amount });
        break;
      case "tiles_dealt":
        sendToPlayer(event.playerId, { type: "tiles_dealt", tiles: event.tiles });
        break;
      case "arrange_phase":
        broadcastToRoom(roomId, { type: "arrange_phase", timeLimit: event.timeLimit });
        break;
      case "player_arranged":
        broadcastToRoom(roomId, { type: "player_arranged", playerId: event.playerId });
        break;
      case "arrange_invalid":
        sendToPlayer(event.playerId, { type: "arrange_invalid", reason: event.reason });
        break;
      case "reveal_start":
        broadcastToRoom(roomId, { type: "reveal_start", revealData: event.revealData });
        break;
      case "next_round_vote":
        broadcastToRoom(roomId, { type: "next_round_vote", playerId: event.playerId, votedCount: event.votedCount, totalCount: event.totalCount });
        break;
      case "round_result":
        broadcastToRoom(roomId, { type: "round_result", results: event.results, bankerResult: event.bankerResult });
        break;
      case "player_eliminated":
        broadcastToRoom(roomId, { type: "player_eliminated", playerId: event.playerId, playerName: event.playerName });
        break;
      case "game_over":
        broadcastToRoom(roomId, { type: "game_over", reason: event.reason, rankings: event.rankings, totalRounds: event.totalRounds });
        break;
      case "error":
        sendToPlayer(event.playerId, { type: "error", message: event.message });
        break;
    }
  }
}

function sendFullState(playerId: string, roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  const engine = getEngine(roomId);
  const state = engine ? engine.getSafeState(playerId) : room;
  const player = room.players.find((p) => p.id === playerId);
  sendToPlayer(playerId, {
    type: "game_state",
    state,
    yourPlayerId: playerId,
    yourTiles: player?.tiles || [],
  });
}

function handleMessage(ws: WSWebSocket, data: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(data);
  } catch {
    send(ws, { type: "error", message: "无效的消息格式" });
    return;
  }

  switch (msg.type) {
    case "create_room": {
      const { room, playerId } = createRoom(msg.playerName);
      bindSocket(playerId, ws);
      playerRoomCache.set(playerId, room.roomId);
      createAndBindEngine(room);
      send(ws, { type: "room_created", roomId: room.roomId, playerId });
      sendFullState(playerId, room.roomId);
      break;
    }

    case "join_room": {
      const result = joinRoom(msg.roomId.toUpperCase(), msg.playerName);
      if ("error" in result) {
        send(ws, { type: "error", message: result.error });
        return;
      }
      const { room, playerId } = result;
      const joinedPlayer = room.players.find((p) => p.id === playerId)!;
      bindSocket(playerId, ws);
      playerRoomCache.set(playerId, room.roomId);
      if (!getEngine(room.roomId)) createAndBindEngine(room);
      // 如果是观战者身份加入（游戏进行中自动转观战）
      if (joinedPlayer.isSpectator) {
        send(ws, { type: "room_spectating", roomId: room.roomId, playerId });
      } else {
        send(ws, { type: "room_joined", roomId: room.roomId, playerId });
      }
      broadcastToRoom(room.roomId, {
        type: "player_joined",
        player: { id: playerId, name: msg.playerName, chips: joinedPlayer.chips, isSpectator: joinedPlayer.isSpectator },
      }, playerId);
      for (const p of room.players) sendFullState(p.id, room.roomId);
      break;
    }

    case "rejoin_room": {
      const result = rejoinRoom(msg.roomId, msg.playerId);
      if ("error" in result) {
        send(ws, { type: "error", message: result.error });
        return;
      }

      bindSocket(msg.playerId, ws);
      playerRoomCache.set(msg.playerId, msg.roomId);
      // 取消掉线计时器
      clearDisconnectTimers(msg.playerId);
      // 通知其他玩家该玩家已重连
      const rjRoom = getRoom(msg.roomId);
      if (rjRoom) {
        const rjPlayer = rjRoom.players.find((p) => p.id === msg.playerId);
        if (rjPlayer) {
          broadcastToRoom(msg.roomId, {
            type: "player_joined",
            player: { id: msg.playerId, name: rjPlayer.name, chips: rjPlayer.chips, isSpectator: rjPlayer.isSpectator },
          }, msg.playerId);
        }
        for (const p of rjRoom.players) sendFullState(p.id, msg.roomId);
      } else {
        sendFullState(msg.playerId, msg.roomId);
      }
      break;
    }

    case "start_game": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      const engine = getEngine(roomId);
      if (!engine) return;
      if (room.phase === "settlement") {
        // settlement 阶段不再需要房主权限，改为投票确认下一局
        send(ws, { type: "error", message: "请使用投票按钮确认下一局" });
        return;
      }
      if (!player?.isHost) {
        send(ws, { type: "error", message: "只有房主可以开始游戏" });
        return;
      }
      const result = engine.startGame();
      if (!result.ok) {
        send(ws, { type: "error", message: result.reason || "无法开始游戏" });
        return;
      }
      processEngineEvents(roomId, engine.getEvents());
      broadcastToRoom(roomId, { type: "game_started" });
      for (const p of room.players) sendFullState(p.id, roomId);
      break;
    }

    case "vote_next_round": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const engine = getEngine(roomId);
      if (!engine) return;
      if (room.phase !== "settlement") {
        send(ws, { type: "error", message: "当前不在结算阶段" });
        return;
      }
      const prevPhase = room.phase;
      engine.voteNextRound(playerId);
      const events = engine.getEvents();
      if (events.length > 0) {
        processEngineEvents(roomId, events);
      }
      // 如果投票导致阶段变化（所有人都投了票，自动进入下一局），广播 game_started
      if (room.phase !== prevPhase && room.phase !== "settlement" && room.phase !== "waiting") {
        broadcastToRoom(roomId, { type: "game_started" });
      }
      for (const p of room.players) sendFullState(p.id, roomId);
      break;
    }

    case "call_banker": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const engine = getEngine(roomId);
      if (!engine) return;
      if (room.phase !== "bidding") {
        send(ws, { type: "error", message: "当前不在叫庄阶段" });
        return;
      }
      engine.callBanker(playerId, msg.score);
      const events = engine.getEvents();
      if (events.length > 0) {
        processEngineEvents(roomId, events);
      }
      for (const p of room.players) sendFullState(p.id, roomId);
      break;
    }

    case "place_bet": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const engine = getEngine(roomId);
      if (!engine) return;
      engine.placeBet(playerId, msg.amount);
      processEngineEvents(roomId, engine.getEvents());
      for (const p of getRoom(roomId)!.players) sendFullState(p.id, roomId);
      break;
    }

    case "arrange_tiles": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const engine = getEngine(roomId);
      if (!engine) return;
      engine.arrangeTiles(playerId, msg.front, msg.back);
      processEngineEvents(roomId, engine.getEvents());
      for (const p of getRoom(roomId)!.players) sendFullState(p.id, roomId);
      break;
    }

    case "spectate_room": {
      const result = spectateRoom(msg.roomId.toUpperCase(), msg.playerName);
      if ("error" in result) {
        send(ws, { type: "error", message: result.error });
        return;
      }
      const { room: sRoom, playerId: sPlayerId } = result;
      bindSocket(sPlayerId, ws);
      playerRoomCache.set(sPlayerId, sRoom.roomId);
      if (!getEngine(sRoom.roomId)) createAndBindEngine(sRoom);
      send(ws, { type: "room_spectating", roomId: sRoom.roomId, playerId: sPlayerId });
      broadcastToRoom(sRoom.roomId, {
        type: "player_joined",
        player: { id: sPlayerId, name: msg.playerName, chips: sRoom.players.find((p) => p.id === sPlayerId)!.chips, isSpectator: true },
      }, sPlayerId);
      for (const p of sRoom.players) sendFullState(p.id, sRoom.roomId);
      break;
    }

    case "join_playing": {
      const jpPlayerId = socketPlayerMap.get(ws);
      if (!jpPlayerId) return;
      const jpRoomId = playerRoomCache.get(jpPlayerId);
      if (!jpRoomId) return;
      const jpResult = requestJoinPlaying(jpRoomId, jpPlayerId);
      if (!jpResult.success) {
        send(ws, { type: "error", message: jpResult.error || "无法加入参战" });
        return;
      }
      const jpRoom = getRoom(jpRoomId);
      if (!jpRoom) return;
      if (jpResult.queued) {
        broadcastToRoom(jpRoomId, { type: "join_playing_queued", playerId: jpPlayerId });
        for (const p of jpRoom.players) sendFullState(p.id, jpRoomId);
      } else {
        const jpPlayer = jpRoom.players.find((p) => p.id === jpPlayerId);
        broadcastToRoom(jpRoomId, {
          type: "spectator_to_player",
          playerId: jpPlayerId,
          playerName: jpPlayer?.name || "",
        });
        for (const p of jpRoom.players) sendFullState(p.id, jpRoomId);
      }
      break;
    }

    case "toggle_spectator": {
      const tsPlayerId = socketPlayerMap.get(ws);
      if (!tsPlayerId) return;
      const tsRoomId = playerRoomCache.get(tsPlayerId);
      if (!tsRoomId) return;
      const tsResult = toggleSpectator(tsRoomId, tsPlayerId);
      if (!tsResult.success) {
        send(ws, { type: "error", message: tsResult.error || "无法切换" });
        return;
      }
      broadcastToRoom(tsRoomId, {
        type: "player_toggle_spectator",
        playerId: tsPlayerId,
        isSpectator: tsResult.isSpectator!,
      });
      for (const p of getRoom(tsRoomId)!.players) sendFullState(p.id, tsRoomId);
      break;
    }

    case "toggle_ready": {
      const trPlayerId = socketPlayerMap.get(ws);
      if (!trPlayerId) return;
      const trRoomId = playerRoomCache.get(trPlayerId);
      if (!trRoomId) return;
      const trResult = toggleReady(trRoomId, trPlayerId);
      if (!trResult.success) {
        send(ws, { type: "error", message: trResult.error || "无法切换准备状态" });
        return;
      }
      broadcastToRoom(trRoomId, {
        type: "player_ready",
        playerId: trPlayerId,
        isReady: trResult.isReady!,
      });
      for (const p of getRoom(trRoomId)!.players) sendFullState(p.id, trRoomId);
      break;
    }

    case "ping": {
      send(ws, { type: "pong" });
      break;
    }

    case "leave_room": {
      const playerId = socketPlayerMap.get(ws);
      if (!playerId) return;
      const roomId = playerRoomCache.get(playerId);
      if (!roomId) return;
      const { room } = leaveRoom(playerId);
      peerSockets.delete(playerId);
      socketPlayerMap.delete(ws);
      playerRoomCache.delete(playerId);
      if (room) {
        broadcastToRoom(roomId, { type: "player_left", playerId });
        for (const p of room.players) sendFullState(p.id, roomId);
      }
      break;
    }
  }
}

function handleClose(ws: WSWebSocket) {
  const playerId = socketPlayerMap.get(ws);
  if (!playerId) return;

  // 如果该 playerId 已绑定了一个更新的 socket（重连后旧 ws 才触发 close），
  // 只清理旧映射，不触发断线逻辑
  const currentWs = peerSockets.get(playerId);
  if (currentWs !== ws) {
    socketPlayerMap.delete(ws);
    return;
  }

  const roomId = playerRoomCache.get(playerId);

  if (roomId) {
    const room = getRoom(roomId);
    if (room) {
      if (room.phase === "waiting") {
        // 等待阶段：直接移除玩家
        const { room: updatedRoom } = leaveRoom(playerId);
        broadcastToRoom(roomId, { type: "player_left", playerId }, playerId);
        if (updatedRoom) {
          for (const p of updatedRoom.players) sendFullState(p.id, roomId);
        }
        playerRoomCache.delete(playerId);
      } else {
        // 游戏进行中：标记断线，启动计时器
        const engine = getEngine(roomId);
        if (engine) {
          engine.handlePlayerDisconnect(playerId);
        } else {
          const player = room.players.find((p) => p.id === playerId);
          if (player) player.connected = false;
        }

        broadcastToRoom(roomId, { type: "player_left", playerId }, playerId);
        for (const p of room.players) {
          if (p.connected) sendFullState(p.id, roomId);
        }

        // 30s 操作超时：如果该玩家正阻塞流程，30s 后自动执行其操作
        const actionTimer = engine && engine.isPlayerBlockingGame(playerId)
          ? setTimeout(() => {
              const currentRoom = getRoom(roomId);
              const currentEngine = getEngine(roomId);
              if (!currentRoom || !currentEngine) return;
              const p = currentRoom.players.find((pl) => pl.id === playerId);
              if (!p || p.connected) return; // 已重连则跳过

              currentEngine.handlePlayerActionTimeout(playerId);
              const events = currentEngine.getEvents();
              if (events.length > 0) processEngineEvents(roomId, events);
              for (const pl of currentRoom.players) {
                if (pl.connected) sendFullState(pl.id, roomId);
              }
            }, 30_000)
          : null;

        // 60s 重连窗口：到期后真正踢出
        const reconnectTimer = setTimeout(() => {
          disconnectTimers.delete(playerId);
          const currentRoom = getRoom(roomId);
          const currentEngine = getEngine(roomId);
          if (!currentRoom) return;
          const p = currentRoom.players.find((pl) => pl.id === playerId);
          if (!p || p.connected) return; // 已重连则跳过

          if (currentEngine) {
            currentEngine.handlePlayerKick(playerId);
            const events = currentEngine.getEvents();
            if (events.length > 0) processEngineEvents(roomId, events);
          } else {
            p.isSpectator = true;
          }

          for (const pl of currentRoom.players) {
            if (pl.connected) sendFullState(pl.id, roomId);
          }
          playerRoomCache.delete(playerId);
        }, 60_000);

        disconnectTimers.set(playerId, { actionTimer, reconnectTimer });
      }
    }
  }

  peerSockets.delete(playerId);
  socketPlayerMap.delete(ws);
}

function cleanupWsPing(ws: WSWebSocket) {
  const timer = wsPingTimers.get(ws);
  if (timer) { clearInterval(timer); wsPingTimers.delete(ws); }
  wsAlive.delete(ws);
}

/**
 * 由 Vite plugin 调用，处理新的 WebSocket 连接
 * bufferedMessages: 在 handler 加载期间客户端发来的消息
 */
export function handleConnection(ws: WSWebSocket, bufferedMessages: string[]) {
  console.log("[WS] Client connected");

  // 服务端心跳：定时发 ws 协议级 ping，检测死连接
  wsAlive.set(ws, true);
  const pingTimer = setInterval(() => {
    if (!wsAlive.get(ws)) {
      cleanupWsPing(ws);
      ws.terminate();
      return;
    }
    wsAlive.set(ws, false);
    ws.ping();
  }, WS_PING_INTERVAL);
  wsPingTimers.set(ws, pingTimer);

  ws.on("pong", () => {
    wsAlive.set(ws, true);
  });

  // 先处理缓冲的消息
  for (const msg of bufferedMessages) {
    handleMessage(ws, msg);
  }

  // 注册后续消息处理
  ws.on("message", (data: Buffer) => {
    // 收到任何消息也视为存活
    wsAlive.set(ws, true);
    handleMessage(ws, data.toString());
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    cleanupWsPing(ws);
    handleClose(ws);
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err);
    cleanupWsPing(ws);
    handleClose(ws);
  });
}
