import * as THREE from 'three';

export const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const skyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uNightFactor; // 0.0 = vibrant golden/pink sunset, 1.0 = deep electric neon twilight
  uniform vec3 uSunDir;

  varying vec3 vWorldDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    vec3 sunDir = normalize(uSunDir);
    float y = clamp(dir.y, -0.15, 1.0);
    float up = clamp(dir.y, 0.0, 1.0);

    // Deep high-contrast Miami Sunset vs Electric Midnight Indigo palette
    vec3 dayZenith   = vec3(0.035, 0.045, 0.19);
    vec3 dayMid      = vec3(0.38, 0.09, 0.34);
    vec3 dayHorizon  = vec3(0.88, 0.30, 0.25);
    vec3 dayLowGlow  = vec3(0.96, 0.52, 0.22);

    vec3 nightZenith  = vec3(0.008, 0.010, 0.042);
    vec3 nightMid     = vec3(0.09, 0.025, 0.17);
    vec3 nightHorizon = vec3(0.42, 0.07, 0.28);
    vec3 nightLowGlow = vec3(0.62, 0.14, 0.35);

    vec3 zenith  = mix(dayZenith, nightZenith, uNightFactor);
    vec3 midCol  = mix(dayMid, nightMid, uNightFactor);
    vec3 horizon = mix(dayHorizon, nightHorizon, uNightFactor);
    vec3 lowGlow = mix(dayLowGlow, nightLowGlow, uNightFactor);

    vec3 col = mix(horizon, midCol, smoothstep(0.0, 0.28, up));
    col = mix(col, zenith, smoothstep(0.20, 0.78, up));

    // Controlled warm horizon band
    float hBand = exp(-abs(dir.y) * 12.0);
    col += lowGlow * hBand * mix(0.26, 0.14, uNightFactor);

    // Controlled Mie sun halo (no blowout!)
    float sunDot = max(dot(dir, sunDir), 0.0);
    float sunHalo = pow(sunDot, 16.0) * 0.32 + pow(sunDot, 90.0) * 0.42;
    vec3 sunTint = mix(vec3(1.0, 0.48, 0.22), vec3(0.95, 0.18, 0.48), uNightFactor * 0.8);
    col += sunTint * sunHalo;

    // Iconic crisp retro-cinema sunset sun disc with subtle atmospheric bands
    float sunAngle = acos(clamp(dot(dir, sunDir), -1.0, 1.0));
    float sunRadius = mix(0.095, 0.072, uNightFactor);
    float sunDisc = 1.0 - smoothstep(sunRadius * 0.94, sunRadius * 1.01, sunAngle);

    float sunGrad = clamp((dir.y - (sunDir.y - sunRadius)) / (sunRadius * 2.0), 0.0, 1.0);
    vec3 discCol = mix(vec3(0.98, 0.16, 0.46), vec3(1.0, 0.84, 0.40), smoothstep(0.08, 0.92, sunGrad));
    // Subtle stylized horizon slice slits near the bottom third of the sun
    float slit = 1.0;
    if (sunGrad < 0.44) {
      float band = fract(sunGrad * 14.0);
      float cutWidth = mix(0.45, 0.05, sunGrad / 0.44);
      slit = smoothstep(cutWidth, cutWidth + 0.08, band);
    }
    float horizonCut = smoothstep(-0.005, 0.01, dir.y);
    col = mix(col, discCol * 1.12, sunDisc * horizonCut * mix(0.55, 1.0, slit));

    // Dramatic backlit tropical cumulus clouds
    if (dir.y > 0.01) {
      vec2 cloudUV = dir.xz / (dir.y + 0.18) * 0.82;
      cloudUV += vec2(uTime * 0.012, -uTime * 0.006);
      float c1 = fbm(cloudUV * 1.45);
      float c2 = fbm(cloudUV * 3.1 + vec2(c1 * 1.2, -c1 * 0.8));
      float density = smoothstep(0.46, 0.80, c1 * 0.62 + c2 * 0.46);
      density *= smoothstep(0.01, 0.14, dir.y) * smoothstep(0.85, 0.22, dir.y);

      float rim = pow(sunDot, 5.0) * 0.85 + 0.20;
      vec3 cloudDark = mix(vec3(0.14, 0.05, 0.20), vec3(0.03, 0.015, 0.08), uNightFactor);
      vec3 cloudLit  = mix(vec3(0.95, 0.36, 0.34), vec3(0.75, 0.12, 0.42), uNightFactor);
      vec3 cloudGold = vec3(1.0, 0.72, 0.38);

      float edgeLit = smoothstep(0.46, 0.78, c2) * rim;
      vec3 cloudCol = mix(cloudDark, cloudLit, clamp(rim * 0.78, 0.0, 1.0));
      cloudCol = mix(cloudCol, cloudGold, clamp(edgeLit * pow(sunDot, 2.5), 0.0, 1.0));

      col = mix(col, cloudCol, density * 0.82);
    }

    // Crisp twilight stars at upper zenith
    if (dir.y > 0.14) {
      vec2 starUV = floor(dir.xz / (dir.y + 0.35) * 280.0);
      float s = hash(starUV);
      if (s > 0.996) {
        float twinkle = 0.6 + 0.4 * sin(uTime * 3.2 + s * 200.0);
        float starVis = smoothstep(0.15, 0.50, dir.y) * mix(0.3, 1.0, uNightFactor);
        col += vec3(0.80, 0.90, 1.0) * twinkle * starVis * 0.85;
      }
    }

    if (y < 0.0) {
      col = mix(col, mix(vec3(0.12, 0.04, 0.16), vec3(0.02, 0.01, 0.05), uNightFactor), smoothstep(0.0, -0.08, y));
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNightFactor: { value: 0.15 },
      uSunDir: { value: new THREE.Vector3(-0.08, 0.12, -0.99).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
}
