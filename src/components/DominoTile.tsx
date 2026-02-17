import type { Tile } from "~/game/types";

interface DominoTileProps {
  tile: Tile;
  selected?: boolean;
  faceDown?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
}

/** 根据点数绘制骰子面 */
function DotGrid({ count, isRed, small }: { count: number; isRed: boolean; small?: boolean }) {
  const dotClass = isRed ? "dot dot-red" : "dot dot-white";
  
  // 点位置配置 (3x3网格索引: 0-8)
  const positions = getDotPositions(count);

  return (
    <div className={`dot-grid grid grid-cols-3 grid-rows-3 place-items-center ${small ? "gap-[1px] p-[2px]" : "gap-[2px] p-[3px]"}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center w-full h-full relative">
          {positions.includes(i) && (
            <div className={`${dotClass} rounded-full absolute inset-0 m-auto`} />
          )}
        </div>
      ))}
    </div>
  );
}

function getDotPositions(count: number): number[] {
  switch (count) {
    case 1: return [4];
    case 2: return [2, 6]; // 对角
    case 3: return [2, 4, 6]; // 斜线
    case 4: return [0, 2, 6, 8]; // 四角
    case 5: return [0, 2, 4, 6, 8]; // 五点梅花
    case 6: return [0, 2, 3, 5, 6, 8]; // 六点长牌
    default: return [];
  }
}

/** 判断点数颜色是否为红色 */
function isRedDots(tile: Tile, half: "top" | "bottom"): boolean {
  const val = half === "top" ? tile.top : tile.bottom;
  // 1点和4点为红色
  if (val === 1 || val === 4) return true;
  // 特殊牌型：至尊(丁三配二四)全红? 
  // 通常丁三(1-2)的1红2黑，二四(2-4)的2黑4红。
  // 但有些规则里至尊对子显示全红。这里遵循通用规则：1,4红，其他黑。
  // 除非特殊UI需求。这里保持原逻辑：1,4红。
  // 原逻辑里: if (tile.pairId === 16) return true; // 至尊对子可能特殊处理
  // 但单张牌显示时通常按点数颜色。这里保留原逻辑。
  if (tile.pairId === 16) return true; 
  return false;
}

export function DominoTile({ tile, selected, faceDown, small, onClick, className = "" }: DominoTileProps) {
  // 尺寸类
  const sizeClass = small ? "tile-sm" : "tile-md";

  if (faceDown || tile.name === "hidden") {
    return (
      <div
        onClick={onClick}
        className={`domino-tile face-down ${sizeClass} ${className} ${onClick ? "cursor-pointer" : ""}`}
      >
        <div className="tile-back-pattern">
          <div className="tile-back-inner">
            <span className="tile-back-text">牌<br/>九</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`domino-tile ${sizeClass} ${selected ? "selected" : ""} ${className} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="tile-face">
        {/* 上半 */}
        <div className="tile-half top">
          <DotGrid count={tile.top} isRed={isRedDots(tile, "top")} small={small} />
        </div>
        
        {/* 分隔线 */}
        <div className="tile-divider"></div>
        
        {/* 下半 */}
        <div className="tile-half bottom">
          <DotGrid count={tile.bottom} isRed={isRedDots(tile, "bottom")} small={small} />
        </div>

        {/* 光泽层 */}
        <div className="tile-shine"></div>
      </div>
    </div>
  );
}

/** 显示牌名标签 */
export function TileLabel({ tile }: { tile: Tile }) {
  return (
    <span className="text-xs font-serif tile-label" style={{ color: "var(--text-secondary)" }}>
      {tile.nameCN} <span className="opacity-70">({tile.totalPoints}点)</span>
    </span>
  );
}
