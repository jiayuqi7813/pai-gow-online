import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useWebSocket } from "~/hooks/useWebSocket";

interface HomeSearch {
  join?: string;
}

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    join: typeof search.join === "string" ? search.join : undefined,
  }),
});

function HomePage() {
  const { join: joinRoomCode } = Route.useSearch();
  const [mode, setMode] = useState<"menu" | "create" | "join">(
    joinRoomCode ? "join" : "menu"
  );
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(joinRoomCode?.toUpperCase() ?? "");
  const navigate = useNavigate();
  const { connected, reconnecting, roomId, gameState, createRoom, joinRoom, spectateRoom, lastError } = useWebSocket();

  useEffect(() => {
    if (roomId && gameState) {
      navigate({ to: "/room/$roomId", params: { roomId } });
    }
  }, [roomId, gameState, navigate]);

  const handleCreate = () => {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim(), playerName.trim());
  };

  const handleSpectate = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    spectateRoom(roomCode.trim(), playerName.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ background: "var(--bg-deep)" }}>
      {/* 装饰性背景元素 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 左上角回纹装饰 */}
        <div className="absolute top-0 left-0 w-40 h-40 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, currentColor 8px, currentColor 9px), repeating-linear-gradient(90deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)`,
            color: "var(--gold)",
          }}
        />
        {/* 右下角回纹装饰 */}
        <div className="absolute bottom-0 right-0 w-40 h-40 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, currentColor 8px, currentColor 9px), repeating-linear-gradient(90deg, transparent, transparent 8px, currentColor 8px, currentColor 9px)`,
            color: "var(--gold)",
          }}
        />
        {/* 中心氛围光 */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)" }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px]"
          style={{ background: "radial-gradient(ellipse, rgba(91,158,122,0.04) 0%, transparent 70%)" }}
        />
      </div>

      {/* 标题 */}
      <div className="text-center mb-10 animate-fade-in relative z-10">
        <h1
          className="font-display text-7xl mb-3 tracking-wide"
          style={{
            color: "var(--text-gold)",
            textShadow: "0 2px 20px rgba(201,168,76,0.3), 0 0 60px rgba(201,168,76,0.1)",
          }}
        >
          牌九·东方
        </h1>
        <div className="flex items-center justify-center gap-4 mb-3">
          <div className="h-[1px] w-16" style={{ background: "linear-gradient(to right, transparent, var(--gold-dim))" }} />
          <p className="font-serif text-base tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>
            经典骨牌 · 在线对战
          </p>
          <div className="h-[1px] w-16" style={{ background: "linear-gradient(to left, transparent, var(--gold-dim))" }} />
        </div>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: connected ? "var(--accent-jade)" : "var(--accent-crimson)",
              boxShadow: connected ? "0 0 8px rgba(91,158,122,0.6)" : "0 0 8px rgba(179,58,58,0.6)",
            }}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {connected ? "已连接" : "连接中..."}
          </span>
        </div>
      </div>

      {/* 主面板 */}
      <div className="w-full max-w-md relative z-10" style={{ animationDelay: "0.15s" }}>
        <div className="panel-glass p-8 animate-slide-up">
          {reconnecting && (
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in">
              <div className="w-10 h-10 mb-5 rounded-full animate-spin"
                style={{
                  border: "3px solid rgba(201,168,76,0.15)",
                  borderTopColor: "var(--gold)",
                }}
              />
              <p className="text-lg font-serif mb-2" style={{ color: "var(--text-gold)" }}>
                正在重连到之前的房间...
              </p>
              <p className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>
                请稍候，正在恢复游戏状态
              </p>
            </div>
          )}

          {!reconnecting && lastError && (
            <div className="mb-5 p-3 rounded-xl text-sm text-center animate-fade-in"
              style={{
                background: "rgba(179,58,58,0.1)",
                border: "1px solid rgba(179,58,58,0.3)",
                color: "var(--accent-crimson-light)",
              }}
            >
              {lastError}
            </div>
          )}

          {!reconnecting && mode === "menu" && (
            <div className="space-y-4">
              <button
                onClick={() => setMode("create")}
                disabled={!connected}
                className="btn btn-primary w-full py-4 text-lg rounded-xl font-serif tracking-wider"
              >
                创建房间
              </button>
              <button
                onClick={() => setMode("join")}
                disabled={!connected}
                className="btn btn-secondary w-full py-4 text-lg rounded-xl font-serif tracking-wider"
              >
                加入房间
              </button>
              <button
                onClick={() => navigate({ to: "/tutorial" })}
                className="w-full py-4 text-lg rounded-xl font-serif tracking-wider transition-all duration-200"
                style={{
                  background: "rgba(91,158,122,0.08)",
                  border: "1px solid rgba(91,158,122,0.25)",
                  color: "var(--accent-jade)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,122,0.14)";
                  e.currentTarget.style.borderColor = "rgba(91,158,122,0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(91,158,122,0.08)";
                  e.currentTarget.style.borderColor = "rgba(91,158,122,0.25)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                教程模式
              </button>

              {/* 规则说明 */}
              <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <h3 className="text-sm font-semibold mb-3 font-serif" style={{ color: "var(--text-gold)" }}>
                  游戏规则
                </h3>
                <ul className="text-xs space-y-2 font-serif" style={{ color: "var(--text-secondary)" }}>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "var(--gold-dim)" }}>·</span>
                    使用32张中国骨牌，最多支持12人对战
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "var(--gold-dim)" }}>·</span>
                    每人发4张牌，两两搭配分前道和后道
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "var(--gold-dim)" }}>·</span>
                    后道须大于等于前道，分别与庄家比大小
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "var(--gold-dim)" }}>·</span>
                    前道赢输×1倍注，后道赢输×2倍注
                  </li>
                  <li className="flex items-start gap-2">
                    <span style={{ color: "var(--gold-dim)" }}>·</span>
                    抢庄模式：玩家竞价争夺庄家位置
                  </li>
                </ul>
              </div>
            </div>
          )}

          {!reconnecting && mode === "create" && (
            <div className="space-y-4">
              <button
                onClick={() => setMode("menu")}
                className="text-sm flex items-center gap-1 mb-2 transition-colors"
                style={{ color: "var(--text-secondary)", cursor: "pointer", background: "none", border: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-gold)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
              >
                ← 返回
              </button>
              <h2 className="text-xl font-bold font-serif" style={{ color: "var(--text-primary)" }}>
                创建房间
              </h2>
              <input
                type="text"
                placeholder="输入你的昵称"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                maxLength={8}
                className="w-full rounded-xl px-4 py-3 font-serif transition-colors focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
              />
              <button
                onClick={handleCreate}
                disabled={!playerName.trim() || !connected}
                className="btn btn-primary w-full py-3 text-lg rounded-xl font-serif"
              >
                创建
              </button>
            </div>
          )}

          {!reconnecting && mode === "join" && (
            <div className="space-y-4">
              <button
                onClick={() => setMode("menu")}
                className="text-sm flex items-center gap-1 mb-2 transition-colors"
                style={{ color: "var(--text-secondary)", cursor: "pointer", background: "none", border: "none" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-gold)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
              >
                ← 返回
              </button>
              <h2 className="text-xl font-bold font-serif" style={{ color: "var(--text-primary)" }}>
                加入房间
              </h2>
              <input
                type="text"
                placeholder="输入你的昵称"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={8}
                className="w-full rounded-xl px-4 py-3 font-serif transition-colors focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
              />
              <input
                type="text"
                placeholder="输入房间码 (6位)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                maxLength={6}
                className="w-full rounded-xl px-4 py-3 font-mono text-center text-xl tracking-[0.3em] transition-colors focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-gold)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleJoin}
                  disabled={!playerName.trim() || !roomCode.trim() || !connected}
                  className="btn btn-primary flex-1 py-3 text-lg rounded-xl font-serif"
                >
                  加入
                </button>
                <button
                  onClick={handleSpectate}
                  disabled={!playerName.trim() || !roomCode.trim() || !connected}
                  className="flex-1 py-3 text-lg rounded-xl font-serif transition-all duration-200"
                  style={{
                    background: "rgba(91,158,122,0.08)",
                    border: "1px solid rgba(91,158,122,0.25)",
                    color: "var(--accent-jade)",
                    cursor: (!playerName.trim() || !roomCode.trim() || !connected) ? "not-allowed" : "pointer",
                    opacity: (!playerName.trim() || !roomCode.trim() || !connected) ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (playerName.trim() && roomCode.trim() && connected) {
                      e.currentTarget.style.background = "rgba(91,158,122,0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(91,158,122,0.08)";
                  }}
                >
                  观战
                </button>
              </div>
              <p className="text-[11px] text-center font-serif" style={{ color: "var(--text-muted)" }}>
                游戏进行中时，加入将自动进入观战
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 底部 */}
      <div className="mt-8 text-xs relative z-10 font-serif" style={{ color: "var(--text-muted)" }}>
        牌九·东方 v1.0 · 支持2-12人
      </div>
    </div>
  );
}
