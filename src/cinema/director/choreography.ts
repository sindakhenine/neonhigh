import * as THREE from 'three';

export interface ActInfo {
  index: number;
  id: string;
  start: number;
  end: number;
  name: string;
  location: string;
  description: string;
}

export const FILM_DURATION = 60.0;

export const ACTS: ActInfo[] = [
  {
    index: 0,
    id: 'golden-coast',
    start: 0,
    end: 10,
    name: 'ACT I · THE GOLDEN COAST',
    location: 'LEONIDA ATLANTIC SHORELINE',
    description: 'Aerial sunset sweep across shimmering ocean waves, swaying palms, and the Vice skyline.',
  },
  {
    index: 1,
    id: 'ocean-drive',
    start: 10,
    end: 20,
    name: 'ACT II · OCEAN DRIVE',
    location: 'ART DECO NEON STRIP',
    description: 'Low-angle wet-asphalt glide past glowing Art Deco hotels as the Apex GT ignites.',
  },
  {
    index: 2,
    id: 'midnight-causeway',
    start: 20,
    end: 32,
    name: 'ACT III · MIDNIGHT CAUSEWAY',
    location: 'STARLIGHT BAY BRIDGE',
    description: '180 MPH full-throttle launch across the illuminated cable-stay bay causeway.',
  },
  {
    index: 3,
    id: 'heat-level-five',
    start: 32,
    end: 44,
    name: 'ACT IV · HEAT LEVEL FIVE',
    location: 'INTERSTATE 86 PURSUIT',
    description: 'Police interceptors surge in red-and-blue reflections as a chopper spotlight locks on.',
  },
  {
    index: 4,
    id: 'neon-overdrive',
    start: 44,
    end: 52,
    name: 'ACT V · NEON OVERDRIVE',
    location: 'DOWNTOWN LEONIDA CANYON',
    description: 'Skyscraper canyon blitz with a high-G drift swing beneath glowing holographic towers.',
  },
  {
    index: 5,
    id: 'horizon-finale',
    start: 52,
    end: 60,
    name: 'ACT VI · HORIZON FINALE',
    location: 'VICE EXPRESSWAY · SUNSET',
    description: 'Soaring crane pullback as twin crimson light trails vanish into the neon horizon.',
  },
];

export interface TitleOverlayState {
  openingMainOpacity: number;
  openingSubOpacity: number;
  chapterText: string;
  chapterSub: string;
  chapterOpacity: number;
  finaleOpacity: number;
  speedMph: number;
  wantedStars: number;
}

