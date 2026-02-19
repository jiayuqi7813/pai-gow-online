import { useState, useEffect, useCallback } from "react";
import type { RoundPlayerResult, ServerMessage, Player } from "~/game/types";
import { DominoTile } from "./DominoTile";

interface ResultModalProps {
  result: Extract<ServerMessage, { type: "round_result" }>;
  myPlayerId: string;
  onClose: () => void;
  onVoteNextRound: () => void;
  isSpectator: boolean;
  hasVoted: boolean;
  votedCount: number;
  voteTotal: number;
  players?: Player[];
  roundNumber?: number;
  maxRounds?: number;
}

export function ResultModal({ result, myPlayerId, onClose, onVoteNextRound, isSpectator, hasVoted, votedCount, voteTotal, players, roundNumber, maxRounds }: ResultModalProps) {
  const { results, bankerResult } = result;

  // 10 秒自动关闭倒计时
  const [countdown, setCountdown] = useState(10);
  const [paused, setPaused] = useState(false);

  const stableOnClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stableOnClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, stableOnClose]);

  // 检测结算后筹码 <= 0 的玩家
  const getPlayerChips = (playerId: string): number | null => {
    if (!players) return null;
    const p = players.find((pl) => pl.id === playerId);
    return p ? p.chips : null;
  };

  const isBankrupt = (playerId: string): boolean => {
    const chips = getPlayerChips(playerId);
    return chips !== null && chips <= 0;
  };

  // 检查是否有玩家将要破产
  const bankruptPlayers = players
    ? players.filter((p) => p.chips <= 0 && p.connected)
    : [];
  const willGameEnd = players
    ? players.filter((p) => p.chips > 0 && p.connected).length < 2
    : false;
  const isLastRound = !!(roundNumber && maxRounds && roundNumber >= maxRounds);

  const myResult = results.find((r) => r.playerId === myPlayerId);
  const isBanker = bankerResult.playerId === myPlayerId;

  const totalPayoutForMe = isBanker ? bankerResult.totalPayout : (myResult?.totalPayout ?? 0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: "rgba(12,10,20,0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="panel-glass w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-slide-up"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* 标题 */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
          <div className="w-16" />
          <h2 className="text-2xl font-bold text-center font-display" style={{ color: "var(--text-gold)" }}>
            本局结算
          </h2>
          <div className="w-16 text-right">
            <span
              className="text-xs font-mono"
              style={{ color: paused ? "var(--accent-jade)" : "var(--text-muted)" }}
            >
              {paused ? "已暂停" : `${countdown}s`}
            </span>
          </div>
        </div>

        {/* 我的结果 */}
        <div
          className="p-5"
          style={{
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            background: totalPayoutForMe > 0
              ? "rgba(74,222,128,0.04)"
              : totalPayoutForMe < 0
                ? "rgba(239,107,107,0.04)"
                : "transparent",
          }}
        >
          <div className="text-center">
            <div
              className="text-3xl font-bold mb-1 font-mono animate-score-pop"
              style={{
                color: totalPayoutForMe > 0
                  ? "var(--win-green)"
                  : totalPayoutForMe < 0
                    ? "var(--lose-red)"
                    : "var(--text-secondary)",
              }}
            >
              {totalPayoutForMe > 0 ? "+" : ""}{totalPayoutForMe}
            </div>
            <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
              {isBanker ? "庄家总盈亏" : "你的总盈亏"}
            </div>
          </div>

          {myResult && !isBanker && (
            <div className="flex justify-center gap-6 mt-3">
              <div className="text-center">
                <span className="text-xs font-serif" style={{ color: "var(--accent-jade)" }}>前道 ×1</span>
                <div
                  className="text-sm font-bold font-mono"
                  style={{ color: myResult.frontPayout >= 0 ? "var(--win-green)" : "var(--lose-red)" }}
                >
                  {myResult.frontPayout > 0 ? "+" : ""}{myResult.frontPayout}
                </div>
                <div className="text-[10px] font-serif" style={{ color: "var(--text-muted)" }}>
                  {myResult.frontResult.description}
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs font-serif" style={{ color: "var(--accent-crimson-light)" }}>后道 ×2</span>
                <div
                  className="text-sm font-bold font-mono"
                  style={{ color: myResult.backPayout >= 0 ? "var(--win-green)" : "var(--lose-red)" }}
                >
                  {myResult.backPayout > 0 ? "+" : ""}{myResult.backPayout}
                </div>
                <div className="text-[10px] font-serif" style={{ color: "var(--text-muted)" }}>
                  {myResult.backResult.description}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 庄家的牌 */}
        <div className="p-4" style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
          <div className="text-sm font-semibold font-serif mb-2" style={{ color: "var(--text-gold)" }}>
            庄家: {bankerResult.playerName}
          </div>
          <div className="flex gap-4 justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-serif" style={{ color: "var(--accent-jade)" }}>前道</span>
              <div className="flex gap-1">
                {bankerResult.arrangement.front.tiles.map((t) => (
                  <DominoTile key={t.id} tile={t} small />
                ))}
              </div>
              <span className="text-[10px] font-serif" style={{ color: "var(--text-secondary)" }}>
                {bankerResult.frontEval.description}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-serif" style={{ color: "var(--accent-crimson-light)" }}>后道</span>
              <div className="flex gap-1">
                {bankerResult.arrangement.back.tiles.map((t) => (
                  <DominoTile key={t.id} tile={t} small />
                ))}
              </div>
              <span className="text-[10px] font-serif" style={{ color: "var(--text-secondary)" }}>
                {bankerResult.backEval.description}
              </span>
            </div>
          </div>
        </div>

        {/* 所有玩家结果 */}
        <div className="p-4 space-y-2">
          {results.map((r, idx) => (
            <ResultRow
              key={r.playerId}
              result={r}
              isMe={r.playerId === myPlayerId}
              delay={idx * 0.08}
              bankrupt={isBankrupt(r.playerId)}
            />
          ))}
          {/* 庄家破产标记 */}
          {isBankrupt(bankerResult.playerId) && (
            <div
              className="text-center text-sm font-serif py-2 rounded-xl"
              style={{
                background: "rgba(239,107,107,0.08)",
                border: "1px solid rgba(239,107,107,0.2)",
                color: "var(--lose-red)",
              }}
            >
              庄家 {bankerResult.playerName} 已破产
            </div>
          )}
        </div>

        {/* 破产预警 */}
        {bankruptPlayers.length > 0 && (
          <div
            className="mx-4 mb-2 p-3 rounded-xl text-center"
            style={{
              background: "rgba(239,107,107,0.06)",
              border: "1px solid rgba(239,107,107,0.15)",
            }}
          >
            <div className="text-sm font-serif" style={{ color: "var(--lose-red)" }}>
              {bankruptPlayers.map((p) => p.name).join("、")} 已破产淘汰
            </div>
            {willGameEnd && (
              <div className="text-xs mt-1 font-serif" style={{ color: "var(--text-muted)" }}>
                剩余玩家不足，游戏将结束
              </div>
            )}
          </div>
        )}

        {isLastRound && !willGameEnd && bankruptPlayers.length === 0 && (
          <div
            className="mx-4 mb-2 p-3 rounded-xl text-center"
            style={{
              background: "rgba(201,168,76,0.06)",
              border: "1px solid rgba(201,168,76,0.15)",
            }}
          >
            <div className="text-sm font-serif" style={{ color: "var(--text-gold)" }}>
              已达到 {maxRounds} 局上限，点击下一局将结算全场
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div className="p-4 flex gap-3" style={{ borderTop: "1px solid rgba(201,168,76,0.1)" }}>
          <button onClick={onClose} className="btn btn-secondary flex-1 py-2.5 rounded-xl font-serif">
            关闭 ({countdown}s)
          </button>
          {!isSpectator && (
            <button
              onClick={onVoteNextRound}
              disabled={hasVoted}
              className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif"
              style={hasVoted ? { opacity: 0.6 } : undefined}
            >
              {hasVoted ? "已确认" : (willGameEnd || isLastRound) ? "结束游戏" : "下一局"} ({votedCount}/{voteTotal})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ result, isMe, delay, bankrupt }: { result: RoundPlayerResult; isMe: boolean; delay: number; bankrupt?: boolean }) {
  return (
    <div
      className="flex items-center justify-between p-2.5 rounded-xl text-sm animate-fade-in"
      style={{
        background: bankrupt
          ? "rgba(239,107,107,0.06)"
          : isMe
            ? "rgba(201,168,76,0.06)"
            : "rgba(255,255,255,0.02)",
        border: bankrupt
          ? "1px solid rgba(239,107,107,0.2)"
          : isMe
            ? "1px solid rgba(201,168,76,0.15)"
            : "1px solid rgba(255,255,255,0.03)",
        animationDelay: `${delay}s`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-serif font-medium" style={{ color: bankrupt ? "var(--lose-red)" : "var(--text-primary)" }}>
          {result.playerName}
          {isMe && <span className="text-xs" style={{ color: "var(--text-gold)" }}> (你)</span>}
          {bankrupt && (
            <span
              className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold"
              style={{
                background: "rgba(239,107,107,0.15)",
                color: "var(--lose-red)",
                border: "1px solid rgba(239,107,107,0.25)",
              }}
            >
              已破产
            </span>
          )}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          注:{result.betAmount}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xs font-serif">
          <span style={{ color: "var(--accent-jade)" }}>
            前{result.frontResult.result > 0 ? "胜" : result.frontResult.result < 0 ? "负" : "平"}
          </span>
          {" / "}
          <span style={{ color: "var(--accent-crimson-light)" }}>
            后{result.backResult.result > 0 ? "胜" : result.backResult.result < 0 ? "负" : "平"}
          </span>
        </div>
        <span
          className="font-bold font-mono"
          style={{
            color: result.totalPayout > 0
              ? "var(--win-green)"
              : result.totalPayout < 0
                ? "var(--lose-red)"
                : "var(--text-secondary)",
          }}
        >
          {result.totalPayout > 0 ? "+" : ""}{result.totalPayout}
        </span>
      </div>
    </div>
  );
}
