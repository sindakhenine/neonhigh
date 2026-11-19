export const CinemaGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uChromatic: { value: 0.0014 },
    uVignette: { value: 0.38 },
    uGrain: { value: 0.022 },
    uBeatPulse: { value: 0.0 },
    uFade: { value: 1.0 },
    uLetterbox: { value: 0.105 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uBeatPulse;
    uniform float uFade;
    uniform float uLetterbox;

    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 acesFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      if (vUv.y < uLetterbox || vUv.y > 1.0 - uLetterbox) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec2 center = vUv - 0.5;
      float dist = length(center);

      // Subtle anamorphic edge chromatic aberration
      float ca = uChromatic * (1.0 + uBeatPulse * 0.65) * (0.35 + dist * 1.5);
      vec2 dir = center * ca;
      float r = texture2D(tDiffuse, vUv + dir).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir).b;
      vec3 col = vec3(r, g, b);

      // Tasteful horizontal anamorphic cyan flare streak ONLY on extreme highlights (>1.15)
      vec3 flare = vec3(0.0);
      for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        vec3 s = texture2D(tDiffuse, vUv + vec2(fi * 0.010, 0.0)).rgb;
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        flare += max(s - vec3(1.12), vec3(0.0)) * smoothstep(1.05, 1.8, lum) * (1.0 - abs(fi) / 5.0);
      }
      col += flare * vec3(0.35, 0.72, 1.0) * 0.032;

      // Crisp high-contrast ACES cinema filmic curve
      col = acesFilm(col * 0.94);

      // Deep rich shadows, vibrant Vice neon saturation
      col = pow(col, vec3(1.06));
      float gray = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(gray), col, 1.22);

      // Soft cinema vignette
      float vig = smoothstep(0.98, 0.22, dist * (1.0 + uVignette));
      col *= mix(1.0 - uVignette, 1.0, vig);

      // Subtle 35mm organic film grain
      float grain = (hash(vUv * 920.0 + fract(uTime * 13.7)) - 0.5) * uGrain;
      col += grain;

      col *= uFade;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
