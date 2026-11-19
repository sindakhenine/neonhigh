import * as THREE from 'three';

export const oceanVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vWaveHeight;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float w1 = sin(wp.x * 0.045 + uTime * 1.15) * cos(wp.z * 0.032 - uTime * 0.85) * 0.28;
    float w2 = sin(wp.x * 0.11 - wp.z * 0.09 + uTime * 1.8) * 0.11;
    wp.y += w1 + w2;
    vWaveHeight = w1 + w2;
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const oceanFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uNightFactor;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;

  varying vec3 vWorldPos;
  varying float vWaveHeight;

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

  float waveField(vec2 p) {
    float v = 0.0;
    v += noise(p * 0.16 + vec2(uTime * 0.42, -uTime * 0.28)) * 0.50;
    v += noise(p * 0.42 + vec2(-uTime * 0.55, uTime * 0.35)) * 0.28;
    v += noise(p * 1.15 + vec2(uTime * 0.85, uTime * 0.65)) * 0.14;
    v += noise(p * 2.60 - vec2(uTime * 1.25, -uTime * 0.90)) * 0.08;
    return v;
  }

  void main() {
    vec2 p = vWorldPos.xz;
    float eps = 0.35;
    float hC = waveField(p);
    float hX = waveField(p + vec2(eps, 0.0));
    float hZ = waveField(p + vec2(0.0, eps));
    vec3 N = normalize(vec3((hC - hX) * 1.15, 1.0, (hC - hZ) * 1.15));

    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 sunDir = normalize(uSunDir);
    vec3 R = reflect(-V, N);

    float ndv = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - ndv, 3.8);
    fresnel = clamp(0.06 + 0.88 * fresnel, 0.0, 0.94);

    // Rich deep midnight-teal tropical Atlantic water
    vec3 deepDay   = vec3(0.015, 0.075, 0.14);
    vec3 deepNight = vec3(0.006, 0.022, 0.065);
    vec3 waterBase = mix(deepDay, deepNight, uNightFactor);

    // Controlled rich sky reflection
    vec3 reflHorizon = mix(vec3(0.78, 0.28, 0.30), vec3(0.45, 0.08, 0.28), uNightFactor);
    vec3 reflMid     = mix(vec3(0.24, 0.07, 0.28), vec3(0.04, 0.02, 0.12), uNightFactor);
    vec3 skyRefl     = mix(reflHorizon, reflMid, smoothstep(0.0, 0.42, max(R.y, 0.0)));

    // Neon shoreline reflections from Ocean Drive & Skyline
    float cityProx = exp(-abs(vWorldPos.x - 16.0) * 0.014);
    float shimmerBand = 0.5 + 0.5 * sin(vWorldPos.z * 0.085 + hC * 6.5);
    vec3 cityNeon = mix(vec3(0.04, 0.78, 0.95), vec3(0.95, 0.14, 0.56), shimmerBand);
    skyRefl += cityNeon * cityProx * (0.24 + 0.32 * uNightFactor) * (0.55 + 0.45 * hC);

    vec3 col = mix(waterBase, skyRefl, fresnel);

    // Crisp shimmering molten sun reflection path
    vec3 H = normalize(sunDir + V);
    float specBroad = pow(max(dot(N, H), 0.0), 55.0);
    float specSharp = pow(max(dot(N, H), 0.0), 340.0);
    vec3 sunCol = mix(vec3(1.0, 0.62, 0.28), vec3(0.95, 0.24, 0.52), uNightFactor * 0.65);
    col += sunCol * (specBroad * 0.36 + specSharp * 1.15);

    // Soft organic coastal shoreline surf foam blending into the beach
    if (vWorldPos.z > -540.0 && vWorldPos.x > -36.0 && vWorldPos.x < -19.0) {
      float shoreLine = -26.5 + sin(vWorldPos.z * 0.045) * 2.2 + sin(vWorldPos.z * 0.11 + uTime * 1.2) * 0.9;
      float shoreDist = abs(vWorldPos.x - shoreLine);
      float foam = smoothstep(3.6, 0.3, shoreDist) * smoothstep(0.30, 0.70, hC);
      col = mix(col, vec3(0.82, 0.74, 0.80), foam * 0.42);
    }

    // Distance atmospheric horizon blend
    float dist = length(vWorldPos.xz - uCameraPos.xz);
    float fogFactor = 1.0 - exp(-pow(dist * 0.00058, 1.8));
    vec3 fogCol = mix(vec3(0.68, 0.24, 0.28), vec3(0.22, 0.05, 0.20), uNightFactor);
    col = mix(col, fogCol, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: oceanVertexShader,
    fragmentShader: oceanFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNightFactor: { value: 0.15 },
      uSunDir: { value: new THREE.Vector3(-0.08, 0.12, -0.99).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
    },
  });
}
