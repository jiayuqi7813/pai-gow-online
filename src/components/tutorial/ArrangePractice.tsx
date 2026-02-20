import { useState, useMemo, useRef, useCallback } from "react";
import { ALL_TILES } from "~/game/tiles";
import { DominoTile, TileLabel } from "../DominoTile";
import { evaluatePair, isArrangementValid, findBestArrangement } from "~/game/rules";
import type { Tile } from "~/game/types";

const PRACTICE_HANDS: Tile[][] = [
  [ALL_TILES[0], ALL_TILES[4], ALL_TILES[22], ALL_TILES[28]],
  [ALL_TILES[2], ALL_TILES[6], ALL_TILES[14], ALL_TILES[24]],
  [ALL_TILES[30], ALL_TILES[31], ALL_TILES[10], ALL_TILES[18]],
  [ALL_TILES[8], ALL_TILES[16], ALL_TILES[26], ALL_TILES[12]],
];

export function ArrangePractice() {
  const [handIdx, setHandIdx] = useState(0);
  const [frontIds, setFrontIds] = useState<number[]>([]);
  const [backIds, setBackIds] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const tiles = PRACTICE_HANDS[handIdx];
  const unassigned = tiles.filter((t) => !frontIds.includes(t.id) && !backIds.includes(t.id));
  const frontTiles = tiles.filter((t) => frontIds.includes(t.id));
  const backTiles = tiles.filter((t) => backIds.includes(t.id));

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

  const bestArrangement = useMemo(() => findBestArrangement(tiles), [tiles]);
  const bestFrontEval = evaluatePair(bestArrangement.front);
  const bestBackEval = evaluatePair(bestArrangement.back);

  // 槽位和牌的 DOM 引用，用于点击飞行动画
  const frontSlotRef = useRef<HTMLDivElement>(null);
  const backSlotRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<number, HTMLElement>>(new Map());

  const animateTileToSlot = useCallback((tileId: number, target: "front" | "back") => {
    const wrapperEl = tileRefs.current.get(tileId);
    const slotEl = target === "front" ? frontSlotRef.current : backSlotRef.current;
    if (!wrapperEl || !slotEl) return;

    const dominoEl = wrapperEl.querySelector(".domino-tile") as HTMLElement;
    if (!dominoEl) return;

    const srcRect = dominoEl.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();

    const clone = dominoEl.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = `${srcRect.left}px`;
    clone.style.top = `${srcRect.top}px`;
    clone.style.width = `${srcRect.width}px`;
    clone.style.height = `${srcRect.height}px`;
    clone.style.zIndex = "9999";
    clone.style.pointerEvents = "none";
    clone.style.margin = "0";
    clone.classList.add("tile-flying");
    document.body.appendChild(clone);

    const destX = slotRect.left + slotRect.width / 2 - srcRect.width / 2;
    const destY = slotRect.top + slotRect.height / 2 - srcRect.height / 2;
    const dx = destX - srcRect.left;
    const dy = destY - srcRect.top;

    const anim = clone.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: "1" },
        { transform: `translate(${dx}px, ${dy}px) scale(0.95)`, opacity: "0" },
      ],
      {
        duration: 350,
        easing: "cubic-bezier(0.34, 1.2, 0.64, 1)",
        fill: "forwards",
      }
    );

    anim.onfinish = () => clone.remove();
  }, []);

  const handleTileClick = (tileId: number) => {
    if (submitted) return;
    if (frontIds.includes(tileId)) { setFrontIds(frontIds.filter((id) => id !== tileId)); return; }
    if (backIds.includes(tileId)) { setBackIds(backIds.filter((id) => id !== tileId)); return; }
    if (frontIds.length < 2) { animateTileToSlot(tileId, "front"); setFrontIds([...frontIds, tileId]); }
    else if (backIds.length < 2) { animateTileToSlot(tileId, "back"); setBackIds([...backIds, tileId]); }
  };

  const handleReset = () => {
    setFrontIds([]);
    setBackIds([]);
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (isComplete && isValid) setSubmitted(true);
  };

  const switchHand = (idx: number) => {
    setHandIdx(idx);
    setFrontIds([]);
    setBackIds([]);
    setSubmitted(false);
  };

  const isMatchingBest = submitted &&
    bestArrangement.front.tiles.every((t) => frontIds.includes(t.id)) &&
    bestArrangement.back.tiles.every((t) => backIds.includes(t.id));

  return (
    <div className="space-y-5">
      <div className="panel-glass p-4">
        <p className="font-serif text-sm" style={{ color: "var(--text-primary)" }}>
          试试搭配下面的手牌。点击牌将其分配到前道或后道，提交后查看最优解。
        </p>
      </div>

      {/* 手牌选择 */}
      <div className="flex gap-2 justify-center">
        {PRACTICE_HANDS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => switchHand(idx)}
            className="px-3 py-1.5 rounded-lg text-xs font-serif transition-all"
            style={{
              background: idx === handIdx ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
              border: idx === handIdx ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.05)",
              color: idx === handIdx ? "var(--text-gold)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            手牌 {idx + 1}
          </button>
        ))}
      </div>

      {/* 前道 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-serif font-semibold" style={{ color: "var(--accent-jade)" }}>前道 ×1</span>
          {frontEval && <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-jade)" }}>{frontEval.description}</span>}
        </div>
        <div ref={frontSlotRef} className={`slot-area min-h-[88px] ${isComplete && !isValid ? "invalid" : frontIds.length === 2 ? "valid" : ""}`}>
          {frontTiles.map((tile) => (
            <div key={tile.id} className="flex flex-col items-center gap-0.5">
              <DominoTile tile={tile} selected onClick={() => handleTileClick(tile.id)} />
              <TileLabel tile={tile} />
            </div>
          ))}
          {frontIds.length < 2 && <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>点击手牌放入</span>}
        </div>
      </div>

      {/* 后道 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-serif font-semibold" style={{ color: "var(--accent-crimson-light)" }}>后道 ×2</span>
          {backEval && <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-crimson-light)" }}>{backEval.description}</span>}
        </div>
        <div ref={backSlotRef} className={`slot-area min-h-[88px] ${isComplete && !isValid ? "invalid" : backIds.length === 2 ? "valid" : ""}`}>
          {backTiles.map((tile) => (
            <div key={tile.id} className="flex flex-col items-center gap-0.5">
              <DominoTile tile={tile} selected onClick={() => handleTileClick(tile.id)} />
              <TileLabel tile={tile} />
            </div>
          ))}
          {backIds.length < 2 && <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>点击手牌放入</span>}
        </div>
      </div>

      {isComplete && !isValid && (
        <div className="p-2.5 rounded-xl text-xs text-center font-serif" style={{ background: "rgba(179,58,58,0.08)", border: "1px solid rgba(179,58,58,0.25)", color: "var(--accent-crimson-light)" }}>
          后道必须大于等于前道
        </div>
      )}

      {/* 未分配 */}
      {unassigned.length > 0 && (
        <div>
          <span className="text-xs font-serif mb-1 block" style={{ color: "var(--text-muted)" }}>未分配</span>
          <div className="flex gap-3 justify-center">
            {unassigned.map((tile) => (
              <div key={tile.id} ref={(el) => { if (el) tileRefs.current.set(tile.id, el); else tileRefs.current.delete(tile.id); }} className="flex flex-col items-center gap-0.5">
                <DominoTile tile={tile} onClick={() => handleTileClick(tile.id)} />
                <TileLabel tile={tile} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 按钮 */}
      {!submitted ? (
        <div className="flex gap-3">
          <button onClick={handleReset} className="btn btn-secondary flex-1 py-2 rounded-xl font-serif">
            重置
          </button>
          <button onClick={handleSubmit} disabled={!isComplete || !isValid} className="btn btn-primary flex-1 py-2 rounded-xl font-serif">
            提交搭配
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {/* 评价 */}
          <div className="panel-glass p-4 text-center">
            <div className="font-display text-xl mb-2" style={{ color: isMatchingBest ? "var(--win-green)" : "var(--text-gold)" }}>
              {isMatchingBest ? "完美搭配！" : "搭配完成"}
            </div>
            {!isMatchingBest && (
              <p className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
                你的搭配可行，但存在更优方案，见下方对比。
              </p>
            )}
          </div>

          {/* 最优解 */}
          {!isMatchingBest && (
            <div className="panel-glass p-4">
              <div className="text-sm font-serif font-semibold mb-3" style={{ color: "var(--text-gold)" }}>推荐搭配</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道 ({bestFrontEval.description})</div>
                  <div className="flex justify-center gap-1">
                    <DominoTile tile={bestArrangement.front.tiles[0]} small />
                    <DominoTile tile={bestArrangement.front.tiles[1]} small />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道 ({bestBackEval.description})</div>
                  <div className="flex justify-center gap-1">
                    <DominoTile tile={bestArrangement.back.tiles[0]} small />
                    <DominoTile tile={bestArrangement.back.tiles[1]} small />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn btn-secondary w-full py-2 rounded-xl font-serif">
            重新搭配
          </button>
        </div>
      )}
    </div>
  );
}
