import { useState } from "react";
import type { Player } from "~/game/types";

interface BetPanelProps {
  isBanker: boolean;
  hasBet: boolean;
  myChips: number;
  onBet: (amount: number) => void;
  players?: Player[];
  myPlayerId?: string;
  bankerId?: string | null;
}

const BET_OPTIONS = [50, 100, 200, 500, 1000, 2000];

export function BetPanel({ isBanker, hasBet, myChips, onBet, players, myPlayerId, bankerId }: BetPanelProps) {
  const [customBet, setCustomBet] = useState(100);

  const nonBankerPlayers = players?.filter((p) => !p.isSpectator && p.id !== bankerId && p.connected);

  if (isBanker) {
    return (
      <div className="panel-glass p-5 animate-slide-up">
        <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
          下注阶段
        </h3>
        <div className="text-center py-2">
          <div className="text-lg mb-1 font-serif animate-pulse-slow" style={{ color: "var(--text-gold)" }}>
            你是庄家
          </div>
        </div>
        {nonBankerPlayers && myPlayerId && (
          <BetWaitingStatus players={nonBankerPlayers} myPlayerId={myPlayerId} />
        )}
      </div>
    );
  }

  if (hasBet) {
    return (
      <div className="panel-glass p-5 animate-slide-up">
        <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
          下注阶段
        </h3>
        <div className="text-center py-2">
          <div className="text-lg mb-1 font-serif" style={{ color: "var(--accent-jade)" }}>
            已下注
          </div>
        </div>
        {nonBankerPlayers && myPlayerId && (
          <BetWaitingStatus players={nonBankerPlayers} myPlayerId={myPlayerId} />
        )}
      </div>
    );
  }

  return (
    <div className="panel-glass p-5 animate-slide-up">
      <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
        下注
      </h3>
      <p className="text-xs font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
        选择你的下注金额 (筹码: <span className="font-mono" style={{ color: "var(--text-gold)" }}>{myChips.toLocaleString()}</span>)
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {BET_OPTIONS.filter((b) => b <= myChips).map((amount) => (
          <button
            key={amount}
            onClick={() => onBet(amount)}
            className="py-2.5 rounded-lg text-sm font-mono transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(201,168,76,0.15)",
              color: "var(--text-gold)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201,168,76,0.1)";
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.15)";
            }}
          >
            {amount}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min={50}
          max={Math.min(2000, myChips)}
          step={50}
          value={customBet}
          onChange={(e) => setCustomBet(Number(e.target.value))}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"}
          onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
        />
        <button
          onClick={() => onBet(customBet)}
          disabled={customBet < 50 || customBet > Math.min(2000, myChips)}
          className="btn btn-primary py-2 px-4 rounded-lg text-sm font-serif"
        >
          下注
        </button>
      </div>
    </div>
  );
}

function BetWaitingStatus({ players, myPlayerId }: { players: Player[]; myPlayerId: string }) {
  const done = players.filter((p) => p.betAmount > 0).length;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>闲家下注进度</span>
        <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{done}/{players.length}</span>
      </div>
      <div className="space-y-1">
        {players.map((p) => {
          const hasBet = p.betAmount > 0;
          const isMe = p.id === myPlayerId;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
              style={{ background: isMe ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.01)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: hasBet ? "var(--accent-jade)" : "rgba(201,168,76,0.5)",
                    boxShadow: hasBet ? "0 0 4px rgba(91,158,122,0.5)" : "none",
                  }}
                />
                <span className="text-xs font-serif" style={{ color: isMe ? "var(--text-gold)" : "var(--text-primary)" }}>
                  {p.name}{isMe ? " (你)" : ""}
                </span>
              </div>
              <span
                className="text-[10px] font-serif px-1.5 py-0.5 rounded"
                style={{
                  background: hasBet ? "rgba(91,158,122,0.1)" : "rgba(201,168,76,0.08)",
                  color: hasBet ? "var(--accent-jade)" : "var(--text-muted)",
                  border: hasBet ? "1px solid rgba(91,158,122,0.2)" : "1px solid rgba(201,168,76,0.12)",
                }}
              >
                {hasBet ? "已下注" : "等待中"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
