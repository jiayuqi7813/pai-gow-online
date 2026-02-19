import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "~/hooks/useAudio";

export function AudioControls() {
  const { settings, setVolume, toggleMute, play } = useAudio();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const panelTop = btnRef.current ? btnRef.current.getBoundingClientRect().bottom + 6 : 44;
  const panelRight = btnRef.current
    ? window.innerWidth - btnRef.current.getBoundingClientRect().right
    : 12;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          setOpen((v) => !v);
          play("click");
        }}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(201,168,76,0.15)",
          color: settings.muted ? "var(--text-muted)" : "var(--text-gold)",
          cursor: "pointer",
        }}
        title="音效设置"
      >
        {settings.muted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed w-60 rounded-xl p-4 space-y-4 animate-fade-in"
            style={{
              zIndex: 9999,
              top: panelTop,
              right: panelRight,
              background: "rgba(30,24,48,0.97)",
              border: "1px solid rgba(201,168,76,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="font-serif text-sm font-semibold" style={{ color: "var(--text-gold)" }}>
                音效设置
              </div>
              <button
                onClick={() => { toggleMute(); play("click"); }}
                className="text-xs font-serif px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: settings.muted ? "rgba(179,58,58,0.15)" : "rgba(91,158,122,0.15)",
                  color: settings.muted ? "var(--accent-crimson-light)" : "var(--accent-jade)",
                  border: settings.muted ? "1px solid rgba(179,58,58,0.25)" : "1px solid rgba(91,158,122,0.25)",
                  cursor: "pointer",
                }}
              >
                {settings.muted ? "已静音" : "静音"}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif" style={{ color: "var(--text-secondary)" }}>
                  音量
                </span>
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: settings.muted ? "var(--text-muted)" : "var(--text-gold)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {settings.muted ? "静音" : `${Math.round(settings.volume * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="audio-slider w-full"
                style={{ opacity: settings.muted ? 0.4 : 1 }}
              />
              <div className="flex justify-between mt-2 gap-1.5">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => { setVolume(pct / 100); play("click"); }}
                    className="flex-1 text-[10px] font-mono py-1 rounded transition-all"
                    style={{
                      background: Math.round(settings.volume * 100) === pct
                        ? "rgba(201,168,76,0.2)"
                        : "rgba(255,255,255,0.03)",
                      border: Math.round(settings.volume * 100) === pct
                        ? "1px solid rgba(201,168,76,0.3)"
                        : "1px solid rgba(255,255,255,0.06)",
                      color: Math.round(settings.volume * 100) === pct
                        ? "var(--text-gold)"
                        : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => play("chipLay")}
              className="w-full text-xs font-serif py-2 rounded-lg transition-all"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(201,168,76,0.15)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              试听音效
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
