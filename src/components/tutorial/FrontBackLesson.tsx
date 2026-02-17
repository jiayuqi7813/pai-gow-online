import { ALL_TILES } from "~/game/tiles";
import { DominoTile } from "../DominoTile";
import { evaluatePair } from "~/game/rules";

const EXAMPLE_TILES = [ALL_TILES[0], ALL_TILES[8], ALL_TILES[22], ALL_TILES[28]];

const GOOD_FRONT = { tiles: [EXAMPLE_TILES[2], EXAMPLE_TILES[3]] as [typeof EXAMPLE_TILES[0], typeof EXAMPLE_TILES[0]] };
const GOOD_BACK = { tiles: [EXAMPLE_TILES[0], EXAMPLE_TILES[1]] as [typeof EXAMPLE_TILES[0], typeof EXAMPLE_TILES[0]] };

const BAD_FRONT = { tiles: [EXAMPLE_TILES[0], EXAMPLE_TILES[1]] as [typeof EXAMPLE_TILES[0], typeof EXAMPLE_TILES[0]] };
const BAD_BACK = { tiles: [EXAMPLE_TILES[2], EXAMPLE_TILES[3]] as [typeof EXAMPLE_TILES[0], typeof EXAMPLE_TILES[0]] };

export function FrontBackLesson() {
  const goodFrontEval = evaluatePair(GOOD_FRONT);
  const goodBackEval = evaluatePair(GOOD_BACK);
  const badFrontEval = evaluatePair(BAD_FRONT);
  const badBackEval = evaluatePair(BAD_BACK);

  return (
    <div className="space-y-6">
      <div className="panel-glass p-5">
        <p className="font-serif text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          每位玩家拿到 <strong style={{ color: "var(--text-gold)" }}>4张牌</strong>，需要分成两组：
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(91,158,122,0.06)", border: "1px solid rgba(91,158,122,0.15)" }}>
            <div className="font-display text-xl mb-1" style={{ color: "var(--accent-jade)" }}>前道</div>
            <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>2张牌</div>
            <div className="text-lg font-mono font-bold mt-2" style={{ color: "var(--accent-jade)" }}>×1倍</div>
            <div className="text-xs font-serif mt-1" style={{ color: "var(--text-muted)" }}>赢/输按注额计算</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(179,58,58,0.06)", border: "1px solid rgba(179,58,58,0.15)" }}>
            <div className="font-display text-xl mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道</div>
            <div className="text-sm font-serif" style={{ color: "var(--text-secondary)" }}>2张牌</div>
            <div className="text-lg font-mono font-bold mt-2" style={{ color: "var(--accent-crimson-light)" }}>×2倍</div>
            <div className="text-xs font-serif mt-1" style={{ color: "var(--text-muted)" }}>赢/输按双倍注额计算</div>
          </div>
        </div>
      </div>

      <div className="panel-glass p-5">
        <h4 className="font-display text-base mb-3" style={{ color: "var(--text-gold)" }}>
          核心规则：后道 ≥ 前道
        </h4>
        <p className="font-serif text-sm" style={{ color: "var(--text-secondary)" }}>
          你搭配的后道牌力必须<strong style={{ color: "var(--text-gold)" }}>大于或等于</strong>前道。
          这是为了防止玩家把所有好牌放在倍率低的前道。
        </p>
      </div>

      {/* 示例手牌 */}
      <div className="panel-glass p-5">
        <h4 className="font-display text-base mb-3" style={{ color: "var(--text-gold)" }}>搭配示例</h4>
        <div className="text-sm font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
          假设你拿到这4张牌：
        </div>
        <div className="flex justify-center gap-3 mb-5">
          {EXAMPLE_TILES.map((t) => (
            <div key={t.id} className="flex flex-col items-center gap-1">
              <DominoTile tile={t} />
              <span className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>{t.nameCN}</span>
            </div>
          ))}
        </div>

        {/* 合法搭配 */}
        <div className="p-4 rounded-xl mb-3" style={{ background: "rgba(91,158,122,0.06)", border: "1px solid rgba(91,158,122,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-serif font-bold" style={{ color: "var(--accent-jade)" }}>合法搭配</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道 ({goodFrontEval.description})</div>
              <div className="flex justify-center gap-1">
                <DominoTile tile={GOOD_FRONT.tiles[0]} small />
                <DominoTile tile={GOOD_FRONT.tiles[1]} small />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道 ({goodBackEval.description})</div>
              <div className="flex justify-center gap-1">
                <DominoTile tile={GOOD_BACK.tiles[0]} small />
                <DominoTile tile={GOOD_BACK.tiles[1]} small />
              </div>
            </div>
          </div>
          <div className="text-xs font-serif text-center mt-2" style={{ color: "var(--accent-jade)" }}>
            后道 ≥ 前道 — 合法
          </div>
        </div>

        {/* 非法搭配 */}
        <div className="p-4 rounded-xl" style={{ background: "rgba(179,58,58,0.06)", border: "1px solid rgba(179,58,58,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-serif font-bold" style={{ color: "var(--accent-crimson-light)" }}>非法搭配</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-jade)" }}>前道 ({badFrontEval.description})</div>
              <div className="flex justify-center gap-1">
                <DominoTile tile={BAD_FRONT.tiles[0]} small />
                <DominoTile tile={BAD_FRONT.tiles[1]} small />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-serif mb-1" style={{ color: "var(--accent-crimson-light)" }}>后道 ({badBackEval.description})</div>
              <div className="flex justify-center gap-1">
                <DominoTile tile={BAD_BACK.tiles[0]} small />
                <DominoTile tile={BAD_BACK.tiles[1]} small />
              </div>
            </div>
          </div>
          <div className="text-xs font-serif text-center mt-2" style={{ color: "var(--accent-crimson-light)" }}>
            前道 {'>'} 后道 — 违规！
          </div>
        </div>
      </div>

      <div className="panel-glass p-4">
        <p className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-gold)" }}>策略提示：</strong>
          由于后道倍率是前道的两倍(×2 vs ×1)，通常应该把更强的牌放在后道，
          但也要确保前道不太弱，争取两道都赢。
        </p>
      </div>
    </div>
  );
}
