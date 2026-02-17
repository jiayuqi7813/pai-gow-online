import { useState } from "react";
import { ALL_TILES } from "~/game/tiles";
import { DominoTile, TileLabel } from "../DominoTile";
import type { Tile } from "~/game/types";

export function TileIntro() {
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);

  const civilTiles = ALL_TILES.filter((t) => t.type === "civil");
  const militaryTiles = ALL_TILES.filter((t) => t.type === "military");

  const civilPairs: Tile[][] = [];
  for (let i = 0; i < civilTiles.length; i += 2) {
    civilPairs.push([civilTiles[i], civilTiles[i + 1]]);
  }

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="panel-glass p-5">
        <p className="font-serif text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          牌九使用一副 <strong style={{ color: "var(--text-gold)" }}>32张</strong> 中国骨牌。
          每张牌分上下两半，各有1-6个点。骨牌分为两大类：
        </p>
        <div className="flex gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "var(--accent-jade)" }} />
            <span className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
              文牌 — 11对共22张
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "var(--accent-crimson-light)" }} />
            <span className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
              武牌 — 10张
            </span>
          </div>
        </div>
      </div>

      {/* 选中牌详情 */}
      {selectedTile && (
        <div className="panel-glass p-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <DominoTile tile={selectedTile} />
            <div>
              <div className="font-serif font-bold text-lg" style={{ color: "var(--text-gold)" }}>
                {selectedTile.nameCN}
              </div>
              <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>
                上: {selectedTile.top}点 · 下: {selectedTile.bottom}点 · 总计: {selectedTile.totalPoints}点
              </div>
              <div className="text-sm font-serif mt-1" style={{ color: "var(--text-muted)" }}>
                类型: {selectedTile.type === "civil" ? "文牌" : "武牌"}
                {selectedTile.type === "civil" && ` · 排名第${selectedTile.civilRank}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 文牌 */}
      <div>
        <h3 className="font-display text-lg mb-3" style={{ color: "var(--accent-jade)" }}>
          文牌（11对 × 2 = 22张）
        </h3>
        <p className="text-xs font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
          文牌每种都有完全相同的两张。两张相同文牌组成"文牌对子"，牌力很强。
        </p>
        <div className="space-y-3">
          {civilPairs.map((pair, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-xl transition-colors"
              style={{
                background: "rgba(91,158,122,0.04)",
                border: "1px solid rgba(91,158,122,0.1)",
              }}
            >
              <span className="text-xs font-mono w-5 text-right" style={{ color: "var(--text-muted)" }}>
                {idx + 1}
              </span>
              <div className="flex gap-1.5">
                {pair.map((tile) => (
                  <div key={tile.id} className="cursor-pointer" onClick={() => setSelectedTile(tile)}>
                    <DominoTile tile={tile} small />
                  </div>
                ))}
              </div>
              <div className="ml-2">
                <span className="text-sm font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                  {pair[0].nameCN}
                </span>
                <span className="text-xs font-mono ml-2" style={{ color: "var(--text-secondary)" }}>
                  {pair[0].totalPoints}点
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 武牌 */}
      <div>
        <h3 className="font-display text-lg mb-3" style={{ color: "var(--accent-crimson-light)" }}>
          武牌（10张）
        </h3>
        <p className="text-xs font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
          武牌中同名的两张点数不同（如杂九有3+6和4+5两种），但总点数相同。
          特殊的"至尊"由丁三(3点)和二四(6点)组成，是最强组合。
        </p>
        <div className="grid grid-cols-2 gap-2">
          {militaryTiles.map((tile) => (
            <div
              key={tile.id}
              className="flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors"
              style={{
                background: "rgba(179,58,58,0.04)",
                border: "1px solid rgba(179,58,58,0.1)",
              }}
              onClick={() => setSelectedTile(tile)}
            >
              <DominoTile tile={tile} small />
              <div>
                <span className="text-sm font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                  {tile.nameCN}
                </span>
                <span className="text-xs font-mono block" style={{ color: "var(--text-secondary)" }}>
                  {tile.totalPoints}点
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
