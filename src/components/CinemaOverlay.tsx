import type { FrameState } from '../cinema/director/choreography';

interface CinemaOverlayProps {
  frame: FrameState;
  renderMode?: boolean;
}

export function CinemaOverlay({ frame, renderMode = false }: CinemaOverlayProps) {
  const { overlay, t } = frame;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* Opening Title Sequence (Act I: 1.4s - 8.0s) */}
      {overlay.openingMainOpacity > 0.01 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ opacity: overlay.openingMainOpacity }}
        >
          <div
            className="text-xs sm:text-sm tracking-[0.55em] uppercase text-cyan-300 font-semibold mb-3 vice-cyan-glow"
            style={{
              opacity: overlay.openingSubOpacity,
              transform: `translateY(${(1 - overlay.openingSubOpacity) * 10}px)`,
            }}
          >
            LEONIDA COAST · AN ORIGINAL 60-SECOND SHORT
          </div>
          <div
            className={`font-display uppercase tracking-[0.14em] leading-none vice-chrome-text ${
              renderMode ? 'text-[86px]' : 'text-5xl sm:text-7xl md:text-8xl'
            }`}
            style={{
              transform: `scale(${0.94 + overlay.openingMainOpacity * 0.06})`,
            }}
          >
            VICE HORIZONS
          </div>
          <div
            className="mt-4 h-[2px] w-48 sm:w-64 bg-gradient-to-r from-transparent via-pink-400 to-transparent"
            style={{ opacity: overlay.openingSubOpacity * 0.9 }}
          />
        </div>
      )}

      {/* Act Lower-Third Chapter Slates (Acts II - V) */}
      {overlay.chapterOpacity > 0.01 && (
        <div
          className="absolute left-6 sm:left-10 bottom-[13.5%] flex items-stretch gap-3.5"
          style={{
            opacity: overlay.chapterOpacity,
            transform: `translateX(${(1 - overlay.chapterOpacity) * -18}px)`,
          }}
        >
          <div className="w-[3px] rounded-full bg-gradient-to-b from-cyan-300 via-pink-500 to-amber-400 shadow-[0_0_16px_rgba(255,43,147,0.85)]" />
          <div className="flex flex-col justify-center">
            <div className="text-[10px] sm:text-xs tracking-[0.38em] uppercase text-cyan-300/95 font-semibold vice-cyan-glow">
              {overlay.chapterSub}
            </div>
            <div
              className={`font-display uppercase tracking-[0.12em] text-white leading-tight vice-pink-glow ${
                renderMode ? 'text-[34px]' : 'text-xl sm:text-3xl'
              }`}
            >
              {overlay.chapterText}
            </div>
          </div>
        </div>
      )}

      {/* Subtle Wanted Heat Level Indicator during Act IV Police & Chopper Pursuit */}
      {overlay.wantedStars > 0 && (
        <div
          className="absolute right-6 sm:right-10 top-[13.5%] flex flex-col items-end gap-1.5"
          style={{ opacity: Math.min(1, t >= 32 && t < 51.5 ? 0.92 : 0) }}
        >
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const active = i < overlay.wantedStars;
              const strobe = Math.sin(t * 16 + i * 0.7) > 0;
              return (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    active
                      ? strobe
                        ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(255,20,70,0.95)]'
                        : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,245,255,0.95)]'
                      : 'text-white/20'
                  }`}
                  fill="currentColor"
                >
                  <path d="M12 2.5l2.92 6.08 6.7.92-4.88 4.68 1.2 6.66L12 17.64l-5.94 3.2 1.2-6.66-4.88-4.68 6.7-.92L12 2.5z" />
                </svg>
              );
            })}
          </div>
          <div className="text-[10px] tracking-[0.32em] uppercase font-mono text-white/75">
            HEAT LVL {overlay.wantedStars} · {overlay.speedMph} MPH
          </div>
        </div>
      )}

      {/* Grand Finale Chrome End Card (Act VI: 53.2s - 59.8s) */}
      {overlay.finaleOpacity > 0.01 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          style={{ opacity: overlay.finaleOpacity }}
        >
          <div className="text-xs sm:text-sm tracking-[0.5em] uppercase text-amber-200/90 font-semibold mb-3">
            WELCOME BACK TO LEONIDA
          </div>
          <div
            className={`font-display uppercase tracking-[0.15em] leading-none vice-chrome-text ${
              renderMode ? 'text-[92px]' : 'text-5xl sm:text-7xl md:text-8xl'
            }`}
            style={{
              transform: `scale(${0.92 + overlay.finaleOpacity * 0.08})`,
            }}
          >
            VICE HORIZONS
          </div>
          <div className="mt-5 flex items-center gap-4 text-[11px] sm:text-xs tracking-[0.38em] uppercase text-cyan-300/90 font-mono">
            <span>2.35:1 ANAMORPHIC</span>
            <span className="text-pink-400">/</span>
            <span>60 SECONDS</span>
            <span className="text-pink-400">/</span>
            <span>ORIGINAL SCORE</span>
          </div>
        </div>
      )}
    </div>
  );
}
