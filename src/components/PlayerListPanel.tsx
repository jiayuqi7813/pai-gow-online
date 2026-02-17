import { useState } from "react";
import type { Player } from "~/game/types";
import { ChipDisplay } from "./ChipDisplay";

interface PlayerListPanelProps {
  players: Player[];
  myPlayerId: string;
  bankerId: string | null;
  isSpectator: boolean;
  onJoinPlaying?: () => void;
}

export function PlayerListPanel({
  players,
  myPlayerId,
  bankerId,
  isSpectator,
  onJoinPlaying,
}: PlayerListPanelProps) {
  const [open, setOpen] = useState(false);

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  return (
    <>
      {/* 悬浮切换按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-14 right-3 z-40 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
        style={{
          background: open ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)",
          border: open ? "1px solid rgba(201,168,76,0.35)" : "1px solid rgba(255,255,255,0.08)",
          color: open ? "var(--text-gold)" : "var(--text-secondary)",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {/* 人数角标 */}
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold font-mono px-1"
          style={{
            background: "var(--gold)",
            color: "var(--bg-deep)",
          }}
        >
          {players.filter((p) => p.connected).length}
        </span>
      </button>

      {/* 面板 */}
      {open && (
        <div
          className="fixed top-24 right-3 z-40 w-72 rounded-xl overflow-hidden animate-fade-in"
          style={{
            background: "rgba(22,18,34,0.96)",
            border: "1px solid rgba(201,168,76,0.2)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          {/* 标题 */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}
          >
            <span className="font-serif font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              玩家列表
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              {activePlayers.length} 参战 · {spectators.length} 观战
            </span>
          </div>

          {/* 参战玩家 */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-serif tracking-wider mb-2 px-1" style={{ color: "var(--text-gold)" }}>
              参战席
            </div>
            <div className="space-y-1">
              {activePlayers.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isMe={p.id === myPlayerId}
                  isBanker={p.id === bankerId}
                />
              ))}
              {activePlayers.length === 0 && (
                <div className="text-xs text-center py-2 font-serif" style={{ color: "var(--text-muted)" }}>
                  暂无参战玩家
                </div>
              )}
            </div>
          </div>

          {/* 观战席 */}
          {spectators.length > 0 && (
            <div className="px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-serif tracking-wider mb-2 px-1" style={{ color: "var(--text-muted)" }}>
                观战席
              </div>
              <div className="space-y-1">
                {spectators.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    isMe={p.id === myPlayerId}
                    isBanker={false}
                    isSpectator
                  />
                ))}
              </div>
            </div>
          )}

          {/* 观战者的"请求参战"按钮 */}
          {isSpectator && onJoinPlaying && (
            <div className="px-3 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <button
                onClick={onJoinPlaying}
                className="w-full mt-2 py-2 rounded-lg font-serif text-sm transition-all duration-200"
                style={{
                  background: "rgba(91,158,122,0.12)",
                  border: "1px solid rgba(91,158,122,0.3)",
                  color: "var(--accent-jade)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,122,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,122,0.12)";
                }}
              >
                请求下局参战
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PlayerRow({
  player,
  isMe,
  isBanker,
  isSpectator,
}: {
  player: Player;
  isMe: boolean;
  isBanker: boolean;
  isSpectator?: boolean;
}) {
  const { stats } = player;
  const winRate =
    stats.totalRounds > 0
      ? Math.round((stats.wins / stats.totalRounds) * 100)
      : 0;

  return (
    <div
      className="flex items-center justify-between px-2.5 py-2 rounded-lg transition-all"
      style={{
        background: isMe
          ? "rgba(201,168,76,0.06)"
          : "rgba(255,255,255,0.015)",
        border: isMe
          ? "1px solid rgba(201,168,76,0.12)"
          : "1px solid transparent",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* 在线指示点 */}
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: player.connected
              ? "var(--accent-jade)"
              : "rgba(255,255,255,0.15)",
            boxShadow: player.connected
              ? "0 0 4px rgba(91,158,122,0.5)"
              : "none",
          }}
        />
        <span
          className="font-serif text-xs truncate"
          style={{
            color: !player.connected
              ? "var(--text-muted)"
              : isSpectator
                ? "var(--text-secondary)"
                : "var(--text-primary)",
          }}
        >
          {player.name}
          {isMe && (
            <span style={{ color: "var(--text-gold)" }}> (你)</span>
          )}
        </span>
        {isBanker && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
            style={{
              background: "rgba(179,58,58,0.15)",
              color: "var(--accent-crimson-light)",
            }}
          >
            庄
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 战绩 */}
        {stats.totalRounds > 0 && (
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
            title={`${stats.wins}胜 ${stats.losses}负 ${stats.draws}平`}
          >
            {stats.wins}W {stats.losses}L
            {winRate > 0 && (
              <span style={{ color: winRate >= 50 ? "var(--accent-jade)" : "var(--lose-red)" }}>
                {" "}{winRate}%
              </span>
            )}
          </span>
        )}
        {/* 筹码 */}
        {!isSpectator && (
          <span
            className="text-[11px] font-mono font-bold min-w-[40px] text-right"
            style={{ color: "var(--text-gold)" }}
          >
            {player.chips >= 10000
              ? `${(player.chips / 1000).toFixed(player.chips % 1000 === 0 ? 0 : 1)}k`
              : player.chips.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
