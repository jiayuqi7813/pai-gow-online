import { ALL_TILES } from "~/game/tiles";
import { evaluatePair } from "~/game/rules";
import { DominoTile } from "../DominoTile";

const RANKED_COMBOS = [
  { tiles: [ALL_TILES[30], ALL_TILES[31]], note: "最强组合" },
  { tiles: [ALL_TILES[0], ALL_TILES[1]], note: "文牌对子 #1" },
  { tiles: [ALL_TILES[2], ALL_TILES[3]], note: "文牌对子 #2" },
  { tiles: [ALL_TILES[4], ALL_TILES[5]], note: "文牌对子 #3" },
  { tiles: [ALL_TILES[6], ALL_TILES[7]], note: "文牌对子 #4" },
  { tiles: [ALL_TILES[8], ALL_TILES[9]], note: "文牌对子 #5" },
  { tiles: [ALL_TILES[10], ALL_TILES[11]], note: "文牌对子 #6" },
  { tiles: [ALL_TILES[12], ALL_TILES[13]], note: "文牌对子 #7" },
  { tiles: [ALL_TILES[14], ALL_TILES[15]], note: "文牌对子 #8" },
  { tiles: [ALL_TILES[16], ALL_TILES[17]], note: "文牌对子 #9" },
  { tiles: [ALL_TILES[18], ALL_TILES[19]], note: "文牌对子 #10" },
  { tiles: [ALL_TILES[20], ALL_TILES[21]], note: "文牌对子 #11" },
  { tiles: [ALL_TILES[22], ALL_TILES[23]], note: "武牌对子" },
  { tiles: [ALL_TILES[24], ALL_TILES[25]], note: "武牌对子" },
  { tiles: [ALL_TILES[26], ALL_TILES[27]], note: "武牌对子" },
  { tiles: [ALL_TILES[28], ALL_TILES[29]], note: "武牌对子" },
  { tiles: [ALL_TILES[0], ALL_TILES[22]], note: "天+杂九" },
  { tiles: [ALL_TILES[2], ALL_TILES[22]], note: "地+杂九" },
  { tiles: [ALL_TILES[0], ALL_TILES[24]], note: "天+杂八" },
  { tiles: [ALL_TILES[2], ALL_TILES[24]], note: "地+杂八" },
  { tiles: [ALL_TILES[0], ALL_TILES[26]], note: "天+杂七" },
  { tiles: [ALL_TILES[2], ALL_TILES[26]], note: "地+杂七" },
];

export function RankingLesson() {
  return (
    <div className="space-y-6">
      <div className="panel-glass p-5">
        <p className="font-serif text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          牌九中有特殊组合，它们的牌力<strong style={{ color: "var(--text-gold)" }}>远高于</strong>普通点数。
          排名越靠前越强，排名相同时庄家赢（拷贝规则）。
        </p>
        <div className="mt-3 text-xs font-serif space-y-1" style={{ color: "var(--text-secondary)" }}>
          <p>· 特殊组合 {'>'} 普通点数（无论几点）</p>
          <p>· 普通点数中 9点最大，0点最小</p>
          <p>· 同点数比单牌大小，文牌 {'>'} 武牌</p>
        </div>
      </div>

      {/* 排名列表 */}
      <div className="space-y-2">
        {RANKED_COMBOS.map((combo, idx) => {
          const evaluation = evaluatePair({ tiles: [combo.tiles[0], combo.tiles[1]] });
          const isSpecialSection = idx === 0;
          const isCivilStart = idx === 1;
          const isMilitaryStart = idx === 12;
          const isKingStart = idx === 16;

          return (
            <div key={idx}>
              {isSpecialSection && (
                <div className="font-display text-sm mb-2 mt-2" style={{ color: "var(--text-gold)" }}>
                  至尊
                </div>
              )}
              {isCivilStart && (
                <div className="font-display text-sm mb-2 mt-4" style={{ color: "var(--accent-jade)" }}>
                  文牌对子（双天 {'>'} 双地 {'>'} ... {'>'} 双伶冧六）
                </div>
              )}
              {isMilitaryStart && (
                <div className="font-display text-sm mb-2 mt-4" style={{ color: "var(--accent-crimson-light)" }}>
                  武牌对子（杂九对 {'>'} 杂八对 {'>'} 杂七对 {'>'} 杂五对）
                </div>
              )}
              {isKingStart && (
                <div className="font-display text-sm mb-2 mt-4" style={{ color: "var(--text-gold)" }}>
                  天王/地王/天杠/地杠/高九
                </div>
              )}
              <div
                className="flex items-center gap-3 p-2.5 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-xs font-mono w-5 text-right" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </span>
                <div className="flex gap-1">
                  <DominoTile tile={combo.tiles[0]} small />
                  <DominoTile tile={combo.tiles[1]} small />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                    {evaluation.description}
                  </span>
                  <span className="text-xs font-serif ml-2" style={{ color: "var(--text-muted)" }}>
                    {combo.note}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-gold)" }}>
                  {evaluation.points}点
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-glass p-4 text-center">
        <p className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
          以上特殊组合之后，就是普通点数比大小：9 {'>'} 8 {'>'} 7 {'>'} ... {'>'} 1 {'>'} 0
        </p>
      </div>
    </div>
  );
}
