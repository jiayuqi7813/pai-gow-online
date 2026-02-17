import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { useWebSocket } from "~/hooks/useWebSocket";
import { ChipDisplay } from "./ChipDisplay";

type WS = ReturnType<typeof useWebSocket>;

export function Lobby({ ws }: { ws: WS }) {
  const { gameState, playerId, startGame, leaveRoom, lastError, isSpectator, toggleSpectator, toggleReady } = ws;
  const navigate = useNavigate();

  if (!gameState) return null;

  const [copied, setCopied] = useState(false);
  const me = gameState.players.find((p) => p.id === playerId);
  const isHost = me?.isHost;
  const activePlayers = gameState.players.filter((p) => !p.isSpectator);
  const spectators = gameState.players.filter((p) => p.isSpectator);
  const allReady = activePlayers.filter((p) => !p.isHost).every((p) => p.isReady);
  const canStart = activePlayers.length >= gameState.minPlayersToStart && allReady;

  const shareLink = typeof window !== "undefined"
    ? `${window.location.origin}/room/${gameState.roomId}`
    : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "var(--bg-deep)" }}>
      <div className="w-full max-w-lg animate-fade-in">
        {/* 房间信息 */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl mb-4" style={{ color: "var(--text-gold)", textShadow: "0 2px 12px rgba(201,168,76,0.2)" }}>
            游戏大厅
          </h1>
          <div className="flex items-center justify-center gap-3">
            <span className="font-serif text-sm" style={{ color: "var(--text-secondary)" }}>房间码</span>
            <span
              className="text-3xl font-mono font-bold tracking-[0.3em] select-all"
              style={{ color: "var(--text-gold)", textShadow: "0 0 20px rgba(201,168,76,0.2)" }}
            >
              {gameState.roomId}
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="mt-3 px-4 py-2 rounded-lg font-serif text-sm transition-all duration-200"
            style={{
              background: copied ? "rgba(91,158,122,0.15)" : "rgba(201,168,76,0.08)",
              border: copied ? "1px solid rgba(91,158,122,0.3)" : "1px solid rgba(201,168,76,0.2)",
              color: copied ? "var(--accent-jade)" : "var(--text-gold)",
              cursor: "pointer",
            }}
          >
            {copied ? "已复制邀请链接" : "复制邀请链接"}
          </button>
        </div>

        {/* 玩家列表 */}
        <div className="panel-glass p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-serif" style={{ color: "var(--text-primary)" }}>
              玩家 ({activePlayers.length}/{gameState.maxPlayers})
              {spectators.length > 0 && (
                <span className="text-xs font-normal ml-2" style={{ color: "var(--text-muted)" }}>
                  +{spectators.length} 观战
                </span>
              )}
            </h2>
            <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>
              至少{gameState.minPlayersToStart}人开始
            </span>
          </div>

          <div className="space-y-2.5">
            {gameState.players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3.5 rounded-xl transition-all duration-200"
                style={{
                  background: player.id === playerId
                    ? "rgba(201,168,76,0.08)"
                    : "rgba(255,255,255,0.02)",
                  border: player.id === playerId
                    ? "1px solid rgba(201,168,76,0.2)"
                    : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
                    style={{
                      background: player.connected
                        ? "linear-gradient(135deg, var(--accent-jade-dark), var(--accent-jade))"
                        : "rgba(255,255,255,0.05)",
                      color: player.connected ? "white" : "var(--text-muted)",
                      boxShadow: player.connected ? "0 2px 8px rgba(91,158,122,0.3)" : "none",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                      {player.name}
                    </span>
                    {player.id === playerId && (
                      <span className="text-xs ml-2" style={{ color: "var(--text-gold)" }}>(你)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {player.isHost && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-serif"
                      style={{
                        background: "rgba(179,58,58,0.15)",
                        color: "var(--accent-crimson-light)",
                        border: "1px solid rgba(179,58,58,0.2)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      房主
                    </span>
                  )}
                  {player.isSpectator && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-serif"
                      style={{
                        background: "rgba(91,158,122,0.1)",
                        color: "var(--accent-jade)",
                        border: "1px solid rgba(91,158,122,0.2)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      观战
                    </span>
                  )}
                  {!player.isSpectator && !player.isHost && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-serif"
                      style={{
                        background: player.isReady ? "rgba(91,158,122,0.15)" : "rgba(255,255,255,0.05)",
                        color: player.isReady ? "var(--accent-jade)" : "var(--text-muted)",
                        border: player.isReady ? "1px solid rgba(91,158,122,0.25)" : "1px solid rgba(255,255,255,0.08)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {player.isReady ? "已准备" : "未准备"}
                    </span>
                  )}
                  {!player.isSpectator && (
                    <div className="transform scale-90 origin-right">
                      <ChipDisplay amount={player.chips} size="sm" variant="gold" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {activePlayers.length < gameState.maxPlayers && (
              <div
                className="flex items-center justify-center p-3.5 rounded-xl text-sm font-serif"
                style={{
                  border: "1px dashed rgba(201,168,76,0.15)",
                  color: "var(--text-muted)",
                }}
              >
                虚位以待 · 还可加入 {gameState.maxPlayers - activePlayers.length} 人
              </div>
            )}
          </div>
        </div>

        {lastError && (
          <div
            className="mb-4 p-3 rounded-xl text-sm text-center animate-fade-in font-serif"
            style={{
              background: "rgba(179,58,58,0.1)",
              border: "1px solid rgba(179,58,58,0.3)",
              color: "var(--accent-crimson-light)",
            }}
          >
            {lastError}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-3">
          {/* 准备 / 观战切换 */}
          {me && !isHost && (
            <div className="flex gap-3">
              {!isSpectator && (
                <button
                  onClick={toggleReady}
                  className={`flex-1 py-3 rounded-xl font-serif text-base font-bold transition-all ${me.isReady ? "btn btn-secondary" : "btn btn-primary"}`}
                >
                  {me.isReady ? "取消准备" : "准备"}
                </button>
              )}
              <button
                onClick={toggleSpectator}
                className="btn btn-secondary flex-1 py-3 rounded-xl font-serif"
              >
                {isSpectator ? "加入参战" : "切换观战"}
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleLeave}
              className="btn btn-secondary flex-1 py-3 rounded-xl font-serif"
            >
              退出房间
            </button>
            {isHost && (
              <button
                onClick={startGame}
                disabled={!canStart}
                className="btn btn-primary flex-1 py-3 rounded-xl text-lg font-serif"
              >
                {!canStart
                  ? activePlayers.length < gameState.minPlayersToStart
                    ? `等待 (${activePlayers.length}/${gameState.minPlayersToStart})`
                    : `等待准备 (${activePlayers.filter((p) => p.isReady || p.isHost).length}/${activePlayers.length})`
                  : "开始游戏"
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
