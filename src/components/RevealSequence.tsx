import { useState, useEffect, useCallback, useRef } from "react";
import type { RevealData, RoundPlayerResult } from "~/game/types";
import { DominoTile } from "./DominoTile";

/**
 * 开牌步骤状态机
 *
 * 流程: banker_reveal -> (对每个闲家: player_reveal -> front_compare -> front_result -> back_compare -> back_result -> player_settle) -> done
 */
export type RevealStep =
  | { phase: "banker_reveal" }
  | { phase: "player_reveal"; playerIdx: number }
  | { phase: "front_compare"; playerIdx: number }
  | { phase: "front_result"; playerIdx: number }
  | { phase: "back_compare"; playerIdx: number }
  | { phase: "back_result"; playerIdx: number }
  | { phase: "player_settle"; playerIdx: number }
  | { phase: "done" };

interface RevealSequenceProps {
  revealData: RevealData;
  myPlayerId: string;
  onDone: () => void;
}

const STEP_DELAY = 1200;

function buildSteps(playerCount: number): RevealStep[] {
  const steps: RevealStep[] = [{ phase: "banker_reveal" }];
  for (let i = 0; i < playerCount; i++) {
    steps.push(
      { phase: "player_reveal", playerIdx: i },
      { phase: "front_compare", playerIdx: i },
      { phase: "front_result", playerIdx: i },
      { phase: "back_compare", playerIdx: i },
      { phase: "back_result", playerIdx: i },
      { phase: "player_settle", playerIdx: i },
    );
  }
  steps.push({ phase: "done" });
  return steps;
}

