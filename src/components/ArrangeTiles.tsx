import { useState, useMemo, useRef, useCallback } from "react";
import type { Tile } from "~/game/types";
import { DominoTile, TileLabel } from "./DominoTile";
import { evaluatePair, isArrangementValid } from "~/game/rules";

interface ArrangeTilesProps {
  tiles: Tile[];
  onSubmit: (front: [number, number], back: [number, number]) => void;
  timeLeft: number;
}

export function ArrangeTiles({ tiles, onSubmit, timeLeft }: ArrangeTilesProps) {
  const [frontIds, setFrontIds] = useState<number[]>([]);
  const [backIds, setBackIds] = useState<number[]>([]);
  const [dragOverSlot, setDragOverSlot] = useState<"front" | "back" | null>(null);

  // 触摸拖拽状态
  const touchDragRef = useRef<{
    tileId: number;
    el: HTMLElement;
    ghost: HTMLElement | null;
    startX: number;
    startY: number;
  } | null>(null);

  const unassigned = tiles.filter(
    (t) => !frontIds.includes(t.id) && !backIds.includes(t.id)
  );

  const frontTiles = tiles.filter((t) => frontIds.includes(t.id));
  const backTiles = tiles.filter((t) => backIds.includes(t.id));

  const frontEval = useMemo(() => {
    if (frontTiles.length === 2) {
      return evaluatePair({ tiles: [frontTiles[0], frontTiles[1]] });
    }
    return null;
  }, [frontTiles]);

  const backEval = useMemo(() => {
    if (backTiles.length === 2) {
      return evaluatePair({ tiles: [backTiles[0], backTiles[1]] });
    }
    return null;
  }, [backTiles]);

  const isValid = useMemo(() => {
    if (frontTiles.length !== 2 || backTiles.length !== 2) return false;
    return isArrangementValid({
      front: { tiles: [frontTiles[0], frontTiles[1]] },
      back: { tiles: [backTiles[0], backTiles[1]] },
    });
  }, [frontTiles, backTiles]);

  const isComplete = frontIds.length === 2 && backIds.length === 2;

  const handleTileClick = (tileId: number) => {
    if (frontIds.includes(tileId)) {
      setFrontIds(frontIds.filter((id) => id !== tileId));
      return;
    }
    if (backIds.includes(tileId)) {
      setBackIds(backIds.filter((id) => id !== tileId));
      return;
    }
    if (frontIds.length < 2) {
      setFrontIds([...frontIds, tileId]);
    } else if (backIds.length < 2) {
      setBackIds([...backIds, tileId]);
    }
  };

  const handleAssignToFront = (tileId: number) => {
    if (frontIds.length >= 2) return;
    setBackIds(backIds.filter((id) => id !== tileId));
    if (!frontIds.includes(tileId)) {
      setFrontIds([...frontIds, tileId]);
    }
  };

  const handleAssignToBack = (tileId: number) => {
    if (backIds.length >= 2) return;
    setFrontIds(frontIds.filter((id) => id !== tileId));
    if (!backIds.includes(tileId)) {
      setBackIds([...backIds, tileId]);
    }
  };

  const handleReset = () => {
    setFrontIds([]);
    setBackIds([]);
  };

  // --- 拖拽处理 (HTML5 DnD) ---
  const handleDragStart = useCallback((e: React.DragEvent, tileId: number) => {
    e.dataTransfer.setData("tileId", String(tileId));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropToSlot = useCallback((e: React.DragEvent, target: "front" | "back") => {
    e.preventDefault();
    const tileId = Number(e.dataTransfer.getData("tileId"));
    if (isNaN(tileId)) return;
    // 先从两个 slot 中移除
    setFrontIds((prev) => prev.filter((id) => id !== tileId));
    setBackIds((prev) => prev.filter((id) => id !== tileId));
    // 分配到目标
    if (target === "front") {
      setFrontIds((prev) => (prev.length < 2 && !prev.includes(tileId) ? [...prev, tileId] : prev));
    } else {
      setBackIds((prev) => (prev.length < 2 && !prev.includes(tileId) ? [...prev, tileId] : prev));
    }
    setDragOverSlot(null);
  }, []);

  const handleDropToUnassigned = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const tileId = Number(e.dataTransfer.getData("tileId"));
    if (isNaN(tileId)) return;
    setFrontIds((prev) => prev.filter((id) => id !== tileId));
    setBackIds((prev) => prev.filter((id) => id !== tileId));
    setDragOverSlot(null);
  }, []);

  // --- 触摸拖拽 (移动端) ---
  const frontSlotRef = useRef<HTMLDivElement>(null);
  const backSlotRef = useRef<HTMLDivElement>(null);
  const unassignedRef = useRef<HTMLDivElement>(null);

  const hitTest = useCallback((x: number, y: number): "front" | "back" | "unassigned" | null => {
    for (const [ref, name] of [
      [frontSlotRef, "front"],
      [backSlotRef, "back"],
      [unassignedRef, "unassigned"],
    ] as const) {
      const el = ref.current;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return name;
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, tileId: number) => {
    const touch = e.touches[0];
    const el = e.currentTarget as HTMLElement;
    // 创建跟随手指的幽灵元素
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.position = "fixed";
    ghost.style.zIndex = "9999";
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.85";
    ghost.style.transform = "scale(1.1)";
    ghost.style.left = `${touch.clientX - el.offsetWidth / 2}px`;
    ghost.style.top = `${touch.clientY - el.offsetHeight / 2}px`;
    document.body.appendChild(ghost);
    el.style.opacity = "0.3";

    touchDragRef.current = {
      tileId,
      el,
      ghost,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const drag = touchDragRef.current;
    if (!drag?.ghost) return;
    const touch = e.touches[0];
    drag.ghost.style.left = `${touch.clientX - drag.el.offsetWidth / 2}px`;
    drag.ghost.style.top = `${touch.clientY - drag.el.offsetHeight / 2}px`;
    // 高亮目标
    const hit = hitTest(touch.clientX, touch.clientY);
    setDragOverSlot(hit === "front" || hit === "back" ? hit : null);
  }, [hitTest]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const drag = touchDragRef.current;
    if (!drag) return;
    // 清理幽灵元素
    if (drag.ghost) drag.ghost.remove();
    drag.el.style.opacity = "1";

    const touch = e.changedTouches[0];
    const hit = hitTest(touch.clientX, touch.clientY);

    const tileId = drag.tileId;
    // 先移除
    setFrontIds((prev) => prev.filter((id) => id !== tileId));
    setBackIds((prev) => prev.filter((id) => id !== tileId));

    if (hit === "front") {
      setFrontIds((prev) => (prev.length < 2 && !prev.includes(tileId) ? [...prev, tileId] : prev));
    } else if (hit === "back") {
      setBackIds((prev) => (prev.length < 2 && !prev.includes(tileId) ? [...prev, tileId] : prev));
    }
    // 如果 hit 是 null 或 "unassigned"，牌回到未分配

    setDragOverSlot(null);
    touchDragRef.current = null;
  }, [hitTest]);

  const handleSubmit = () => {
    if (!isComplete || !isValid) return;
    onSubmit(
      [frontIds[0], frontIds[1]] as [number, number],
      [backIds[0], backIds[1]] as [number, number]
    );
  };

  return (
    <div className="panel-glass p-5 animate-slide-up">
      {/* 标题和倒计时 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display" style={{ color: "var(--text-gold)" }}>
          搭配你的牌
        </h3>
        <div
          className={`text-lg font-mono font-bold ${timeLeft <= 10 ? "animate-shake" : ""}`}
          style={{ color: timeLeft <= 10 ? "var(--accent-crimson-light)" : "var(--text-gold)" }}
        >
          {timeLeft}s
        </div>
      </div>

      <p className="text-xs font-serif mb-4" style={{ color: "var(--text-secondary)" }}>
        点击或拖拽牌到前道/后道区域。后道须大于等于前道。
      </p>

      {/* 前道槽位 */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold font-serif" style={{ color: "var(--accent-jade)" }}>前道</span>
          <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>×1倍</span>
          {frontEval && (
            <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-jade)" }}>
              {frontEval.description}
            </span>
          )}
        </div>
        <div
          ref={frontSlotRef}
          className={`slot-area min-h-[88px] ${
            isComplete && !isValid ? "invalid" : frontIds.length === 2 ? "valid" : ""
          }`}
          style={dragOverSlot === "front" ? {
            borderColor: "var(--accent-jade)",
            background: "rgba(91,158,122,0.15)",
            boxShadow: "0 0 12px rgba(91,158,122,0.3)",
            transition: "all 0.2s ease",
          } : {}}
          onDragOver={handleDragOver}
          onDragEnter={() => setDragOverSlot("front")}
          onDragLeave={() => setDragOverSlot((prev) => prev === "front" ? null : prev)}
          onDrop={(e) => handleDropToSlot(e, "front")}
        >
          {frontTiles.map((tile) => (
            <div
              key={tile.id}
              className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, tile.id)}
              onTouchStart={(e) => handleTouchStart(e, tile.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <DominoTile
                tile={tile}
                selected
                onClick={() => handleTileClick(tile.id)}
              />
              <TileLabel tile={tile} />
            </div>
          ))}
          {frontIds.length < 2 && (
            <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>
              {frontIds.length === 0 ? "拖入或点击手牌" : "再选1张"}
            </span>
          )}
        </div>
      </div>

      {/* 后道槽位 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold font-serif" style={{ color: "var(--accent-crimson-light)" }}>后道</span>
          <span className="text-xs font-serif" style={{ color: "var(--text-muted)" }}>×2倍</span>
          {backEval && (
            <span className="text-xs font-serif ml-auto" style={{ color: "var(--accent-crimson-light)" }}>
              {backEval.description}
            </span>
          )}
        </div>
        <div
          ref={backSlotRef}
          className={`slot-area min-h-[88px] ${
            isComplete && !isValid ? "invalid" : backIds.length === 2 ? "valid" : ""
          }`}
          style={dragOverSlot === "back" ? {
            borderColor: "var(--accent-crimson-light)",
            background: "rgba(179,58,58,0.15)",
            boxShadow: "0 0 12px rgba(179,58,58,0.3)",
            transition: "all 0.2s ease",
          } : {}}
          onDragOver={handleDragOver}
          onDragEnter={() => setDragOverSlot("back")}
          onDragLeave={() => setDragOverSlot((prev) => prev === "back" ? null : prev)}
          onDrop={(e) => handleDropToSlot(e, "back")}
        >
          {backTiles.map((tile) => (
            <div
              key={tile.id}
              className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, tile.id)}
              onTouchStart={(e) => handleTouchStart(e, tile.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <DominoTile
                tile={tile}
                selected
                onClick={() => handleTileClick(tile.id)}
              />
              <TileLabel tile={tile} />
            </div>
          ))}
          {backIds.length < 2 && (
            <span className="text-sm font-serif" style={{ color: "var(--text-muted)" }}>
              {backIds.length === 0 ? "拖入或点击手牌" : "再选1张"}
            </span>
          )}
        </div>
      </div>

      {/* 验证提示 */}
      {isComplete && !isValid && (
        <div
          className="mb-3 p-2.5 rounded-xl text-xs text-center font-serif animate-fade-in"
          style={{
            background: "rgba(179,58,58,0.08)",
            border: "1px solid rgba(179,58,58,0.25)",
            color: "var(--accent-crimson-light)",
          }}
        >
          后道必须大于等于前道，请重新搭配
        </div>
      )}

      {/* 未分配的牌 */}
      <div
        ref={unassignedRef}
        className="mb-4"
        onDragOver={handleDragOver}
        onDrop={handleDropToUnassigned}
      >
        {unassigned.length > 0 ? (
          <>
            <span className="text-xs font-serif mb-1 block" style={{ color: "var(--text-muted)" }}>未分配 — 可拖拽到上方区域</span>
            <div className="flex gap-2 justify-center flex-wrap">
              {unassigned.map((tile) => (
                <div
                  key={tile.id}
                  className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => handleDragStart(e, tile.id)}
                  onTouchStart={(e) => handleTouchStart(e, tile.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <DominoTile
                    tile={tile}
                    onClick={() => handleTileClick(tile.id)}
                  />
                  <div className="flex gap-1 mt-0.5">
                    <button
                      onClick={() => handleAssignToFront(tile.id)}
                      disabled={frontIds.length >= 2}
                      className="text-[9px] px-1.5 py-0.5 rounded font-serif transition-colors disabled:opacity-30"
                      style={{
                        background: "rgba(91,158,122,0.12)",
                        color: "var(--accent-jade)",
                        cursor: frontIds.length >= 2 ? "not-allowed" : "pointer",
                        border: "none",
                      }}
                    >
                      前道
                    </button>
                    <button
                      onClick={() => handleAssignToBack(tile.id)}
                      disabled={backIds.length >= 2}
                      className="text-[9px] px-1.5 py-0.5 rounded font-serif transition-colors disabled:opacity-30"
                      style={{
                        background: "rgba(179,58,58,0.12)",
                        color: "var(--accent-crimson-light)",
                        cursor: backIds.length >= 2 ? "not-allowed" : "pointer",
                        border: "none",
                      }}
                    >
                      后道
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <span className="text-xs font-serif block text-center" style={{ color: "var(--text-muted)" }}>
            所有牌已分配 — 可拖拽调整位置
          </span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button onClick={handleReset} className="btn btn-secondary flex-1 py-2 rounded-xl font-serif">
          重置
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isComplete || !isValid}
          className="btn btn-primary flex-1 py-2 rounded-xl font-serif"
        >
          确认搭配
        </button>
      </div>
    </div>
  );
}
