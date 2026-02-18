import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { useWebSocket } from "~/hooks/useWebSocket";
import type { ServerMessage } from "~/game/types";
import { PlayerSeat } from "./PlayerSeat";
import type { SeatRevealState } from "./PlayerSeat";
import { ArrangeTiles } from "./ArrangeTiles";
import { BetPanel } from "./BetPanel";
import { ResultModal } from "./ResultModal";
import { RevealSequence } from "./RevealSequence";
import type { RevealStep } from "./RevealSequence";
import { PlayerListPanel } from "./PlayerListPanel";

type WS = ReturnType<typeof useWebSocket>;

/** 计算玩家在椭圆桌上的位置 */
function getSeatPositions(count: number, selfIndex: number) {
  const positions: { x: string; y: string; rotation: number }[] = [];

  for (let i = 0; i < count; i++) {
    const offset = (i - selfIndex + count) % count;
    const angle = (offset / count) * 2 * Math.PI - Math.PI / 2;

    const rx = 42;
    const ry = 38;

    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);

    positions.push({
      x: `${x}%`,
      y: `${y}%`,
      rotation: (angle * 180) / Math.PI,
    });
  }

  return positions;
}

export function GameBoard({ ws }: { ws: WS }) {
  const navigate = useNavigate();
  const {
    gameState,
    playerId,
    myTiles,
    lastError,
    lastResult,
    revealData,
    gameOverData,
    isSpectator,
    startGame,
    placeBet,
    arrangeTiles,
    leaveRoom,
    joinPlaying,
    clearError,
    clearResult,
    clearRevealData,
    clearGameOver,
  } = ws;

  const [showResult, setShowResult] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [arrangeTimeLeft, setArrangeTimeLeft] = useState(60);
  const [nextRoundCountdown, setNextRoundCountdown] = useState(20);
  const [gameOverCountdown, setGameOverCountdown] = useState(15);
  const [gameOverPaused, setGameOverPaused] = useState(false);

  // 开牌序列完成后，显示结算弹窗
  const handleRevealDone = useCallback(() => {
    setRevealDone(true);
    setShowResult(true);
  }, []);

  // 收到 round_result 且非开牌模式时(兼容旧逻辑)，直接显示结果
  useEffect(() => {
    if (lastResult && lastResult.type === "round_result" && !revealData) {
      setShowResult(true);
    }
  }, [lastResult, revealData]);

  // 进入新的 revealing 阶段时，重置状态
  useEffect(() => {
    if (revealData) {
      setRevealDone(false);
      setShowResult(false);
    }
  }, [revealData]);

  // 进入新一局（waiting/betting）时清除上一局残留的结算状态
  useEffect(() => {
    if (gameState?.phase === "waiting" || gameState?.phase === "betting") {
      setShowResult(false);
      setRevealDone(false);
      clearResult();
      clearRevealData();
    }
  }, [gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState?.phase !== "arranging") return;

    setArrangeTimeLeft(60);
    const timer = setInterval(() => {
      setArrangeTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.phase]);

  // 20 秒自动下一局倒计时（结算阶段 + 开牌已完成 + ResultModal 已关闭 + 非游戏结束）
  const stillRevealing = !!(revealData && !revealDone);
  useEffect(() => {
    const isSettlementReady =
      gameState?.phase === "settlement" && !showResult && !gameOverData && !stillRevealing;

    if (!isSettlementReady) {
      setNextRoundCountdown(20);
      return;
    }

    const timer = setInterval(() => {
      setNextRoundCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.phase, showResult, gameOverData, stillRevealing]);

  // gameOverData 面板 15 秒自动关闭倒计时
  useEffect(() => {
    if (!gameOverData) {
      setGameOverCountdown(15);
      return;
    }
    if (gameOverPaused) return;

    const timer = setInterval(() => {
      setGameOverCountdown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOverData, gameOverPaused]);

  if (!gameState || !playerId) return null;

  const me = gameState.players.find((p) => p.id === playerId);
  if (!me) return null;

  // 牌桌上只显示参战玩家的座位
  const seatPlayers = gameState.players.filter((p) => !p.isSpectator);
  const selfSeatIndex = isSpectator ? -1 : seatPlayers.findIndex((p) => p.id === playerId);
  const positions = getSeatPositions(seatPlayers.length, Math.max(0, selfSeatIndex));
  const isHost = me.isHost;
  const isBanker = gameState.bankerId === playerId;

  // 在 revealing/settlement 阶段且有 revealData 时，使用开牌序列
  const isRevealing = revealData && !revealDone;
  const showTilesOnTable = gameState.phase === "settlement" || gameState.phase === "comparing" || gameState.phase === "revealing";

  const phaseLabels: Record<string, string> = {
    waiting: "等待中",
    betting: "下注阶段",
    dealing: "发牌中",
    arranging: "搭配阶段",
    revealing: "开牌中",
    comparing: "比牌中",
    settlement: "结算",
  };

  const handleNextRound = () => {
    setShowResult(false);
    setRevealDone(false);
    clearResult();
    clearRevealData();
    startGame();
  };

  const handleBackToLobby = () => {
    clearGameOver();
    clearResult();
    clearRevealData();
    setShowResult(false);
    setRevealDone(false);
    setNextRoundCountdown(20);
  };

  // 倒计时归零时房主自动触发下一局
  useEffect(() => {
    if (nextRoundCountdown === 0 && isHost && gameState.phase === "settlement" && !gameOverData) {
      handleNextRound();
    }
  }, [nextRoundCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // gameOverData 倒计时归零时自动返回大厅
  useEffect(() => {
    if (gameOverCountdown === 0 && gameOverData) {
      handleBackToLobby();
    }
  }, [gameOverCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算牌桌上每个座位在开牌阶段的显示状态
  const getSeatRevealState = (pId: string): SeatRevealState => {
    if (!isRevealing || !revealData) return null;

    // 庄家
    if (pId === gameState.bankerId) {
      return "banker_revealed";
    }

    // 闲家：根据 revealOrder 中的位置决定状态
    // RevealSequence 组件会管理具体步骤，
    // 这里简单地根据 revealing 状态设置
    const orderIdx = revealData.revealOrder.indexOf(pId);
    if (orderIdx < 0) return "hidden";

    return "hidden"; // 默认隐藏，详细状态由 RevealSequence 内部管理
  };

  const getPlayerResultForSeat = (pId: string) => {
    if (!revealData) return null;
    return revealData.playerResults.find((r) => r.playerId === pId) || null;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-deep)" }}>
      {/* 顶部信息栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: "rgba(22,18,34,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(201,168,76,0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm" style={{ color: "var(--text-secondary)" }}>房间</span>
          <span className="font-mono font-bold tracking-wider" style={{ color: "var(--text-gold)" }}>
            {gameState.roomId}
          </span>
          <span className="font-serif text-xs" style={{ color: "var(--text-muted)" }}>
            第{gameState.roundNumber}局
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-sm px-3 py-1 rounded-lg font-serif"
            style={{
              background: isRevealing
                ? "rgba(201,168,76,0.12)"
                : gameState.phase === "arranging"
                  ? "rgba(201,168,76,0.12)"
                  : "rgba(255,255,255,0.03)",
              color: isRevealing || gameState.phase === "arranging"
                ? "var(--text-gold)"
                : "var(--text-secondary)",
              border: isRevealing || gameState.phase === "arranging"
                ? "1px solid rgba(201,168,76,0.2)"
                : "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {isRevealing ? "开牌中" : phaseLabels[gameState.phase] || gameState.phase}
          </span>
          {isSpectator && (
            <span
              className="text-xs px-2 py-0.5 rounded font-serif"
              style={{
                background: "rgba(91,158,122,0.1)",
                color: "var(--accent-jade)",
                border: "1px solid rgba(91,158,122,0.2)",
              }}
            >
              观战中
            </span>
          )}
          <button
            onClick={() => { leaveRoom(); navigate({ to: "/" }); }}
            className="text-xs transition-colors font-serif"
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-crimson-light)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          >
            退出
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {lastError && (
        <div
          className="mx-4 mt-2 p-2.5 rounded-xl text-sm text-center animate-fade-in font-serif"
          style={{
            background: "rgba(179,58,58,0.1)",
            border: "1px solid rgba(179,58,58,0.25)",
            color: "var(--accent-crimson-light)",
          }}
        >
          {lastError}
          <button
            onClick={clearError}
            className="ml-2 transition-colors"
            style={{ color: "var(--accent-crimson)", cursor: "pointer", background: "none", border: "none" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-crimson-light)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--accent-crimson)"}
          >
            ×
          </button>
        </div>
      )}

      {/* 牌桌区域 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="game-table relative w-full max-w-[800px] aspect-[16/9] sm:aspect-[7/4]">
          {/* 中间信息 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-0 pointer-events-none">
            <div className="font-display text-2xl opacity-20 tracking-[0.5em] mb-2" style={{ color: "var(--gold)" }}>
              東方遊藝
            </div>
            <div className="font-serif text-lg font-bold" style={{ color: "var(--text-gold)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
              {isRevealing ? "开牌中" : phaseLabels[gameState.phase]}
            </div>
            {gameState.bankerId && (
              <div className="text-xs mt-1.5 font-serif" style={{ color: "var(--text-secondary)" }}>
                庄: {gameState.players.find((p) => p.id === gameState.bankerId)?.name}
              </div>
            )}
          </div>

          {/* 玩家座位（仅参战玩家） */}
          {seatPlayers.map((player, idx) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isSelf={player.id === playerId}
              isBanker={player.id === gameState.bankerId}
              showTiles={showTilesOnTable && !isRevealing}
              position={positions[idx]}
              revealState={isRevealing ? getSeatRevealState(player.id) : (revealDone ? "settled" : null)}
              playerResult={getPlayerResultForSeat(player.id)}
            />
          ))}
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="px-4 pb-4 max-w-lg mx-auto w-full">
        {/* 开牌序列（观战者也能看） */}
        {isRevealing && revealData && (
          <RevealSequence
            revealData={revealData}
            myPlayerId={playerId}
            onDone={handleRevealDone}
          />
        )}

        {/* 观战者提示 */}
        {isSpectator && !isRevealing && gameState.phase !== "waiting" && gameState.phase !== "settlement" && (
          <div className="panel-glass p-4 text-center animate-fade-in">
            <div className="text-sm font-serif" style={{ color: "var(--accent-jade)" }}>
              观战模式
            </div>
            <p className="text-xs mt-1 font-serif" style={{ color: "var(--text-muted)" }}>
              你正在观看比赛，可在玩家列表中请求下局参战
            </p>
          </div>
        )}

        {/* 参战玩家操作区 */}
        {!isSpectator && (
          <>
            {/* 下注阶段 */}
            {!isRevealing && gameState.phase === "betting" && (
              <BetPanel
                isBanker={isBanker}
                hasBet={me.betAmount > 0}
                myChips={me.chips}
                onBet={placeBet}
                players={gameState.players}
                myPlayerId={playerId}
                bankerId={gameState.bankerId}
              />
            )}

            {/* 搭配阶段 */}
            {!isRevealing && gameState.phase === "arranging" && myTiles.length === 4 && !me.arrangement && (
              <ArrangeTiles
                tiles={myTiles}
                onSubmit={arrangeTiles}
                timeLeft={arrangeTimeLeft}
              />
            )}

            {!isRevealing && gameState.phase === "arranging" && me.arrangement && (
              <div className="panel-glass p-5 animate-slide-up">
                <div className="text-lg mb-2 font-serif text-center" style={{ color: "var(--accent-jade)" }}>
                  已完成搭配
                </div>
                <WaitingPlayerStatus
                  players={seatPlayers}
                  myPlayerId={playerId}
                  getStatus={(p) => p.arrangement ? "done" : "waiting"}
                  doneLabel="已配牌"
                  waitingLabel="配牌中"
                />
              </div>
            )}
          </>
        )}

        {/* 结算阶段（开牌完成后的控制）— 所有人可看 */}
        {!isRevealing && gameState.phase === "settlement" && !showResult && (
          <div className="space-y-2">
            <div className="flex gap-3">
              <button
                onClick={() => setShowResult(true)}
                className="btn btn-secondary flex-1 py-3 rounded-xl font-serif"
              >
                查看结果
              </button>
              {isHost && (
                <button onClick={handleNextRound} className="btn btn-primary flex-1 py-3 rounded-xl font-serif">
                  下一局 ({nextRoundCountdown}s)
                </button>
              )}
            </div>
            {!isHost && (
              <div className="text-center">
                <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>
                  等待房主开始下一局 ({nextRoundCountdown}s)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 结算弹窗 — 仅在开牌序列完成后或无开牌数据时显示 */}
      {showResult && lastResult && lastResult.type === "round_result" && !gameOverData && (
        <ResultModal
          result={lastResult as Extract<ServerMessage, { type: "round_result" }>}
          myPlayerId={playerId}
          onClose={() => setShowResult(false)}
          onNextRound={handleNextRound}
          isHost={isHost}
          players={gameState.players}
        />
      )}

      {/* 玩家列表面板 */}
      <PlayerListPanel
        players={gameState.players}
        myPlayerId={playerId}
        bankerId={gameState.bankerId}
        isSpectator={isSpectator}
        onJoinPlaying={isSpectator ? joinPlaying : undefined}
      />

      {/* 游戏结束面板 */}
      {gameOverData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto"
            style={{
              background: "linear-gradient(160deg, rgba(42,32,60,0.98) 0%, rgba(22,18,34,0.98) 100%)",
              border: "1px solid rgba(201,168,76,0.3)",
              boxShadow: "0 0 60px rgba(201,168,76,0.15), 0 25px 50px rgba(0,0,0,0.5)",
            }}
            onMouseEnter={() => setGameOverPaused(true)}
            onMouseLeave={() => setGameOverPaused(false)}
          >
            {/* 标题 */}
            <div
              className="p-6 text-center"
              style={{
                background: "linear-gradient(180deg, rgba(201,168,76,0.12) 0%, transparent 100%)",
                borderBottom: "1px solid rgba(201,168,76,0.15)",
              }}
            >
              <div className="font-display text-3xl mb-2" style={{ color: "var(--text-gold)" }}>
                游戏结束
              </div>
              <div className="font-serif text-sm" style={{ color: "var(--text-secondary)" }}>
                {gameOverData.reason}
              </div>
              <div className="font-serif text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                共进行 {gameOverData.totalRounds} 局
              </div>
            </div>

            {/* 排名 */}
            <div className="p-5 space-y-2.5">
              <div className="font-serif text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                最终排名
              </div>
              {gameOverData.rankings.map((r, idx) => {
                const winRate = r.stats.totalRounds > 0
                  ? Math.round((r.stats.wins / r.stats.totalRounds) * 100)
                  : 0;
                return (
                  <div
                    key={r.name}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: idx === 0
                        ? "linear-gradient(90deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.05) 100%)"
                        : "rgba(255,255,255,0.03)",
                      border: idx === 0
                        ? "1px solid rgba(201,168,76,0.25)"
                        : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 flex items-center justify-center rounded-full font-serif text-sm font-bold flex-shrink-0"
                          style={{
                            background: idx === 0
                              ? "linear-gradient(135deg, var(--gold), var(--gold-light))"
                              : idx === 1
                                ? "rgba(192,192,192,0.2)"
                                : idx === 2
                                  ? "rgba(205,127,50,0.2)"
                                  : "rgba(255,255,255,0.08)",
                            color: idx === 0 ? "var(--bg-deep)" : "var(--text-secondary)",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-serif font-semibold" style={{ color: idx === 0 ? "var(--text-gold)" : "var(--text-primary)" }}>
                            {r.name}
                          </span>
                        </div>
                      </div>
                      <span
                        className="font-mono font-bold text-lg"
                        style={{ color: idx === 0 ? "var(--text-gold)" : "var(--text-secondary)" }}
                      >
                        {r.chips.toLocaleString()}
                      </span>
                    </div>
                    {/* 胜负详情 */}
                    <div
                      className="px-4 pb-2.5 flex items-center gap-4 text-xs font-serif"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>
                        <span style={{ color: "var(--win-green)" }}>{r.stats.wins}胜</span>
                        {" / "}
                        <span style={{ color: "var(--lose-red)" }}>{r.stats.losses}负</span>
                        {" / "}
                        <span>{r.stats.draws}平</span>
                      </span>
                      <span>参与 {r.stats.totalRounds} 局</span>
                      <span>胜率 {winRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 按钮 */}
            <div className="px-6 pb-6">
              <button
                onClick={handleBackToLobby}
                className="w-full py-3 rounded-xl font-serif text-base font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
                  color: "var(--bg-deep)",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(201,168,76,0.3)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 6px 20px rgba(201,168,76,0.5)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 4px 15px rgba(201,168,76,0.3)"}
              >
                返回大厅 ({gameOverCountdown}s){gameOverPaused ? " · 已暂停" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WaitingPlayerStatus({
  players,
  myPlayerId,
  getStatus,
  doneLabel,
  waitingLabel,
}: {
  players: import("~/game/types").Player[];
  myPlayerId: string;
  getStatus: (p: import("~/game/types").Player) => "done" | "waiting";
  doneLabel: string;
  waitingLabel: string;
}) {
  const done = players.filter((p) => getStatus(p) === "done").length;
  const total = players.length;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>
          玩家进度
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
          {done}/{total}
        </span>
      </div>
      <div className="space-y-1">
        {players.map((p) => {
          const isDone = getStatus(p) === "done";
          const isMe = p.id === myPlayerId;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
              style={{
                background: isMe ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.01)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: isDone ? "var(--accent-jade)" : "rgba(201,168,76,0.5)",
                    boxShadow: isDone ? "0 0 4px rgba(91,158,122,0.5)" : "none",
                  }}
                />
                <span className="text-xs font-serif" style={{ color: isMe ? "var(--text-gold)" : "var(--text-primary)" }}>
                  {p.name}{isMe ? " (你)" : ""}
                </span>
              </div>
              <span
                className="text-[10px] font-serif px-1.5 py-0.5 rounded"
                style={{
                  background: isDone ? "rgba(91,158,122,0.1)" : "rgba(201,168,76,0.08)",
                  color: isDone ? "var(--accent-jade)" : "var(--text-muted)",
                  border: isDone ? "1px solid rgba(91,158,122,0.2)" : "1px solid rgba(201,168,76,0.12)",
                }}
              >
                {isDone ? doneLabel : waitingLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