export function RevealSequence({ revealData, myPlayerId, onDone }: RevealSequenceProps) {
  const { bankerResult, playerResults } = revealData;
  const allSteps = useRef(buildSteps(playerResults.length)).current;

  const [stepIdx, setStepIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = allSteps[stepIdx];

  const advance = useCallback(() => {
    setStepIdx((prev) => {
      const next = Math.min(prev + 1, allSteps.length - 1);
      return next;
    });
  }, [allSteps.length]);

  const skipToEnd = useCallback(() => {
    setStepIdx(allSteps.length - 1);
    setAutoPlay(false);
  }, [allSteps.length]);

  useEffect(() => {
    if (!autoPlay) return;
    if (currentStep.phase === "done") return;

    timerRef.current = setTimeout(advance, STEP_DELAY);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoPlay, stepIdx, advance, currentStep.phase]);

  useEffect(() => {
    if (currentStep.phase === "done") {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [currentStep.phase, onDone]);

  const currentPlayerIdx = "playerIdx" in currentStep ? currentStep.playerIdx : -1;
  const currentPlayer: RoundPlayerResult | null = currentPlayerIdx >= 0 ? playerResults[currentPlayerIdx] : null;

  const getPlayerRevealState = (pIdx: number) => {
    if (currentStep.phase === "done") return "settled";
    if (currentStep.phase === "banker_reveal") return "hidden";

    const stepPlayerIdx = "playerIdx" in currentStep ? currentStep.playerIdx : -1;
    if (pIdx < stepPlayerIdx) return "settled";
    if (pIdx > stepPlayerIdx) return "hidden";

    switch (currentStep.phase) {
      case "player_reveal": return "revealing";
      case "front_compare": return "front_comparing";
      case "front_result": return "front_result";
      case "back_compare": return "back_comparing";
      case "back_result": return "back_result";
      case "player_settle": return "settled";
      default: return "hidden";
    }
  };

  const bankerRevealed = currentStep.phase !== "banker_reveal" || stepIdx > 0;

  return (
    <div className="reveal-sequence">
      {/* 庄家区域 */}
      <div className="panel-glass p-4 mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-serif font-semibold" style={{ color: "var(--text-gold)" }}>
            庄家: {bankerResult.playerName}
          </div>
          {currentStep.phase === "banker_reveal" && (
            <span className="text-xs font-serif animate-pulse-slow" style={{ color: "var(--text-gold)" }}>
              亮牌中...
            </span>
          )}
        </div>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
            <div className="flex gap-1 justify-center">
              {bankerRevealed
                ? bankerResult.arrangement.front.tiles.map((t) => (
                    <DominoTile key={t.id} tile={t} small />
                  ))
                : bankerResult.arrangement.front.tiles.map((t, i) => (
                    <DominoTile key={i} tile={t} faceDown small />
                  ))
              }
            </div>
            {bankerRevealed && (
              <div className="text-[10px] font-serif mt-1 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
                {bankerResult.frontEval.description}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
            <div className="flex gap-1 justify-center">
              {bankerRevealed
                ? bankerResult.arrangement.back.tiles.map((t) => (
                    <DominoTile key={t.id} tile={t} small />
                  ))
                : bankerResult.arrangement.back.tiles.map((t, i) => (
                    <DominoTile key={i} tile={t} faceDown small />
                  ))
              }
            </div>
            {bankerRevealed && (
              <div className="text-[10px] font-serif mt-1 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
                {bankerResult.backEval.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 闲家列表 */}
      <div className="space-y-2 mb-4">
        {playerResults.map((pr, idx) => {
          const state = getPlayerRevealState(idx);
          const isMe = pr.playerId === myPlayerId;
          const isActive = idx === currentPlayerIdx;

          return (
            <PlayerRevealRow
              key={pr.playerId}
              result={pr}
              bankerResult={bankerResult}
              state={state}
              isMe={isMe}
              isActive={isActive}
            />
          );
        })}
      </div>

      {/* 控制栏 */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setAutoPlay(!autoPlay)}
          className="btn btn-secondary py-2 px-4 rounded-lg text-sm font-serif"
          disabled={currentStep.phase === "done"}
        >
          {autoPlay ? "暂停" : "自动播放"}
        </button>
        <button
          onClick={() => { setAutoPlay(false); advance(); }}
          className="btn btn-secondary py-2 px-4 rounded-lg text-sm font-serif"
          disabled={currentStep.phase === "done"}
        >
          下一步
        </button>
        <button
          onClick={skipToEnd}
          className="btn btn-primary py-2 px-4 rounded-lg text-sm font-serif"
          disabled={currentStep.phase === "done"}
        >
          快进到结果
        </button>
      </div>
    </div>
  );
}

/** 开牌状态 */
type PlayerState =
  | "hidden"
  | "revealing"
  | "front_comparing"
  | "front_result"
  | "back_comparing"
  | "back_result"
  | "settled";

function PlayerRevealRow({
  result,
  bankerResult,
  state,
  isMe,
  isActive,
}: {
  result: RoundPlayerResult;
  bankerResult: RoundPlayerResult;
  state: PlayerState;
  isMe: boolean;
  isActive: boolean;
}) {
  const showTiles = state !== "hidden";
  const showFrontCompare = ["front_comparing", "front_result", "back_comparing", "back_result", "settled"].includes(state);
  const showFrontResult = ["front_result", "back_comparing", "back_result", "settled"].includes(state);
  const showBackCompare = ["back_comparing", "back_result", "settled"].includes(state);
  const showBackResult = ["back_result", "settled"].includes(state);
  const showSettle = state === "settled";

  return (
    <div
      className={`p-3 rounded-xl transition-all duration-300 ${isActive ? "reveal-active" : ""}`}
      style={{
        background: isActive
          ? "rgba(201,168,76,0.08)"
          : isMe
            ? "rgba(201,168,76,0.04)"
            : "rgba(255,255,255,0.02)",
        border: isActive
          ? "1px solid rgba(201,168,76,0.3)"
          : isMe
            ? "1px solid rgba(201,168,76,0.1)"
            : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* 玩家头部信息 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            {result.playerName}
            {isMe && <span style={{ color: "var(--text-gold)" }}> (你)</span>}
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            注:{result.betAmount}
          </span>
        </div>
        {showSettle && (
          <span
            className="font-bold font-mono text-lg animate-score-pop"
            style={{
              color: result.totalPayout > 0 ? "var(--win-green)"
                : result.totalPayout < 0 ? "var(--lose-red)"
                : "var(--text-secondary)",
            }}
          >
            {result.totalPayout > 0 ? "+" : ""}{result.totalPayout}
          </span>
        )}
      </div>

      {/* 牌面 */}
      <div className="flex gap-4 justify-center items-start">
        {/* 前道 */}
        <div className="text-center flex-1">
          <div className="text-[10px] font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
          <div className={`flex gap-0.5 justify-center ${showFrontCompare && !showFrontResult ? "reveal-comparing" : ""}`}>
            {showTiles
              ? result.arrangement.front.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)
              : result.arrangement.front.tiles.map((_, i) => (
                  <DominoTile key={i} tile={{ id: 0, name: "hidden", nameCN: "", top: 0, bottom: 0, totalPoints: 0, type: "civil", civilRank: 0, pairId: 0 }} faceDown small />
                ))
            }
          </div>
          {showTiles && (
            <div className="text-[10px] font-serif mt-0.5 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
              {result.frontEval.description}
            </div>
          )}
          {showFrontCompare && (
            <div className="text-[10px] font-serif mt-0.5 animate-fade-in" style={{ color: "var(--text-muted)" }}>
              vs {bankerResult.frontEval.description}
            </div>
          )}
          {showFrontResult && (
            <div className="animate-score-pop mt-0.5">
              <span
                className="text-xs font-bold font-mono"
                style={{
                  color: result.frontResult.result > 0 ? "var(--win-green)"
                    : result.frontResult.result < 0 ? "var(--lose-red)"
                    : "var(--text-secondary)",
                }}
              >
                {result.frontResult.result > 0 ? "胜" : result.frontResult.result < 0 ? "负" : "平"}
                {" "}
                <span className="text-[10px]">
                  ({result.frontPayout > 0 ? "+" : ""}{result.frontPayout})
                </span>
              </span>
            </div>
          )}
        </div>

        {/* VS 标记 */}
        {isActive && (showFrontCompare || showBackCompare) && !showSettle && (
          <div className="flex items-center self-center">
            <span className="reveal-vs font-display text-base" style={{ color: "var(--text-gold)" }}>VS</span>
          </div>
        )}

        {/* 后道 */}
        <div className="text-center flex-1">
          <div className="text-[10px] font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
          <div className={`flex gap-0.5 justify-center ${showBackCompare && !showBackResult ? "reveal-comparing" : ""}`}>
            {showTiles
              ? result.arrangement.back.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)
              : result.arrangement.back.tiles.map((_, i) => (
                  <DominoTile key={i} tile={{ id: 0, name: "hidden", nameCN: "", top: 0, bottom: 0, totalPoints: 0, type: "civil", civilRank: 0, pairId: 0 }} faceDown small />
                ))
            }
          </div>
          {showTiles && (
            <div className="text-[10px] font-serif mt-0.5 animate-fade-in" style={{ color: "var(--text-secondary)" }}>
              {result.backEval.description}
            </div>
          )}
          {showBackCompare && (
            <div className="text-[10px] font-serif mt-0.5 animate-fade-in" style={{ color: "var(--text-muted)" }}>
              vs {bankerResult.backEval.description}
            </div>
          )}
          {showBackResult && (
            <div className="animate-score-pop mt-0.5">
              <span
                className="text-xs font-bold font-mono"
                style={{
                  color: result.backResult.result > 0 ? "var(--win-green)"
                    : result.backResult.result < 0 ? "var(--lose-red)"
                    : "var(--text-secondary)",
                }}
              >
                {result.backResult.result > 0 ? "胜" : result.backResult.result < 0 ? "负" : "平"}
                {" "}
                <span className="text-[10px]">
                  ({result.backPayout > 0 ? "+" : ""}{result.backPayout})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
