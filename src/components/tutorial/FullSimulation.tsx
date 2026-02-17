import { useState, useMemo } from "react";
import { createDeck } from "~/game/tiles";
import { shuffleDeck } from "~/utils/random";
import { DominoTile, TileLabel } from "../DominoTile";
import {
  evaluatePair,
  compareOneRoad,
  calculatePayout,
  findBestArrangement,
  isArrangementValid,
} from "~/game/rules";
import type { Tile, TilePair, Arrangement, CompareResult } from "~/game/types";

type Phase = "intro" | "deal" | "arrange" | "compare_front" | "compare_back" | "result";

interface AIPlayer {
  name: string;
  tiles: Tile[];
  arrangement: Arrangement | null;
}

export function FullSimulation() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [deck, setDeck] = useState<Tile[]>([]);
  const [myTiles, setMyTiles] = useState<Tile[]>([]);
  const [aiPlayers, setAiPlayers] = useState<AIPlayer[]>([]);
  const [bankerId] = useState(0);

  const [frontIds, setFrontIds] = useState<number[]>([]);
  const [backIds, setBackIds] = useState<number[]>([]);
  const [myArrangement, setMyArrangement] = useState<Arrangement | null>(null);
  const [betAmount] = useState(200);

  const startGame = () => {
    const newDeck = shuffleDeck(createDeck());
    const my = newDeck.slice(0, 4);
    const ai1Tiles = newDeck.slice(4, 8);
    const ai2Tiles = newDeck.slice(8, 12);

    const ai1: AIPlayer = { name: "AI·张三", tiles: ai1Tiles, arrangement: findBestArrangement(ai1Tiles) };
    const ai2: AIPlayer = { name: "AI·李四", tiles: ai2Tiles, arrangement: findBestArrangement(ai2Tiles) };

    setDeck(newDeck);
    setMyTiles(my);
    setAiPlayers([ai1, ai2]);
    setFrontIds([]);
    setBackIds([]);
    setMyArrangement(null);
    setPhase("deal");
  };

  const frontTiles = myTiles.filter((t) => frontIds.includes(t.id));
  const backTiles = myTiles.filter((t) => backIds.includes(t.id));
  const unassigned = myTiles.filter((t) => !frontIds.includes(t.id) && !backIds.includes(t.id));
  const isComplete = frontIds.length === 2 && backIds.length === 2;

  const frontEval = useMemo(() => {
    if (frontTiles.length === 2) return evaluatePair({ tiles: [frontTiles[0], frontTiles[1]] });
    return null;
  }, [frontTiles]);

  const backEval = useMemo(() => {
    if (backTiles.length === 2) return evaluatePair({ tiles: [backTiles[0], backTiles[1]] });
    return null;
  }, [backTiles]);

  const isValid = useMemo(() => {
    if (!isComplete) return false;
    return isArrangementValid({
      front: { tiles: [frontTiles[0], frontTiles[1]] },
      back: { tiles: [backTiles[0], backTiles[1]] },
    });
  }, [frontTiles, backTiles, isComplete]);

  const handleTileClick = (tileId: number) => {
    if (phase !== "deal" && phase !== "arrange") return;
    if (frontIds.includes(tileId)) { setFrontIds(frontIds.filter((id) => id !== tileId)); return; }
    if (backIds.includes(tileId)) { setBackIds(backIds.filter((id) => id !== tileId)); return; }
    if (frontIds.length < 2) setFrontIds([...frontIds, tileId]);
    else if (backIds.length < 2) setBackIds([...backIds, tileId]);
  };

  const handleSubmitArrangement = () => {
    if (!isComplete || !isValid) return;
    const arr: Arrangement = {
      front: { tiles: [frontTiles[0], frontTiles[1]] },
      back: { tiles: [backTiles[0], backTiles[1]] },
    };
    setMyArrangement(arr);
    setPhase("compare_front");
  };

  const bankerArr = aiPlayers[0]?.arrangement;
  const bankerFrontEval = bankerArr ? evaluatePair(bankerArr.front) : null;
  const bankerBackEval = bankerArr ? evaluatePair(bankerArr.back) : null;

  const allResults = useMemo(() => {
    if (!bankerArr || !myArrangement) return [];
    const players = [
      { name: "你", arrangement: myArrangement, bet: betAmount },
      ...aiPlayers.slice(1).map((ai) => ({ name: ai.name, arrangement: ai.arrangement!, bet: 150 })),
    ];
    return players.map((p) => {
      const fr = compareOneRoad(p.arrangement.front, bankerArr.front, true);
      const br = compareOneRoad(p.arrangement.back, bankerArr.back, true);
      const pay = calculatePayout(fr, br, p.bet);
      return { ...p, frontResult: fr, backResult: br, payout: pay, frontEval: evaluatePair(p.arrangement.front), backEval: evaluatePair(p.arrangement.back) };
    });
  }, [bankerArr, myArrangement, aiPlayers, betAmount]);

  if (phase === "intro") {
    return (
      <div className="space-y-5">
        <div className="panel-glass p-5">
          <p className="font-serif text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
            现在来模拟一局完整的牌九游戏！你将和2个AI对手对局。
          </p>
          <div className="mt-3 space-y-1.5 text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
            <p>· <strong style={{ color: "var(--text-gold)" }}>AI·张三</strong> 为庄家</p>
            <p>· 你和 <strong style={{ color: "var(--text-gold)" }}>AI·李四</strong> 为闲家</p>
            <p>· 你的注额: <strong style={{ color: "var(--text-gold)" }}>200</strong></p>
          </div>
        </div>
        <button onClick={startGame} className="btn btn-primary w-full py-3 rounded-xl font-serif text-lg">
          开始对局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 庄家信息 */}
      <div className="panel-glass p-4">
        <div className="text-sm font-serif font-semibold mb-2" style={{ color: "var(--text-gold)" }}>
          庄家: {aiPlayers[0]?.name}
        </div>
        {phase === "compare_front" || phase === "compare_back" || phase === "result" ? (
          <div className="flex gap-6 justify-center">
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
              <div className="flex gap-1 justify-center">
                {bankerArr?.front.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
              </div>
              {bankerFrontEval && <div className="text-[10px] font-serif mt-1" style={{ color: "var(--text-secondary)" }}>{bankerFrontEval.description}</div>}
            </div>
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
              <div className="flex gap-1 justify-center">
                {bankerArr?.back.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
              </div>
              {bankerBackEval && <div className="text-[10px] font-serif mt-1" style={{ color: "var(--text-secondary)" }}>{bankerBackEval.description}</div>}
            </div>
          </div>
        ) : (
          <div className="flex gap-1 justify-center">
            {aiPlayers[0]?.tiles.map((_, i) => (
              <DominoTile key={i} tile={{ id: 0, name: "hidden", nameCN: "暗牌", top: 0, bottom: 0, totalPoints: 0, type: "civil", civilRank: 0, pairId: 0 }} faceDown small />
            ))}
          </div>
        )}
      </div>

      {/* 搭配阶段 */}
      {(phase === "deal" || phase === "arrange") && (
        <>
          <div className="panel-glass p-4">
            <div className="text-sm font-serif font-semibold mb-2" style={{ color: "var(--text-primary)" }}>你的手牌</div>
            <div className="flex gap-3 justify-center mb-4">
              {unassigned.map((t, i) => (
                <div key={t.id} className="flex flex-col items-center gap-0.5 animate-deal" style={{ animationDelay: `${i * 0.1}s` }}>
                  <DominoTile tile={t} onClick={() => handleTileClick(t.id)} />
                  <TileLabel tile={t} />
                </div>
              ))}
            </div>

            {/* 前道 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-serif font-semibold" style={{ color: "var(--accent-jade)" }}>前道 ×1</span>
                {frontEval && <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-jade)" }}>{frontEval.description}</span>}
              </div>
              <div className={`slot-area min-h-[70px] ${isComplete && !isValid ? "invalid" : frontIds.length === 2 ? "valid" : ""}`}>
                {frontTiles.map((t) => (
                  <div key={t.id} className="flex flex-col items-center gap-0.5">
                    <DominoTile tile={t} selected onClick={() => handleTileClick(t.id)} />
                    <TileLabel tile={t} />
                  </div>
                ))}
                {frontIds.length < 2 && <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>点击放入</span>}
              </div>
            </div>

            {/* 后道 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-serif font-semibold" style={{ color: "var(--accent-crimson-light)" }}>后道 ×2</span>
                {backEval && <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-crimson-light)" }}>{backEval.description}</span>}
              </div>
              <div className={`slot-area min-h-[70px] ${isComplete && !isValid ? "invalid" : backIds.length === 2 ? "valid" : ""}`}>
                {backTiles.map((t) => (
                  <div key={t.id} className="flex flex-col items-center gap-0.5">
                    <DominoTile tile={t} selected onClick={() => handleTileClick(t.id)} />
                    <TileLabel tile={t} />
                  </div>
                ))}
                {backIds.length < 2 && <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>点击放入</span>}
              </div>
            </div>

            {isComplete && !isValid && (
              <div className="mb-3 p-2 rounded-xl text-xs text-center font-serif" style={{ background: "rgba(179,58,58,0.08)", border: "1px solid rgba(179,58,58,0.25)", color: "var(--accent-crimson-light)" }}>
                后道必须 ≥ 前道
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setFrontIds([]); setBackIds([]); }} className="btn btn-secondary flex-1 py-2.5 rounded-xl font-serif">
              重置
            </button>
            <button onClick={handleSubmitArrangement} disabled={!isComplete || !isValid} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
              确认搭配
            </button>
          </div>
        </>
      )}

      {/* 比牌阶段 */}
      {(phase === "compare_front" || phase === "compare_back" || phase === "result") && (
        <>
          {allResults.map((r, idx) => (
            <div key={idx} className="panel-glass p-4 animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-serif font-semibold" style={{ color: idx === 0 ? "var(--text-gold)" : "var(--text-primary)" }}>
                  {r.name}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>注:{r.bet}</span>
              </div>
              <div className="flex gap-4 justify-center mb-2">
                <div className="text-center">
                  <div className="text-[10px] font-serif" style={{ color: "var(--accent-jade)" }}>前道</div>
                  <div className="flex gap-0.5 justify-center">
                    {r.arrangement.front.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
                  </div>
                  <div className="text-[10px] font-serif" style={{ color: "var(--text-secondary)" }}>{r.frontEval.description}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-serif" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
                  <div className="flex gap-0.5 justify-center">
                    {r.arrangement.back.tiles.map((t) => <DominoTile key={t.id} tile={t} small />)}
                  </div>
                  <div className="text-[10px] font-serif" style={{ color: "var(--text-secondary)" }}>{r.backEval.description}</div>
                </div>
              </div>

              {(phase === "compare_front" || phase === "compare_back" || phase === "result") && (
                <div className="flex justify-center gap-4 text-xs font-serif">
                  <span style={{ color: r.frontResult.result > 0 ? "var(--win-green)" : r.frontResult.result < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}>
                    前道: {r.frontResult.result > 0 ? "胜" : r.frontResult.result < 0 ? "负" : "平"} ({r.payout.frontPayout > 0 ? "+" : ""}{r.payout.frontPayout})
                  </span>
                  {(phase === "compare_back" || phase === "result") && (
                    <span style={{ color: r.backResult.result > 0 ? "var(--win-green)" : r.backResult.result < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}>
                      后道: {r.backResult.result > 0 ? "胜" : r.backResult.result < 0 ? "负" : "平"} ({r.payout.backPayout > 0 ? "+" : ""}{r.payout.backPayout})
                    </span>
                  )}
                </div>
              )}

              {phase === "result" && (
                <div className="text-center mt-2 animate-score-pop">
                  <span
                    className="text-lg font-bold font-mono"
                    style={{ color: r.payout.totalPayout > 0 ? "var(--win-green)" : r.payout.totalPayout < 0 ? "var(--lose-red)" : "var(--text-secondary)" }}
                  >
                    {r.payout.totalPayout > 0 ? "+" : ""}{r.payout.totalPayout}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* 推进按钮 */}
          <div className="flex gap-3">
            {phase === "compare_front" && (
              <button onClick={() => setPhase("compare_back")} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
                比较后道
              </button>
            )}
            {phase === "compare_back" && (
              <button onClick={() => setPhase("result")} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
                查看结算
              </button>
            )}
            {phase === "result" && (
              <button onClick={startGame} className="btn btn-primary flex-1 py-2.5 rounded-xl font-serif">
                再来一局
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
