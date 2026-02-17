import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TileIntro } from "./tutorial/TileIntro";
import { PointsLesson } from "./tutorial/PointsLesson";
import { RankingLesson } from "./tutorial/RankingLesson";
import { FrontBackLesson } from "./tutorial/FrontBackLesson";
import { ArrangePractice } from "./tutorial/ArrangePractice";
import { CompareDemo } from "./tutorial/CompareDemo";
import { FullSimulation } from "./tutorial/FullSimulation";

const CHAPTERS = [
  { title: "认识骨牌", desc: "32张牌的分类" },
  { title: "牌面点数", desc: "如何计算点数" },
  { title: "牌型大小", desc: "特殊组合排名" },
  { title: "前道与后道", desc: "搭配规则" },
  { title: "搭配练习", desc: "实际操作" },
  { title: "比牌规则", desc: "对比演示" },
  { title: "完整模拟", desc: "模拟对局" },
];

export function Tutorial() {
  const [chapter, setChapter] = useState(0);
  const navigate = useNavigate();

  const goNext = () => {
    if (chapter < CHAPTERS.length - 1) setChapter(chapter + 1);
  };
  const goPrev = () => {
    if (chapter > 0) setChapter(chapter - 1);
  };

  const renderChapter = () => {
    switch (chapter) {
      case 0: return <TileIntro />;
      case 1: return <PointsLesson />;
      case 2: return <RankingLesson />;
      case 3: return <FrontBackLesson />;
      case 4: return <ArrangePractice />;
      case 5: return <CompareDemo />;
      case 6: return <FullSimulation />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-deep)" }}>
      {/* 顶部导航 */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(22,18,34,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(201,168,76,0.1)",
        }}
      >
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-sm font-serif transition-colors"
          style={{ color: "var(--text-secondary)", cursor: "pointer", background: "none", border: "none" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-gold)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          ← 返回首页
        </button>
        <span className="font-display text-lg" style={{ color: "var(--text-gold)" }}>
          教程模式
        </span>
        <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          {chapter + 1}/{CHAPTERS.length}
        </span>
      </div>

      {/* 进度条 */}
      <div className="px-4 pt-3">
        <div className="tutorial-progress">
          <div
            className="tutorial-progress-bar"
            style={{ width: `${((chapter + 1) / CHAPTERS.length) * 100}%` }}
          />
        </div>
        {/* 步骤点 */}
        <div className="flex justify-between mt-2">
          {CHAPTERS.map((ch, idx) => (
            <button
              key={idx}
              onClick={() => setChapter(idx)}
              className={`tutorial-step-dot ${idx === chapter ? "active" : idx < chapter ? "completed" : ""}`}
              title={ch.title}
              style={{ cursor: "pointer", padding: 0, background: "none", border: "none" }}
            />
          ))}
        </div>
      </div>

      {/* 章节标题 */}
      <div className="px-4 pt-4 pb-2 text-center">
        <h2 className="font-display text-2xl" style={{ color: "var(--text-gold)" }}>
          {CHAPTERS[chapter].title}
        </h2>
        <p className="text-sm font-serif mt-1" style={{ color: "var(--text-secondary)" }}>
          {CHAPTERS[chapter].desc}
        </p>
      </div>

      {/* 章节内容 */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto animate-fade-in" key={chapter}>
          {renderChapter()}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="px-4 py-4 flex gap-3 max-w-2xl mx-auto w-full">
        <button
          onClick={goPrev}
          disabled={chapter === 0}
          className="btn btn-secondary flex-1 py-3 rounded-xl font-serif"
        >
          上一章
        </button>
        {chapter < CHAPTERS.length - 1 ? (
          <button
            onClick={goNext}
            className="btn btn-primary flex-1 py-3 rounded-xl font-serif"
          >
            下一章
          </button>
        ) : (
          <button
            onClick={() => navigate({ to: "/" })}
            className="btn btn-primary flex-1 py-3 rounded-xl font-serif"
          >
            完成教程
          </button>
        )}
      </div>
    </div>
  );
}
