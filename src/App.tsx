import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Film,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ViceCinemaEngine } from './cinema/ViceCinemaEngine';
import {
  ACTS,
  FILM_DURATION,
  evaluateChoreography,
  type FrameState,
} from './cinema/director/choreography';
import { CinemaOverlay } from './components/CinemaOverlay';

declare global {
  interface Window {
    __CINEMA_SEEK__?: (timeSec: number) => void;
    __CINEMA_READY__?: boolean;
  }
}

function formatTime(sec: number): string {
  const clamped = Math.max(0, Math.min(FILM_DURATION, sec));
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

/**
 * Pure frameless 1280x720 mode used by headless Chrome to capture the 60s HD MP4.
 */
function RenderFrameMode() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ViceCinemaEngine | null>(null);
  const [frame, setFrame] = useState<FrameState>(() => evaluateChoreography(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    const engine = new ViceCinemaEngine(canvas, width, height, 1);
    engine.setLetterbox(true);
    engineRef.current = engine;

    const initial = engine.renderAt(0);
    setFrame(initial);

    window.__CINEMA_SEEK__ = (t: number) => {
      const next = engine.renderAt(t);
      setFrame(next);
    };
    window.__CINEMA_READY__ = true;

    return () => {
      delete window.__CINEMA_SEEK__;
      window.__CINEMA_READY__ = false;
      engine.dispose();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <CinemaOverlay frame={frame} renderMode />
    </div>
  );
}

export default function App() {
  const isRenderMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('render') === '1';

  if (isRenderMode) {
    return <RenderFrameMode />;
  }

  return <CinemaStudio />;
}

function CinemaStudio() {
  const [viewMode, setViewMode] = useState<'video' | 'live3d'>('video');
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [freeCamera, setFreeCamera] = useState(false);
  const [letterbox, setLetterbox] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [liveFrame, setLiveFrame] = useState<FrameState>(() => evaluateChoreography(0));

  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ViceCinemaEngine | null>(null);

  const isPlayingRef = useRef(isPlaying);
  const timeRef = useRef(currentTime);
  const freeCameraRef = useRef(freeCamera);
  const letterboxRef = useRef(letterbox);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    timeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    freeCameraRef.current = freeCamera;
    engineRef.current?.setFreeCamera(freeCamera);
  }, [freeCamera]);

  useEffect(() => {
    letterboxRef.current = letterbox;
    engineRef.current?.setLetterbox(letterbox);
  }, [letterbox]);

  // Initialize / dispose Live 3D Engine when Live 3D tab is active
  useEffect(() => {
    if (viewMode !== 'live3d') return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const rect = stage.getBoundingClientRect();
    const w = Math.max(640, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    const engine = new ViceCinemaEngine(canvas, w, h, Math.min(window.devicePixelRatio || 1, 1.5));
    engine.enableOrbitControls(canvas);
    engine.setFreeCamera(freeCameraRef.current);
    engine.setLetterbox(letterboxRef.current);
    engineRef.current = engine;

    setLiveFrame(engine.renderAt(timeRef.current));

    const handleResize = () => {
      if (!stageRef.current || !engineRef.current) return;
      const r = stageRef.current.getBoundingClientRect();
      engineRef.current.resize(
        Math.max(320, Math.floor(r.width)),
        Math.max(180, Math.floor(r.height)),
        Math.min(window.devicePixelRatio || 1, 1.5)
      );
      engineRef.current.renderAt(timeRef.current);
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTs = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - lastTs) / 1000, 0.1);
      lastTs = now;

      let nextT = timeRef.current;
      if (isPlayingRef.current) {
        const audio = audioRef.current;
        if (audio && !audio.paused && Number.isFinite(audio.currentTime)) {
          nextT = audio.currentTime;
        } else {
          nextT = timeRef.current + dt;
        }
        if (nextT >= FILM_DURATION) {
          nextT = FILM_DURATION;
          setIsPlaying(false);
          audio?.pause();
        }
        timeRef.current = nextT;
        setCurrentTime(nextT);
      }

      if (engineRef.current) {
        const st = engineRef.current.renderAt(timeRef.current);
        setLiveFrame(st);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, [viewMode]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const seekTo = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, Math.min(FILM_DURATION, targetSec));
      timeRef.current = clamped;
      setCurrentTime(clamped);
      if (viewMode === 'video' && videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
      if (viewMode === 'live3d') {
        if (audioRef.current) audioRef.current.currentTime = clamped;
        if (engineRef.current) {
          setLiveFrame(engineRef.current.renderAt(clamped));
        }
      }
    },
    [viewMode]
  );

  const togglePlay = useCallback(() => {
    if (viewMode === 'video') {
      const vid = videoRef.current;
      if (!vid) return;
      if (vid.paused) {
        if (vid.currentTime >= FILM_DURATION - 0.15) vid.currentTime = 0;
        vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } else {
        vid.pause();
        setIsPlaying(false);
      }
    } else {
      const audio = audioRef.current;
      if (!isPlaying) {
        if (timeRef.current >= FILM_DURATION - 0.15) {
          timeRef.current = 0;
          setCurrentTime(0);
        }
        if (audio) {
          audio.currentTime = timeRef.current;
          audio.play().catch(() => {});
        }
        setIsPlaying(true);
      } else {
        audio?.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying, viewMode]);

  const switchMode = useCallback(
    (nextMode: 'video' | 'live3d') => {
      if (nextMode === viewMode) return;
      videoRef.current?.pause();
      audioRef.current?.pause();
      setIsPlaying(false);
      setViewMode(nextMode);
    },
    [viewMode]
  );

  const toggleFullscreen = useCallback(() => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const currentAct =
    ACTS.find((a) => currentTime >= a.start && currentTime < a.end) ?? ACTS[ACTS.length - 1];

  return (
    <div className="min-h-screen bg-[#07060d] text-white flex flex-col">
      {/* Subtle Ambient Sunset Top Glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(255,43,147,0.18),rgba(34,245,255,0.06)_45%,transparent_75%)]" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-[#090713]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(255,43,147,0.45)]">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-xl sm:text-2xl tracking-[0.12em] uppercase vice-chrome-text">
                  VICE HORIZONS
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.2em] rounded bg-pink-500/15 text-pink-300 border border-pink-500/30">
                  60s HD FILM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Leonida Neon Sunset Short · Custom GLSL Shaders · Original 120 BPM Synthwave Score
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mode Switcher */}
            <div className="flex rounded-lg p-1 bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => switchMode('video')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'video'
                    ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-[0_0_16px_rgba(255,43,147,0.4)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Rendered MP4
              </button>
              <button
                type="button"
                onClick={() => switchMode('live3d')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'live3d'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_16px_rgba(34,245,255,0.35)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Live 3D Engine
              </button>
            </div>

            <a
              href={`${import.meta.env.BASE_URL}vice-horizons-60s.mp4`}
              download="vice-horizons-60s.mp4"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-950 hover:bg-pink-100 transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download MP4
            </a>
          </div>
        </div>
      </header>

      {/* Main Cinema Stage */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
        <div
          ref={stageRef}
          className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(255,43,147,0.12)] group"
        >
          {viewMode === 'video' ? (
            <>
              {videoAvailable ? (
                <video
                  ref={videoRef}
                  src={`${import.meta.env.BASE_URL}vice-horizons-60s.mp4`}
                  poster={`${import.meta.env.BASE_URL}poster.jpg`}
                  playsInline
                  preload="metadata"
                  onClick={togglePlay}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    setVideoAvailable(false);
                    setViewMode('live3d');
                  }}
                  className="w-full h-full object-contain bg-black cursor-pointer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3 p-6 text-center">
                  <p className="text-sm">MP4 stream unavailable. Switching to Live 3D Engine.</p>
                </div>
              )}

              {/* Big Center Play Trigger when Paused at start */}
              {!isPlaying && videoAvailable && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Play 60-second film"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 hover:bg-black/25 transition cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-[0_0_45px_rgba(255,43,147,0.75)] hover:scale-105 transition">
                    <Play className="w-9 h-9 text-white fill-white ml-1" />
                  </div>
                  <span className="mt-4 text-xs tracking-[0.38em] uppercase text-white/90 font-semibold">
                    {currentTime > 0.2 ? 'RESUME 60S TRAILER' : 'PLAY 60-SECOND HD FILM'}
                  </span>
                </button>
              )}
            </>
          ) : (
            <>
              <canvas ref={canvasRef} className="block w-full h-full" />
              <CinemaOverlay frame={liveFrame} />
              <audio ref={audioRef} src={`${import.meta.env.BASE_URL}vice-horizons-audio.mp3`} preload="auto" />

              {!isPlaying && !freeCamera && currentTime < 0.2 && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Start live 3D cinematic"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 hover:bg-black/20 transition cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-pink-500 flex items-center justify-center shadow-[0_0_45px_rgba(34,245,255,0.65)] hover:scale-105 transition">
                    <Play className="w-9 h-9 text-white fill-white ml-1" />
                  </div>
                  <span className="mt-4 text-xs tracking-[0.35em] uppercase text-cyan-200 font-semibold">
                    PLAY REAL-TIME 3D FILM + SCORE
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Cinema Transport & Timeline Scrubber */}
        <section className="rounded-2xl bg-[#0e0c1a]/90 border border-white/10 p-4 sm:p-5 flex flex-col gap-4">
          {/* Interactive Timeline with Act Markers */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_#ff2b93]" />
                <span className="font-semibold tracking-wider text-white uppercase">
                  {currentAct.name}
                </span>
                <span className="hidden sm:inline text-slate-400">· {currentAct.location}</span>
              </div>
              <div className="font-mono text-cyan-300">
                {formatTime(currentTime)} <span className="text-slate-500">/ 01:00.0</span>
              </div>
            </div>

            <div
              className="relative h-3 rounded-full bg-white/10 cursor-pointer overflow-hidden"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                seekTo(frac * FILM_DURATION);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 rounded-full"
                style={{ width: `${(currentTime / FILM_DURATION) * 100}%` }}
              />
              {/* Act boundary notches */}
              {ACTS.slice(1).map((act) => (
                <div
                  key={act.id}
                  className="absolute inset-y-0 w-[2px] bg-black/70"
                  style={{ left: `${(act.start / FILM_DURATION) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-[0_0_18px_rgba(255,43,147,0.35)]"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                type="button"
                onClick={() => seekTo(0)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition cursor-pointer"
                title="Restart film"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition cursor-pointer"
                title={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {viewMode === 'live3d' && (
                <>
                  <button
                    type="button"
                    onClick={() => setFreeCamera((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                      freeCamera
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {freeCamera ? 'Free Orbit Active (Drag)' : 'Director Cam'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLetterbox((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      letterbox
                        ? 'bg-pink-500/20 border-pink-400/50 text-pink-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    2.35:1 Bars
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fullscreen
              </button>
            </div>
          </div>
        </section>

        {/* 6-Act Director Chapter Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACTS.map((act) => {
            const isActive = currentAct.id === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => seekTo(act.start + 0.05)}
                className={`text-left rounded-xl p-3.5 border transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-br from-pink-500/15 via-[#131024] to-cyan-500/10 border-pink-500/50 shadow-[0_0_24px_rgba(255,43,147,0.16)]'
                    : 'bg-[#0d0b18]/80 border-white/8 hover:border-white/20 hover:bg-[#121022]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isActive ? 'text-pink-300' : 'text-slate-200'
                    }`}
                  >
                    {act.name}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300/90">
                    {formatTime(act.start).slice(0, 5)}–{formatTime(act.end).slice(0, 5)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{act.description}</p>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
