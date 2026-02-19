import { useState, useEffect, useCallback, useRef } from "react";
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
import { AudioControls } from "./AudioControls";
import { useAudio } from "~/hooks/useAudio";

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
    voteNextRound,
    callBanker,
    placeBet,
    arrangeTiles,
    leaveRoom,
    joinPlaying,
    clearError,
    clearResult,
    clearRevealData,
    clearGameOver,
  } = ws;

  const { play: playSound } = useAudio();

  const [showResult, setShowResult] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [arrangeTimeLeft, setArrangeTimeLeft] = useState(60);
  const [nextRoundCountdown, setNextRoundCountdown] = useState(20);
  const [gameOverCountdown, setGameOverCountdown] = useState(15);
  const [gameOverPaused, setGameOverPaused] = useState(false);

  // 阶段切换音效
  const prevPhaseRef = useRef(gameState?.phase);
  useEffect(() => {
    const phase = gameState?.phase;
    if (!phase || phase === prevPhaseRef.current) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    switch (phase) {
      case "bidding":
        if (prev === "waiting") playSound("gameStart");
        break;
      case "betting":
        playSound("notify");
        break;
      case "dealing":
        playSound("cardShuffle");
        break;
      case "arranging":
        playSound("cardFan");
        break;
      case "revealing":
        playSound("reveal");
        break;
      case "settlement":
        // 结算时根据自己盈亏播放不同音效，延迟以避免与 reveal 音效重叠
        break;
    }
  }, [gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // 结算结果音效
  useEffect(() => {
    if (!lastResult || lastResult.type !== "round_result") return;
    const myResult = lastResult.results.find((r) => r.playerId === playerId);
    const isMeBanker = lastResult.bankerResult.playerId === playerId;
    const payout = isMeBanker ? lastResult.bankerResult.totalPayout : (myResult?.totalPayout ?? 0);
    setTimeout(() => {
      if (payout > 0) playSound("win");
      else if (payout < 0) playSound("lose");
      else playSound("notify");
    }, 300);
  }, [lastResult]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (gameState?.phase === "waiting" || gameState?.phase === "bidding" || gameState?.phase === "betting") {
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
      setArrangeTimeLeft((t) => {
        const next = Math.max(0, t - 1);
        if (next > 0 && next <= 5) playSound("countdown");
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
    bidding: "叫庄中",
    betting: "下注阶段",
    dealing: "发牌中",
    arranging: "搭配阶段",
    revealing: "开牌中",
    comparing: "比牌中",
    settlement: "结算",
  };

  const handleVoteNextRound = () => {
    playSound("click");
    voteNextRound();
  };

  const handleBackToLobby = () => {
    clearGameOver();
    clearResult();
    clearRevealData();
    setShowResult(false);
    setRevealDone(false);
    setNextRoundCountdown(20);
  };

  // 倒计时归零时自动投票下一局（每个在席玩家各自自动投票）
  const hasVoted = gameState.nextRoundVotes.includes(playerId);
  useEffect(() => {
    if (nextRoundCountdown === 0 && !isSpectator && gameState.phase === "settlement" && !gameOverData && !hasVoted) {
      handleVoteNextRound();
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
            第{gameState.roundNumber}/10局
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
          <AudioControls />
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

        {/* 叫庄阶段 — 所有人可看 */}
        {!isRevealing && gameState.phase === "bidding" && (
          <BiddingPanel
            players={seatPlayers}
            myPlayerId={playerId}
            biddingCurrentId={gameState.biddingCurrentId}
            biddingHighScore={gameState.biddingHighScore}
            biddingHighPlayerId={gameState.biddingHighPlayerId}
            biddingOrder={gameState.biddingOrder}
            biddingDone={gameState.biddingDone}
            biddingScores={gameState.biddingScores}
            isSpectator={isSpectator}
            onCall={(score) => { playSound("click"); callBanker(score); }}
          />
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
              {!isSpectator && (
                <button
                  onClick={handleVoteNextRound}
                  disabled={hasVoted}
                  className="btn btn-primary flex-1 py-3 rounded-xl font-serif"
                  style={hasVoted ? { opacity: 0.6 } : undefined}
                >
                  {hasVoted ? "已确认" : gameState.roundNumber >= 10 ? "结束游戏" : "下一局"} ({gameState.nextRoundVotes.length}/{gameState.nextRoundVoteTotal})
                  <span className="text-xs ml-1 opacity-70">{nextRoundCountdown}s</span>
                </button>
              )}
            </div>
            {isSpectator && (
              <div className="text-center">
                <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>
                  等待玩家确认下一局 ({gameState.nextRoundVotes.length}/{gameState.nextRoundVoteTotal}) {nextRoundCountdown}s
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
          onVoteNextRound={handleVoteNextRound}
          isSpectator={isSpectator}
          hasVoted={hasVoted}
          votedCount={gameState.nextRoundVotes.length}
          voteTotal={gameState.nextRoundVoteTotal}
          players={gameState.players}
          roundNumber={gameState.roundNumber}
          maxRounds={10}
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

function BiddingPanel({
  players,
  myPlayerId,
  biddingCurrentId,
  biddingHighScore,
  biddingHighPlayerId,
  biddingOrder,
  biddingDone,
  biddingScores,
  isSpectator,
  onCall,
}: {
  players: import("~/game/types").Player[];
  myPlayerId: string;
  biddingCurrentId: string | null;
  biddingHighScore: number;
  biddingHighPlayerId: string | null;
  biddingOrder: string[];
  biddingDone: string[];
  biddingScores: Record<string, number>;
  isSpectator: boolean;
  onCall: (score: number) => void;
}) {
  const isMyTurn = biddingCurrentId === myPlayerId;
  const currentPlayer = players.find((p) => p.id === biddingCurrentId);
  const highPlayer = biddingHighPlayerId ? players.find((p) => p.id === biddingHighPlayerId) : null;

  const scoreLabels = ["", "一分", "二分", "三分"];

  return (
    <div className="panel-glass p-5 animate-slide-up">
      <div className="text-center mb-4">
        <div className="font-serif text-lg font-semibold" style={{ color: "var(--text-gold)" }}>
          叫庄
        </div>
        <div className="text-xs font-serif mt-1" style={{ color: "var(--text-muted)" }}>
          叫分高者当庄，叫分不影响赔率
        </div>
      </div>

      {/* 当前最高叫分 */}
      {biddingHighScore > 0 && highPlayer && (
        <div
          className="text-center mb-3 py-2 rounded-lg"
          style={{
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          <span className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
            当前最高：
          </span>
          <span className="font-serif font-bold ml-1" style={{ color: "var(--text-gold)" }}>
            {highPlayer.name} — {scoreLabels[biddingHighScore]}
          </span>
        </div>
      )}

      {/* 叫庄顺序和状态 */}
      <div className="space-y-1 mb-4">
        {biddingOrder.map((pid) => {
          const p = players.find((pl) => pl.id === pid);
          if (!p) return null;
          const isDone = biddingDone.includes(pid);
          const isCurrent = pid === biddingCurrentId;
          const isMe = pid === myPlayerId;

          return (
            <div
              key={pid}
              className="flex items-center justify-between px-3 py-2 rounded-lg transition-all"
              style={{
                background: isCurrent
                  ? "rgba(201,168,76,0.1)"
                  : "rgba(255,255,255,0.01)",
                border: isCurrent
                  ? "1px solid rgba(201,168,76,0.25)"
                  : "1px solid transparent",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: isCurrent
                      ? "var(--text-gold)"
                      : isDone
                        ? "var(--accent-jade)"
                        : "rgba(255,255,255,0.15)",
                    boxShadow: isCurrent ? "0 0 6px rgba(201,168,76,0.6)" : "none",
                    animation: isCurrent ? "pulse 1.5s infinite" : "none",
                  }}
                />
                <span
                  className="text-sm font-serif"
                  style={{
                    color: isCurrent
                      ? "var(--text-gold)"
                      : isMe
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    fontWeight: isCurrent || isMe ? 600 : 400,
                  }}
                >
                  {p.name}{isMe ? " (你)" : ""}
                </span>
              </div>
              <span
                className="text-xs font-serif px-2 py-0.5 rounded"
                style={{
                  background: isCurrent
                    ? "rgba(201,168,76,0.15)"
                    : isDone && biddingScores[pid] > 0
                      ? "rgba(201,168,76,0.1)"
                      : isDone
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.03)",
                  color: isCurrent
                    ? "var(--text-gold)"
                    : isDone && biddingScores[pid] > 0
                      ? "var(--text-gold)"
                      : isDone
                        ? "var(--text-muted)"
                        : "var(--text-muted)",
                  border: isCurrent
                    ? "1px solid rgba(201,168,76,0.25)"
                    : isDone && biddingScores[pid] > 0
                      ? "1px solid rgba(201,168,76,0.2)"
                      : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {isCurrent ? "叫庄中..." : isDone ? (biddingScores[pid] > 0 ? scoreLabels[biddingScores[pid]] : "不叫") : "等待"}
              </span>
            </div>
          );
        })}
      </div>

      {/* 操作按钮 */}
      {isMyTurn && !isSpectator && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {[1, 2, 3].map((score) => (
              <button
                key={score}
                onClick={() => onCall(score)}
                disabled={score <= biddingHighScore}
                className="btn btn-primary flex-1 py-3 rounded-xl font-serif text-base font-bold transition-all"
                style={score <= biddingHighScore ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
              >
                {scoreLabels[score]}
              </button>
            ))}
          </div>
          <button
            onClick={() => onCall(0)}
            className="btn btn-secondary w-full py-2.5 rounded-xl font-serif"
          >
            不叫
          </button>
        </div>
      )}

      {/* 等待其他玩家叫庄 */}
      {!isMyTurn && !isSpectator && biddingDone.includes(myPlayerId) && (
        <div className="text-center py-2">
          <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>
            等待其他玩家叫庄...
          </span>
        </div>
      )}

      {/* 观战者提示 */}
      {isSpectator && (
        <div className="text-center py-2">
          <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>
            {currentPlayer ? `${currentPlayer.name} 正在叫庄...` : "叫庄中..."}
          </span>
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
