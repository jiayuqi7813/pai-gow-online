import { useState, useEffect, useCallback } from "react";
import { ALL_TILES } from "~/game/tiles";
import { DominoTile } from "../DominoTile";
import { evaluatePair, compareOneRoad, calculatePayout } from "~/game/rules";
import type { TilePair } from "~/game/types";

const SCENARIOS = [
  {
    label: "场景1：闲家两道皆胜",
    banker: { front: { tiles: [ALL_TILES[12], ALL_TILES[28]] }, back: { tiles: [ALL_TILES[6], ALL_TILES[22]] } },
    player: { front: { tiles: [ALL_TILES[8], ALL_TILES[24]] }, back: { tiles: [ALL_TILES[0], ALL_TILES[4]] } },
    bet: 200,
  },
  {
    label: "场景2：闲家一胜一负",
    banker: { front: { tiles: [ALL_TILES[2], ALL_TILES[26]] }, back: { tiles: [ALL_TILES[0], ALL_TILES[22]] } },
    player: { front: { tiles: [ALL_TILES[8], ALL_TILES[14]] }, back: { tiles: [ALL_TILES[10], ALL_TILES[28]] } },
    bet: 100,
  },
  {
    label: "场景3：至尊 vs 双天",
    banker: { front: { tiles: [ALL_TILES[4], ALL_TILES[18]] }, back: { tiles: [ALL_TILES[0], ALL_TILES[1]] } },
    player: { front: { tiles: [ALL_TILES[12], ALL_TILES[6]] }, back: { tiles: [ALL_TILES[30], ALL_TILES[31]] } },
    bet: 500,
  },
];

type Step = "idle" | "reveal" | "front_compare" | "front_result" | "back_compare" | "back_result" | "total";

