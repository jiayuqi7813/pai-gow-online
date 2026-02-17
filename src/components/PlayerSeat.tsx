import type { Player, RoundPlayerResult } from "~/game/types";
import { DominoTile } from "./DominoTile";
import { ChipDisplay } from "./ChipDisplay";

/** 开牌阶段中该玩家的显示状态 */
export type SeatRevealState =
  | "hidden"          // 牌面朝下
  | "banker_revealed" // 庄家已亮牌
  | "revealing"       // 正在翻牌
  | "comparing"       // 正在比牌
  | "settled"         // 已结算
  | null;             // 不在开牌阶段

interface PlayerSeatProps {
  player: Player;
  isSelf: boolean;
  isBanker: boolean;
  isCurrentBidder: boolean;
  showTiles: boolean;
  position: { x: string; y: string; rotation: number };
  revealState?: SeatRevealState;
  playerResult?: RoundPlayerResult | null;
}

export function PlayerSeat({
  player,
  isSelf,
  isBanker,
  isCurrentBidder,
  showTiles,
  position,
  revealState,
  playerResult,
}: PlayerSeatProps) {
  const isInReveal = revealState != null;
  const isRevealActive = revealState === "revealing" || revealState === "comparing";
  const isRevealed = revealState === "settled" || revealState === "banker_revealed";

  const shouldShowTiles = showTiles || isRevealed || revealState === "comparing" || revealState === "revealing";

  return (
    <div
      className={`player-seat absolute flex flex-col items-center gap-1 ${
        isBanker ? "banker" : ""
      } ${isCurrentBidder || isRevealActive ? "active" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%)`,
      }}
    >
      {/* 头像/名字 */}
      <div
        className={`relative rounded-xl px-3 py-1.5 text-center min-w-[60px] ${isRevealActive ? "reveal-seat-active" : ""}`}
        style={{
          background: isRevealActive
            ? "rgba(201,168,76,0.15)"
            : isSelf
              ? "rgba(201,168,76,0.1)"
              : player.connected
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.01)",
          border: isRevealActive
            ? "1px solid rgba(201,168,76,0.5)"
            : isSelf
              ? "1px solid rgba(201,168,76,0.3)"
              : player.connected
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(255,255,255,0.03)",
          opacity: player.connected ? 1 : 0.45,
          backdropFilter: "blur(8px)",
        }}
      >
        {isBanker && (
          <div
            className="absolute -top-2.5 -right-2.5 text-[10px] font-bold px-1.5 py-0.5 rounded font-serif"
            style={{
              background: "var(--accent-crimson)",
              color: "white",
              boxShadow: "0 2px 6px rgba(179,58,58,0.4)",
              letterSpacing: "0.05em",
            }}
          >
            庄
          </div>
        )}
        {isCurrentBidder && !isInReveal && (
          <div
            className="absolute -top-2 -left-2 w-3 h-3 rounded-full animate-pulse-slow"
            style={{
              background: "var(--gold)",
              boxShadow: "0 0 10px rgba(201,168,76,0.6)",
            }}
          />
        )}
        <div className="text-xs font-semibold truncate max-w-[70px] font-serif" style={{ color: "var(--text-primary)" }}>
          {player.name}
          {isSelf && <span style={{ color: "var(--text-gold)" }}> (你)</span>}
        </div>
        <div className="transform scale-90 origin-center my-0.5">
          <ChipDisplay amount={player.chips} size="sm" variant="gold" />
        </div>
        {player.betAmount > 0 && (
          <div className="text-[10px] font-mono" style={{ color: "var(--gold-dim)" }}>
            注: {player.betAmount}
          </div>
        )}

        {/* 开牌结算后的盈亏浮标 */}
        {revealState === "settled" && playerResult && !isBanker && (
          <div
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold font-mono whitespace-nowrap animate-score-pop"
            style={{
              color: playerResult.totalPayout > 0 ? "var(--win-green)"
                : playerResult.totalPayout < 0 ? "var(--lose-red)"
                : "var(--text-secondary)",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {playerResult.totalPayout > 0 ? "+" : ""}{playerResult.totalPayout}
          </div>
        )}
      </div>

      {/* 显示牌 */}
      {shouldShowTiles && player.arrangement && (
        <div className="flex gap-3 mt-1">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-serif" style={{ color: "var(--text-muted)" }}>前道</span>
            <div className="flex gap-0.5">
              {player.arrangement.front.tiles.map((t) => (
                <DominoTile key={t.id} tile={t} small />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-serif" style={{ color: "var(--text-muted)" }}>后道</span>
            <div className="flex gap-0.5">
              {player.arrangement.back.tiles.map((t) => (
                <DominoTile key={t.id} tile={t} small />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 暗牌（未到开牌或发了牌但未结算时） */}
      {!shouldShowTiles && player.tiles.length > 0 && (
        <div className="flex gap-0.5 mt-1">
          {player.tiles.map((t, i) => (
            <DominoTile key={i} tile={t} faceDown small />
          ))}
        </div>
      )}
    </div>
  );
}
