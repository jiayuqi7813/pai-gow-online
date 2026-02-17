import { useState } from "react";

interface BetPanelProps {
  isBanker: boolean;
  hasBet: boolean;
  myChips: number;
  onBet: (amount: number) => void;
}

const BET_OPTIONS = [50, 100, 200, 500, 1000, 2000];

export function BetPanel({ isBanker, hasBet, myChips, onBet }: BetPanelProps) {
  const [customBet, setCustomBet] = useState(100);

  if (isBanker) {
    return (
      <div className="panel-glass p-5 animate-slide-up">
        <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
          下注阶段
        </h3>
        <div className="text-center py-4">
          <div className="text-lg mb-2 font-serif animate-pulse-slow" style={{ color: "var(--text-gold)" }}>
            你是庄家
          </div>
          <p className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>等待闲家下注...</p>
        </div>
      </div>
    );
  }

  if (hasBet) {
    return (
      <div className="panel-glass p-5 animate-slide-up">
        <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
          下注阶段
        </h3>
        <div className="text-center py-4">
          <div className="text-lg mb-2 font-serif" style={{ color: "var(--accent-jade)" }}>
            已下注
          </div>
          <p className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>等待其他玩家...</p>
        </div>
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