export interface FrameState {
  t: number;
  act: ActInfo;
  nightFactor: number;
  sunDir: THREE.Vector3;
  cameraPos: THREE.Vector3;
  cameraLookAt: THREE.Vector3;
  cameraFov: number;
  cameraRoll: number;
  heroPos: THREE.Vector3;
  heroYaw: number;
  heroRoll: number;
  heroSpeed: number;
  heroWheelAngle: number;
  exhaustFlame: number;
  policeActive: number;
  police1Pos: THREE.Vector3;
  police2Pos: THREE.Vector3;
  heliActive: number;
  heliPos: THREE.Vector3;
  heliSpotlightPos: THREE.Vector3;
  beatPulse: number;
  globalFade: number;
  bloomStrength: number;
  chromatic: number;
  overlay: TitleOverlayState;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return k * k * (3 - 2 * k);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function pulseWindow(t: number, tIn: number, tHoldStart: number, tHoldEnd: number, tOut: number): number {
  if (t < tIn || t > tOut) return 0;
  if (t < tHoldStart) return smoothstep(tIn, tHoldStart, t);
  if (t > tHoldEnd) return 1 - smoothstep(tHoldEnd, tOut, t);
  return 1;
}

/**
 * Deterministic hero supercar Z position along the 2.4km coastal boulevard.
 * Piecewise smooth motion matching each act's zone:
 *  - Act I  (0-10s):   Cruising gently on Ocean Drive (z: -150 -> -210)
 *  - Act II (10-20s):  Rolling showcase & launch prep on Ocean Drive (z: -210 -> -490)
 *  - Act III(20-32s):  Full-throttle 180 MPH blast across Midnight Causeway (z: -490 -> -1120)
 *  - Act IV (32-44s):  High-speed police & chopper pursuit into Downtown edge (z: -1120 -> -1580)
 *  - Act V  (44-52s):  Downtown Neon Canyon overdrive + drift showcase (z: -1580 -> -1940)
 *  - Act VI (52-60s):  Soaring escape into infinite sunset expressway (z: -1940 -> -2240)
 */
function computeHeroMotion(t: number): {
  z: number;
  x: number;
  speed: number;
  yaw: number;
  roll: number;
  flame: number;
} {
  let z = -180;
  let x = 3.2;
  let speed = 12;
  let yaw = 0;
  let roll = 0;
  let flame = 0;

  if (t < 10) {
    const u = t / 10;
    z = lerp(-150, -210, u);
    x = 3.4;
    speed = 8;
  } else if (t < 20) {
    const u = (t - 10) / 10;
    // Smooth cruise then hard rev-launch at t = 17.5 -> 20.0
    const accel = u < 0.72 ? u * 0.52 : 0.3744 + Math.pow((u - 0.72) / 0.28, 2.2) * 0.6256;
    z = lerp(-210, -510, accel);
    x = 3.2 + Math.sin(u * Math.PI * 1.5) * 0.9;
    speed = u < 0.72 ? 18 : lerp(18, 66, (u - 0.72) / 0.28);
    if (t > 18.2 && t < 19.95) {
      flame = 0.55 + 0.45 * Math.sin(t * 48);
    }
  } else if (t < 32) {
    const u = (t - 20) / 12;
    z = lerp(-510, -1140, u);
    // Confident high-speed weave across causeway lanes
    x = Math.sin(u * Math.PI * 2.2) * 4.4;
    const dx = Math.cos(u * Math.PI * 2.2) * 4.4 * (Math.PI * 2.2 / 12);
    yaw = -dx * 0.045;
    roll = dx * 0.012;
    speed = 54 + 6 * Math.sin(u * Math.PI);
    // Gear-shift exhaust pops on 4-second musical downbeats
    for (const shiftT of [20.05, 24.0, 28.0]) {
      const dt = t - shiftT;
      if (dt >= 0 && dt < 0.55) {
        flame = Math.max(flame, (1 - dt / 0.55) * (0.7 + 0.3 * Math.sin(t * 60)));
      }
    }
  } else if (t < 44) {
    const u = (t - 32) / 12;
    z = lerp(-1140, -1580, u);
    // Evasive pursuit slalom weaving between lanes
    x = Math.sin(u * Math.PI * 3.1 + 0.4) * 5.2;
    const dx = Math.cos(u * Math.PI * 3.1 + 0.4) * 5.2 * (Math.PI * 3.1 / 12);
    yaw = -dx * 0.052;
    roll = dx * 0.015;
    speed = 46 + 8 * Math.sin(u * Math.PI * 2);
    for (const shiftT of [32.05, 36.0, 40.0]) {
      const dt = t - shiftT;
      if (dt >= 0 && dt < 0.48) {
        flame = Math.max(flame, (1 - dt / 0.48) * 0.85);
      }
    }
  } else if (t < 52) {
    const u = (t - 44) / 8;
    z = lerp(-1580, -1935, u);
    // Dramatic wide canyon drift sweep at u = 0.25 -> 0.75!
    const driftEnv = pulseWindow(u, 0.18, 0.34, 0.66, 0.86);
    x = lerp(2.0, -4.6, smoothstep(0.15, 0.55, u)) + lerp(0, 4.6, smoothstep(0.55, 0.92, u));
    yaw = driftEnv * 0.34; // Stylized cinematic power-slide yaw!
    roll = -driftEnv * 0.075;
    speed = lerp(58, 42, driftEnv * 0.5); // subtle speed-ramp sensation
    flame = Math.max(
      driftEnv * (0.55 + 0.45 * Math.sin(t * 52)),
      t < 44.65 ? (1 - (t - 44) / 0.65) : 0
    );
  } else {
    const u = (t - 52) / 8;
    z = lerp(-1935, -2260, u);
    x = lerp(0.0, 0.0, u);
    speed = 48;
    flame = t < 53.2 ? (1 - (t - 52) / 1.2) * 0.7 : 0.12;
  }

  return { z, x, speed, yaw, roll, flame };
}

export function evaluateChoreography(rawTime: number): FrameState {
  const t = clamp(rawTime, 0, FILM_DURATION);
  const act = ACTS.find((a) => t >= a.start && t < a.end) ?? ACTS[ACTS.length - 1];

  // 120 BPM musical beat pulse (every 0.5s)
  const beatPhase = (t * 2.0) % 1.0;
  const beatActive = (t >= 10 && t < 42) || (t >= 44 && t < 52);
  const beatPulse = beatActive ? Math.exp(-beatPhase * 6.5) : 0;

  // Smooth atmospheric lighting transition across the 60s arc
  let nightFactor = 0.1;
  if (t < 10) {
    nightFactor = lerp(0.06, 0.22, t / 10);
  } else if (t < 20) {
    nightFactor = lerp(0.28, 0.58, (t - 10) / 10);
  } else if (t < 32) {
    nightFactor = lerp(0.66, 0.84, (t - 20) / 12);
  } else if (t < 44) {
    nightFactor = lerp(0.88, 0.96, (t - 32) / 12);
  } else if (t < 52) {
    nightFactor = lerp(0.95, 0.72, (t - 44) / 8);
  } else {
    nightFactor = lerp(0.62, 0.24, (t - 52) / 8);
  }

  // Sun lowers gently into twilight then blazes back on the finale horizon
  const sunElev = lerp(0.125, 0.055, nightFactor);
  const sunDir = new THREE.Vector3(-0.07, sunElev, -0.995).normalize();

  const hero = computeHeroMotion(t);
  const heroPos = new THREE.Vector3(hero.x, 0, hero.z);

  // Camera Choreography per Act
  const cameraPos = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  let cameraFov = 54;
  let cameraRoll = 0;

  if (t < 10) {
    // ACT I: Sweeping golden-hour aerial drone over ocean & palm silhouettes toward glowing Miami skyline
    const u = t / 10;
    const ease = smoothstep(0, 1, u);
    cameraPos.set(
      lerp(-74, -22, ease),
      lerp(20.5, 9.2, ease) + Math.sin(u * Math.PI) * 1.8,
      lerp(15, -175, u)
    );
    cameraLookAt.set(
      lerp(-18, 8, ease),
      lerp(10.0, 8.5, ease),
      lerp(-240, -340, u)
    );
    cameraFov = lerp(52, 58, ease);
    cameraRoll = lerp(-0.045, 0.015, ease);
  } else if (t < 20) {
    // ACT II: Ocean Drive wet-asphalt low-angle hero reveal & launch!
    const u = (t - 10) / 10;
    if (u < 0.55) {
      // Sweeping low front-3/4 glide pulling back in front of the rolling supercar along neon Art Deco strip
      const k = u / 0.55;
      cameraPos.set(
        heroPos.x - lerp(5.4, 3.6, k),
        lerp(1.55, 1.15, k),
        heroPos.z - lerp(10.5, 6.2, k)
      );
      cameraLookAt.set(heroPos.x + 1.4, 1.15, heroPos.z + 1.5);
      cameraFov = 48;
      cameraRoll = 0.025;
    } else {
      // Orbit smoothly around to aggressive rear-quarter launch cam as V12 revs & blasts off!
      const k = smoothstep(0.55, 1.0, u);
      const angle = lerp(-0.85, 0.35, k);
      const rad = lerp(6.8, 7.6, k);
      cameraPos.set(
        heroPos.x + Math.sin(angle) * rad,
        lerp(1.35, 2.05, k),
        heroPos.z + Math.cos(angle) * rad
      );
      cameraLookAt.set(heroPos.x, 1.05, heroPos.z - 14);
      cameraFov = lerp(50, 66, k);
      cameraRoll = -0.02 * Math.sin(k * Math.PI);
    }
  } else if (t < 32) {
    // ACT III: Midnight Causeway — 180 MPH exhilarating chase + wheel-level hero swing
    const u = (t - 20) / 12;
    const shakeX = Math.sin(t * 23) * 0.045;
    const shakeY = Math.cos(t * 31) * 0.035;
    if (u < 0.52) {
      // Low aggressive rear-chase bumper cam beneath massive glowing bridge pylons
      const k = u / 0.52;
      cameraPos.set(
        heroPos.x * 0.65 + Math.sin(k * Math.PI * 1.5) * 2.8 + shakeX,
        1.75 + Math.sin(k * Math.PI) * 0.8 + shakeY,
        heroPos.z + lerp(7.2, 8.6, k)
      );
      cameraLookAt.set(heroPos.x * 0.5, 2.2, heroPos.z - 38);
      cameraFov = 68 + beatPulse * 2.4;
      cameraRoll = -hero.roll * 1.4;
    } else {
      // Dramatic low-slung front-quarter wheel tracking shot looking back at the supercar + towering bridge spires!
      const k = (u - 0.52) / 0.48;
      cameraPos.set(
        heroPos.x + lerp(-4.8, 4.6, smoothstep(0, 1, k)) + shakeX,
        lerp(1.05, 1.9, k) + shakeY,
        heroPos.z - lerp(6.2, 7.8, k)
      );
      cameraLookAt.set(heroPos.x, 1.0, heroPos.z + 2.5);
      cameraFov = 58 + beatPulse * 1.8;
      cameraRoll = lerp(0.055, -0.045, k);
    }
  } else if (t < 44) {
    // ACT IV: HEAT LEVEL FIVE — Police interceptors surging behind + Helicopter searchlight overhead!
    const u = (t - 32) / 12;
    const shakeX = Math.sin(t * 29) * 0.06;
    const shakeY = Math.cos(t * 37) * 0.05;
    if (u < 0.52) {
      // Wide dramatic pursuit shot behind both strobing police cruisers framing the supercar & hovering helicopter!
      const k = u / 0.52;
      cameraPos.set(
        heroPos.x * 0.35 + lerp(-6.5, 5.8, k) + shakeX,
        lerp(4.4, 5.8, k) + shakeY,
        heroPos.z + lerp(26.5, 22.0, k)
      );
      cameraLookAt.set(heroPos.x * 0.5, 3.6, heroPos.z - 6);
      cameraFov = 58 + beatPulse * 1.8;
      cameraRoll = lerp(-0.035, 0.035, k);
    } else {
      // Dramatic low reverse tracking shot alongside supercar looking back at charging red/blue interceptors & chopper!
      const k = (u - 0.52) / 0.48;
      cameraPos.set(
        heroPos.x + lerp(-5.2, 5.2, smoothstep(0, 1, k)) + shakeX,
        lerp(1.85, 3.1, k) + shakeY,
        heroPos.z - lerp(7.2, 8.6, k)
      );
      cameraLookAt.set(heroPos.x * 0.4, 2.8, heroPos.z + 18);
      cameraFov = 60 + beatPulse * 1.8;
      cameraRoll = Math.sin(k * Math.PI) * 0.045;
    }
  } else if (t < 52) {
    // ACT V: NEON OVERDRIVE — Downtown skyscraper canyon blitz + wide hero drift arc!
    const u = (t - 44) / 8;
    const orbitAngle = lerp(-0.45, Math.PI * 0.85, smoothstep(0.05, 0.92, u));
    const radius = lerp(7.8, 9.6, Math.sin(u * Math.PI));
    cameraPos.set(
      heroPos.x + Math.sin(orbitAngle) * radius,
      lerp(1.5, 3.6, Math.sin(u * Math.PI * 0.85)),
      heroPos.z + Math.cos(orbitAngle) * radius
    );
    cameraLookAt.set(heroPos.x, 1.35, heroPos.z - 8);
    cameraFov = 64 + beatPulse * 2.4;
    cameraRoll = Math.sin(u * Math.PI) * -0.075;
  } else {
    // ACT VI: HORIZON FINALE — Majestic crane-up over palm-lined ocean expressway into fiery sunset disc!
    const u = (t - 52) / 8;
    const ease = smoothstep(0, 1, u);
    cameraPos.set(
      lerp(heroPos.x + 2.0, 0.0, ease),
      lerp(2.2, 16.5, Math.pow(ease, 1.2)),
      heroPos.z + lerp(8.5, 58.0, Math.pow(ease, 1.25))
    );
    cameraLookAt.set(-4.0, lerp(1.6, 13.5, ease), heroPos.z - 160);
    cameraFov = lerp(62, 46, ease);
    cameraRoll = 0;
  }

  // Police Interceptors (active during Act IV: 31.5s -> 44.5s)
  const policeActive = pulseWindow(t, 31.5, 32.3, 43.2, 44.5);
  const police1Pos = new THREE.Vector3(
    heroPos.x * 0.55 - 3.6 + Math.sin(t * 2.1) * 0.9,
    0,
    heroPos.z + 11.5 + Math.sin(t * 1.4) * 1.6
  );
  const police2Pos = new THREE.Vector3(
    heroPos.x * 0.45 + 3.8 + Math.cos(t * 1.8) * 0.9,
    0,
    heroPos.z + 16.5 + Math.cos(t * 1.3) * 2.0
  );

  // Police Tactical Helicopter (clearly visible hovering ahead & banking overhead during Act IV)
  const heliActive = pulseWindow(t, 31.8, 32.8, 43.0, 44.4);
  const heliU = clamp((t - 32) / 12, 0, 1);
  const heliPos = new THREE.Vector3(
    lerp(-8.5, 8.5, heliU) + Math.sin(t * 1.1) * 2.5,
    11.4 + Math.sin(t * 1.3) * 1.2,
    heroPos.z - lerp(12, -14, heliU)
  );
  const heliSpotlightPos = new THREE.Vector3(
    heroPos.x + Math.sin(t * 2.4) * 3.2,
    0,
    heroPos.z - 2.0 + Math.cos(t * 1.9) * 3.8
  );

  // Clean cinematic fade-in (0.0 -> 1.1s) & fade-out (58.6 -> 60.0s)
  let globalFade = 1.0;
  if (t < 1.1) globalFade = smoothstep(0, 1.1, t);
  if (t > 58.6) globalFade = 1 - smoothstep(58.6, 60.0, t);

  // Cinematic typography state (shared identically by MP4 render & live player!)
  const openingMainOpacity = pulseWindow(t, 1.4, 2.6, 6.2, 8.0);
  const openingSubOpacity = pulseWindow(t, 2.2, 3.2, 6.0, 7.8);
  const finaleOpacity = pulseWindow(t, 53.2, 54.6, 58.4, 59.8);

  let chapterText = '';
  let chapterSub = '';
  let chapterOpacity = 0;

  if (t >= 10.3 && t < 15.2) {
    chapterText = 'OCEAN DRIVE';
    chapterSub = 'LEONIDA BEACHFRONT · 08:42 PM';
    chapterOpacity = pulseWindow(t, 10.4, 11.1, 13.8, 15.0);
  } else if (t >= 20.3 && t < 25.2) {
    chapterText = 'MIDNIGHT CAUSEWAY';
    chapterSub = 'STARLIGHT BAY EXPRESS · 184 MPH';
    chapterOpacity = pulseWindow(t, 20.4, 21.1, 23.8, 25.0);
  } else if (t >= 32.3 && t < 37.2) {
    chapterText = 'HEAT LEVEL FIVE';
    chapterSub = 'VCPD AIR SUPPORT ENGAGED';
    chapterOpacity = pulseWindow(t, 32.4, 33.1, 35.8, 37.0);
  } else if (t >= 44.3 && t < 49.0) {
    chapterText = 'NEON OVERDRIVE';
    chapterSub = 'DOWNTOWN VICE CORRIDOR';
    chapterOpacity = pulseWindow(t, 44.4, 45.0, 47.6, 48.8);
  }

  const speedMph = Math.round(hero.speed * 3.1 + (t >= 20 && t < 52 ? Math.sin(t * 7) * 4 : 0));
  const wantedStars = t >= 32 && t < 44.5 ? 5 : t >= 44.5 && t < 52 ? 4 : 0;

  return {
    t,
    act,
    nightFactor,
    sunDir,
    cameraPos,
    cameraLookAt,
    cameraFov,
    cameraRoll,
    heroPos,
    heroYaw: hero.yaw,
    heroRoll: hero.roll,
    heroSpeed: hero.speed,
    heroWheelAngle: t * 32,
    exhaustFlame: hero.flame,
    policeActive,
    police1Pos,
    police2Pos,
    heliActive,
    heliPos,
    heliSpotlightPos,
    beatPulse,
    globalFade,
    bloomStrength: t >= 44 && t < 52 ? 0.42 : t >= 20 ? 0.36 : 0.30,
    chromatic: t >= 32 && t < 52 ? 0.0018 : 0.0011,
    overlay: {
      openingMainOpacity,
      openingSubOpacity,
      chapterText,
      chapterSub,
      chapterOpacity,
      finaleOpacity,
      speedMph,
      wantedStars,
    },
  };
}
