import * as THREE from 'three';

export const roadVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const roadFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uNightFactor;
  uniform vec3 uCameraPos;
  uniform vec3 uHeroPos;
  uniform float uHeroSpeed;
  uniform vec3 uPolice1Pos;
  uniform vec3 uPolice2Pos;
  uniform float uPoliceActive;
  uniform vec3 uSpotlightPos;
  uniform float uSpotlightActive;

  varying vec3 vWorldPos;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    v += noise(p) * 0.55;
    v += noise(p * 2.13 + vec2(4.2, 1.9)) * 0.30;
    v += noise(p * 4.41 + vec2(1.3, 7.7)) * 0.15;
    return v;
  }

  void main() {
    float x = vWorldPos.x;
    float z = vWorldPos.z;

    // Fine wet asphalt micro-texture & sleek coastal rain puddles
    float microGrain = noise(vec2(x * 8.0, z * 8.0));
    float puddleNoise = fbm(vec2(x * 0.22, z * 0.05));
    float wetness = smoothstep(0.35, 0.68, puddleNoise);

    // Deep obsidian wet asphalt for dramatic high-contrast neon reflections
    vec3 dryCol = vec3(0.028, 0.028, 0.040) * (0.82 + 0.36 * microGrain);
    vec3 wetCol = vec3(0.010, 0.012, 0.022);
    vec3 col = mix(dryCol, wetCol, wetness);

    // Subtle tire wear tracks
    float laneDist = min(abs(abs(x) - 3.2), abs(abs(x) - 8.2));
    float wear = exp(-laneDist * laneDist * 0.38);
    col *= (1.0 - wear * 0.18);

    // Crisp painted highway lane markings
    float centerDouble = (smoothstep(0.14, 0.06, abs(x - 0.22)) + smoothstep(0.14, 0.06, abs(x + 0.22)));
    float dash = smoothstep(0.44, 0.52, fract(z * 0.075)) * (1.0 - smoothstep(0.86, 0.94, fract(z * 0.075)));
    float laneLines = (smoothstep(0.12, 0.05, abs(x - 5.6)) + smoothstep(0.12, 0.05, abs(x + 5.6))) * dash;
    float shoulder = smoothstep(0.16, 0.07, abs(abs(x) - 10.8));

    vec3 amberPaint = vec3(0.86, 0.54, 0.12) * (0.58 + 0.32 * (1.0 - wetness * 0.4));
    vec3 whitePaint = vec3(0.72, 0.76, 0.86) * (0.52 + 0.30 * (1.0 - wetness * 0.4));

    col = mix(col, amberPaint, clamp(centerDouble, 0.0, 1.0) * 0.78);
    col = mix(col, whitePaint, clamp(laneLines + shoulder, 0.0, 1.0) * 0.64);

    // Crisp cat's-eye road reflectors every 24m
    float studZ = abs(fract(z / 24.0 + 0.5) - 0.5) * 24.0;
    float studCenter = exp(-studZ * studZ * 4.5) * exp(-x * x * 16.0);
    float studSide = exp(-studZ * studZ * 4.5) * exp(-pow(abs(x) - 10.8, 2.0) * 16.0);
    col += vec3(1.0, 0.65, 0.18) * studCenter * 0.9;
    col += vec3(0.12, 0.92, 1.0) * studSide * 0.8;

    vec3 V = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - max(V.y, 0.0), 2.8);
    float reflStrength = mix(0.18, 0.82, wetness) * (0.30 + 0.70 * fresnel);

    // 1) Sunset sky ribbon reflection down wet road center
    vec3 skyRefl = mix(vec3(0.68, 0.22, 0.30), vec3(0.18, 0.05, 0.22), uNightFactor);
    float centerGlow = exp(-x * x * 0.01);
    col += skyRefl * reflStrength * centerGlow * mix(0.32, 0.16, uNightFactor);

    // 2) Saturated elongated neon reflections from hotels, bridge pylons & skyscraper canyon
    float lampPhase = fract(z / 26.0);
    float lampStreak = exp(-pow((lampPhase - 0.5) * 3.5, 2.0));
    float sideNeonR = smoothstep(-2.0, 11.5, x);
    float sideNeonL = smoothstep(2.0, -11.5, x);

    float zoneColor = sin(floor(z / 26.0) * 1.7);
    vec3 neonRight = zoneColor > 0.0 ? vec3(0.96, 0.12, 0.56) : vec3(0.06, 0.86, 1.0);
    vec3 neonLeft  = (z < -1180.0 && z > -1960.0)
      ? (zoneColor > 0.0 ? vec3(0.06, 0.86, 1.0) : vec3(0.96, 0.18, 0.62))
      : vec3(0.95, 0.50, 0.18);

    float ripple = 0.74 + 0.26 * sin(z * 1.8 + microGrain * 5.0);
    col += neonRight * sideNeonR * (0.30 + 0.70 * lampStreak) * reflStrength * ripple * (0.28 + 0.36 * uNightFactor);
    col += neonLeft  * sideNeonL * (0.30 + 0.70 * lampStreak) * reflStrength * ripple * (0.22 + 0.28 * uNightFactor);

    // 3) Hero Supercar twin crimson taillight reflection streaking on wet asphalt + crisp headlight pool
    vec2 dHero = vWorldPos.xz - uHeroPos.xz;
    if (dHero.y > 1.3 && dHero.y < 42.0) {
      float tailTwin = exp(-pow(abs(dHero.x) - 0.72, 2.0) * 2.2) + exp(-dHero.x * dHero.x * 0.75) * 0.38;
      float tailZ = exp(-(dHero.y - 1.5) * 0.095);
      col += vec3(1.0, 0.05, 0.20) * tailTwin * tailZ * (0.35 + 0.65 * wetness) * 0.88;
    }
    if (dHero.y < -1.5 && dHero.y > -42.0) {
      float fwd = -dHero.y;
      float spread = 1.2 + fwd * 0.10;
      float beamX = exp(-(dHero.x * dHero.x) / (spread * spread));
      float beamZ = smoothstep(42.0, 4.0, fwd) * smoothstep(1.3, 4.0, fwd);
      col += vec3(0.86, 0.94, 1.0) * beamX * beamZ * (0.24 + 0.16 * wetness);
    }

    // 4) Saturated alternating Red & Blue Police Interceptor reflections (zero whiteout!)
    if (uPoliceActive > 0.01) {
      float strobe = sin(uTime * 22.0);
      vec3 pCol1 = strobe > 0.0 ? vec3(1.0, 0.04, 0.10) : vec3(0.04, 0.34, 1.0);
      vec3 pCol2 = strobe < 0.0 ? vec3(1.0, 0.04, 0.10) : vec3(0.04, 0.34, 1.0);

      vec2 dp1 = vWorldPos.xz - uPolice1Pos.xz;
      float g1 = exp(-dot(dp1, dp1) * 0.014);
      vec2 dp2 = vWorldPos.xz - uPolice2Pos.xz;
      float g2 = exp(-dot(dp2, dp2) * 0.014);

      col += (pCol1 * g1 + pCol2 * g2) * uPoliceActive * (0.40 + 0.60 * wetness) * 0.72;
    }

    // 5) Crisp Helicopter sweeping spotlight pool on dark wet road
    if (uSpotlightActive > 0.01) {
      vec2 ds = vWorldPos.xz - uSpotlightPos.xz;
      float spot = exp(-dot(ds, ds) * 0.032);
      col += vec3(0.76, 0.92, 1.0) * spot * uSpotlightActive * 0.56;
    }

    // Seamless horizon atmospheric fade
    float dist = length(vWorldPos.xz - uCameraPos.xz);
    float fogFactor = 1.0 - exp(-pow(dist * 0.0009, 1.75));
    vec3 fogCol = mix(vec3(0.58, 0.20, 0.28), vec3(0.15, 0.04, 0.18), uNightFactor);
    col = mix(col, fogCol, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createRoadMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: roadVertexShader,
    fragmentShader: roadFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNightFactor: { value: 0.15 },
      uCameraPos: { value: new THREE.Vector3() },
      uHeroPos: { value: new THREE.Vector3(2.8, 0, -40) },
      uHeroSpeed: { value: 0 },
      uPolice1Pos: { value: new THREE.Vector3(-3, 0, 100) },
      uPolice2Pos: { value: new THREE.Vector3(4, 0, 100) },
      uPoliceActive: { value: 0 },
      uSpotlightPos: { value: new THREE.Vector3(0, 0, -1000) },
      uSpotlightActive: { value: 0 },
    },
  });
}
