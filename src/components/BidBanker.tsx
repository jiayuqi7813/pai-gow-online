import { useState } from "react";

interface BidBankerProps {
  isMyTurn: boolean;
  currentHighest: number;
  myChips: number;
  onBid: (amount: number) => void;
  onSkip: () => void;
}

const BID_INCREMENTS = [100, 200, 500, 1000];

export function BidBanker({ isMyTurn, currentHighest, myChips, onBid, onSkip }: BidBankerProps) {
  const [customBid, setCustomBid] = useState(currentHighest + 100);

  const quickBids = BID_INCREMENTS
    .map((inc) => currentHighest + inc)
    .filter((amount) => amount <= myChips);

  return (
    <div className="panel-glass p-5 animate-slide-up">
      <h3 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-gold)" }}>
        抢庄阶段
      </h3>

      {isMyTurn ? (
        <>
          <p className="text-sm font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
            当前最高出价: <span className="font-mono font-bold" style={{ color: "var(--text-gold)" }}>{currentHighest}</span>
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {quickBids.map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="btn btn-primary py-2 px-4 rounded-lg text-sm font-mono"
              >
                {amount}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="number"
              min={currentHighest + 1}
              max={myChips}
              value={customBid}
              onChange={(e) => setCustomBid(Number(e.target.value))}
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
              onClick={() => onBid(customBid)}
              disabled={customBid <= currentHighest || customBid > myChips}
              className="btn btn-primary py-2 px-4 rounded-lg text-sm font-serif"
            >
              出价
            </button>
          </div>

          <button onClick={onSkip} className="btn btn-secondary w-full py-2 rounded-lg text-sm font-serif">
            放弃抢庄
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="text-lg mb-2 font-serif animate-pulse-slow" style={{ color: "var(--text-gold)" }}>
            等待其他玩家抢庄...
          </div>
          <p className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>
            当前最高出价: <span className="font-mono font-bold" style={{ color: "var(--text-gold)" }}>{currentHighest}</span>
          </p>
        </div>
      )}
    </div>
  );
}