export function CompareDemo() {
  const [scIdx, setScIdx] = useState(0);
  const [step, setStep] = useState<Step>("idle");
  const [auto, setAuto] = useState(false);

  const sc = SCENARIOS[scIdx];
  const frontResult = compareOneRoad(sc.player.front as TilePair, sc.banker.front as TilePair, true);
  const backResult = compareOneRoad(sc.player.back as TilePair, sc.banker.back as TilePair, true);
  const payout = calculatePayout(frontResult, backResult, sc.bet);

  const bankerFrontEval = evaluatePair(sc.banker.front as TilePair);
  const bankerBackEval = evaluatePair(sc.banker.back as TilePair);
  const playerFrontEval = evaluatePair(sc.player.front as TilePair);
  const playerBackEval = evaluatePair(sc.player.back as TilePair);

  const STEPS: Step[] = ["reveal", "front_compare", "front_result", "back_compare", "back_result", "total"];

  const advance = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    }
  }, [step]);

  useEffect(() => {
    if (!auto || step === "total") return;
    const timer = setTimeout(advance, 1200);
    return () => clearTimeout(timer);
  }, [auto, step, advance]);

  const startDemo = () => {
    setStep("reveal");
    setAuto(true);
  };

  const reset = () => {
    setStep("idle");
    setAuto(false);
  };

  const switchScenario = (idx: number) => {
    setScIdx(idx);
    setStep("idle");
    setAuto(false);
  };

  const showReveal = step !== "idle";
  const showFrontCompare = STEPS.indexOf(step) >= 1;
  const showFrontResult = STEPS.indexOf(step) >= 2;
  const showBackCompare = STEPS.indexOf(step) >= 3;
  const showBackResult = STEPS.indexOf(step) >= 4;
  const showTotal = step === "total";

  return (
    <div className="space-y-5">
      <div className="panel-glass p-4">
        <p className="font-serif text-sm" style={{ color: "var(--text-primary)" }}>
          比牌时，闲家的前道和后道<strong style={{ color: "var(--text-gold)" }}>分别</strong>与庄家的前道和后道比较。
          先比前道(×1倍)，再比后道(×2倍)。
        </p>
      </div>

      {/* 场景选择 */}
      <div className="flex gap-2 justify-center">
        {SCENARIOS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => switchScenario(idx)}
            className="px-3 py-1.5 rounded-lg text-xs font-serif transition-all"
            style={{
              background: idx === scIdx ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
              border: idx === scIdx ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.05)",
              color: idx === scIdx ? "var(--text-gold)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            场景{idx + 1}
          </button>
        ))}
      </div>

      {/* 庄家 */}
      <div className="panel-glass p-4">
        <div className="text-sm font-serif font-semibold mb-3" style={{ color: "var(--text-gold)" }}>庄家</div>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
            <div className="flex gap-1 justify-center">
              {sc.banker.front.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
            </div>
            <div className="text-[10px] font-serif mt-1" style={{ color: "var(--text-secondary)" }}>{bankerFrontEval.description}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
            <div className="flex gap-1 justify-center">
              {sc.banker.back.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
            </div>
            <div className="text-[10px] font-serif mt-1" style={{ color: "var(--text-secondary)" }}>{bankerBackEval.description}</div>
          </div>
        </div>
      </div>

      {/* 闲家 */}
      <div className="panel-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-serif font-semibold" style={{ color: "var(--text-primary)" }}>闲家</div>
          <div className="text-xs font-mono" style={{ color: "var(--text-gold)" }}>注额: {sc.bet}</div>
        </div>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
            <div className="flex gap-1 justify-center">
              {showReveal
                ? sc.player.front.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)
                : sc.player.front.tiles.map((t) => <DominoTile key={t.id} tile={t} faceDown small />)}
            </div>
            {showReveal && (
              <div className="text-[10px] font-serif mt-1 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
                {playerFrontEval.description}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
            <div className="flex gap-1 justify-center">
              {showReveal
                ? sc.player.back.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)
                : sc.player.back.tiles.map((t) => <DominoTile key={t.id} tile={t} faceDown small />)}
            </div>
            {showReveal && (
              <div className="text-[10px] font-serif mt-1 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
                {playerBackEval.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 比较过程 */}
      {showFrontCompare && (
        <div className="animate-fade-in p-4 rounded-xl" style={{ background: "rgba(91,158,122,0.04)", border: "1px solid rgba(91,158,122,0.15)" }}>
          <div className="text-sm font-serif font-semibold mb-2" style={{ color: "var(--accent-jade)" }}>
            前道比较 (×1倍)
          </div>
          <div className="text-center text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
            {playerFrontEval.description} vs {bankerFrontEval.description}
          </div>
          {showFrontResult && (
            <div className="text-center mt-2 animate-score-pop">
              <span
                className="text-lg font-bold font-mono"
                style={{ color: frontResult.result > 0 ? "var(--win-green)" : frontResult.result < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}
              >
                {frontResult.result > 0 ? "闲家胜" : frontResult.result < 0 ? "庄家胜" : "平局"}
                {" "}
                ({payout.frontPayout > 0 ? "+" : ""}{payout.frontPayout})
              </span>
            </div>
          )}
        </div>
      )}

      {showBackCompare && (
        <div className="animate-fade-in p-4 rounded-xl" style={{ background: "rgba(179,58,58,0.04)", border: "1px solid rgba(179,58,58,0.15)" }}>
          <div className="text-sm font-serif font-semibold mb-2" style={{ color: "var(--accent-crimson-light)" }}>
            后道比较 (×2倍)
          </div>
          <div className="text-center text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
            {playerBackEval.description} vs {bankerBackEval.description}
          </div>
          {showBackResult && (
            <div className="text-center mt-2 animate-score-pop">
              <span
                className="text-lg font-bold font-mono"
                style={{ color: backResult.result > 0 ? "var(--win-green)" : backResult.result < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}
              >
                {backResult.result > 0 ? "闲家胜" : backResult.result < 0 ? "庄家胜" : "平局"}
                {" "}
                ({payout.backPayout > 0 ? "+" : ""}{payout.backPayout})
              </span>
            </div>
          )}
        </div>
      )}

      {showTotal && (
        <div className="panel-glass p-4 text-center animate-score-pop">
          <div className="text-sm font-serif mb-1" style={{ color: "var(--text-secondary)" }}>总盈亏</div>
          <div
            className="text-3xl font-bold font-mono"
            style={{ color: payout.totalPayout > 0 ? "var(--win-green)" : payout.totalPayout < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}
          >
            {payout.totalPayout > 0 ? "+" : ""}{payout.totalPayout}
          </div>
          <div className="text-xs font-serif mt-1" style={{ color: "var(--text-muted)" }}>
            前道 {payout.frontPayout > 0 ? "+" : ""}{payout.frontPayout} + 后道 {payout.backPayout > 0 ? "+" : ""}{payout.backPayout}
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex gap-3">
        {step === "idle" ? (
          <button onClick={startDemo} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
            开始演示
          </button>
        ) : step === "total" ? (
          <button onClick={reset} className="btn btn-secondary flex-1 py-2.5 rounded-xl font-serif">
            重新演示
          </button>
        ) : (
          <>
            <button onClick={reset} className="btn btn-secondary flex-1 py-2.5 rounded-xl font-serif">
              重置
            </button>
            <button onClick={() => { setAuto(false); advance(); }} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
              下一步
            </button>
          </>
        )}
      </div>
    </div>
  );
}
