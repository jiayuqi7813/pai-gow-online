import { useState } from "react";
import { ALL_TILES } from "~/game/tiles";
import { DominoTile } from "../DominoTile";
import { calcPoints } from "~/game/rules";

const EXAMPLES = [
  { a: ALL_TILES[0], b: ALL_TILES[4], label: "天牌 + 人牌" },
  { a: ALL_TILES[2], b: ALL_TILES[8], label: "地牌 + 梅花" },
  { a: ALL_TILES[22], b: ALL_TILES[28], label: "杂九 + 杂五" },
  { a: ALL_TILES[14], b: ALL_TILES[6], label: "斧头 + 和牌" },
];

export function PointsLesson() {
  const [exIdx, setExIdx] = useState(0);
  const ex = EXAMPLES[exIdx];
  const points = calcPoints(ex.a, ex.b);
  const rawSum = ex.a.totalPoints + ex.b.totalPoints;

  return (
    <div className="space-y-6">
      <div className="panel-glass p-5">
        <p className="font-serif text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          牌九中，两张牌组成一道（前道或后道）。一道的点数计算方式：
        </p>
        <div className="mt-3 p-4 rounded-xl text-center" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
          <span className="font-serif text-lg" style={{ color: "var(--text-gold)" }}>
            点数 = (牌A总点 + 牌B总点) <strong>取个位</strong>
          </span>
        </div>
        <p className="font-serif text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
          例如两张牌的总点分别为12和8，则：12 + 8 = 20，取个位 = <strong style={{ color: "var(--text-gold)" }}>0点</strong>（鸡九/零点，最弱）。
          9点最大，0点最小。
        </p>
      </div>

      {/* 点数颜色说明 */}
      <div className="panel-glass p-5">
        <h4 className="font-display text-base mb-3" style={{ color: "var(--text-gold)" }}>点子颜色</h4>
        <div className="space-y-2 text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          <div className="flex items-center gap-3">
            <div className="dot dot-red w-3 h-3" />
            <span><strong style={{ color: "var(--accent-crimson-light)" }}>红色</strong> — 1点和4点为红色</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="dot dot-white w-3 h-3" />
            <span><strong>黑色</strong> — 2、3、5、6点为黑色</span>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            至尊牌(丁三和二四)所有点子都为红色，这是它们的特殊标志。
          </p>
        </div>
      </div>

      {/* 交互示例 */}
      <div className="panel-glass p-5">
        <h4 className="font-display text-base mb-3" style={{ color: "var(--text-gold)" }}>试一试</h4>

        <div className="flex justify-center gap-2 mb-4">
          {EXAMPLES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setExIdx(idx)}
              className="px-3 py-1.5 rounded-lg text-xs font-serif transition-all"
              style={{
                background: idx === exIdx ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                border: idx === exIdx ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.05)",
                color: idx === exIdx ? "var(--text-gold)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              示例 {idx + 1}
            </button>
          ))}
        </div>

        <div className="text-center mb-3 text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
          {ex.label}
        </div>

        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex flex-col items-center gap-1">
            <DominoTile tile={ex.a} />
            <span className="text-xs font-mono" style={{ color: "var(--text-gold)" }}>{ex.a.totalPoints}点</span>
          </div>
          <span className="font-display text-2xl" style={{ color: "var(--text-muted)" }}>+</span>
          <div className="flex flex-col items-center gap-1">
            <DominoTile tile={ex.b} />
            <span className="text-xs font-mono" style={{ color: "var(--text-gold)" }}>{ex.b.totalPoints}点</span>
          </div>
        </div>

        <div className="text-center p-3 rounded-xl" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
          <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
            {ex.a.totalPoints} + {ex.b.totalPoints} = {rawSum}
            {rawSum >= 10 && <span> → 取个位</span>}
          </div>
          <div className="text-3xl font-mono font-bold mt-1 animate-score-pop" key={exIdx} style={{ color: "var(--text-gold)" }}>
            {points}点
          </div>
        </div>
      </div>
    </div>
  );
}
