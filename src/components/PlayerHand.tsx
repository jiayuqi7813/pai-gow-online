import type { Tile } from "~/game/types";
import { DominoTile, TileLabel } from "./DominoTile";

interface PlayerHandProps {
  tiles: Tile[];
  selectedIds: number[];
  onTileClick: (tileId: number) => void;
}

export function PlayerHand({ tiles, selectedIds, onTileClick }: PlayerHandProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>你的手牌</div>
      <div className="flex gap-3 items-end">
        {tiles.map((tile, i) => (
          <div
            key={tile.id}
            className="flex flex-col items-center gap-1 animate-deal"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <DominoTile
              tile={tile}
              selected={selectedIds.includes(tile.id)}
              onClick={() => onTileClick(tile.id)}
            />
            <TileLabel tile={tile} />
          </div>
        ))}
      </div>
    </div>
  );
}
