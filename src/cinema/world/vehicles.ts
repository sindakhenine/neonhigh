import * as THREE from 'three';

export interface HeroCarRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
  exhaustFlames: THREE.Mesh[];
  exhaustLight: THREE.PointLight;
  tailLight: THREE.PointLight;
  headLightLeft: THREE.Mesh;
  headLightRight: THREE.Mesh;
}

export interface PoliceCarRig {
  group: THREE.Group;
  redBar: THREE.Mesh;
  blueBar: THREE.Mesh;
  redLight: THREE.PointLight;
  blueLight: THREE.PointLight;
  wheels: THREE.Group[];
}

export interface HelicopterRig {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Mesh;
  searchBeam: THREE.Mesh;
  beaconLight: THREE.Mesh;
}

export interface TrafficCarRig {
  group: THREE.Group;
  laneX: number;
  baseZ: number;
  speed: number; // negative = heading toward -Z (same dir), positive = oncoming (+Z)
  wheels: THREE.Group[];
}

function createWheel(radius = 0.36, width = 0.28, accentColor = 0xff5a22): THREE.Group {
  const wheel = new THREE.Group();

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    roughness: 0.85,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce8,
    roughness: 0.22,
    metalness: 0.92,
  });
  const caliperMat = new THREE.MeshBasicMaterial({ color: accentColor });

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
  tireGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(tireGeo, tireMat));

  const rimGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width + 0.015, 14);
  rimGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(rimGeo, rimMat));

  // 5 spoke star bars
  const spokeGeo = new THREE.BoxGeometry(width + 0.03, radius * 1.24, 0.045);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i / 5) * Math.PI;
    wheel.add(spoke);
  }

  // Glowing hot brake rotor inner accent
  const discGeo = new THREE.CylinderGeometry(radius * 0.44, radius * 0.44, width - 0.04, 12);
  discGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(discGeo, caliperMat));

  return wheel;
}

export function createHeroSupercar(): HeroCarRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // Sleek metallic cherry-magenta / midnight-berry supercar paint (catches PMREM sunset reflections!)
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b1452,
    emissive: 0x1a041e,
    emissiveIntensity: 0.3,
    metalness: 0.85,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c12,
    roughness: 0.42,
    metalness: 0.65,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070a14,
    metalness: 0.9,
    roughness: 0.05,
    clearcoat: 1.0,
  });

  const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xff123c });
  const neonWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x22f5ff });

  // Sculpted wedge side profile extruded across width (facing -Z)
  const profile = new THREE.Shape();
  profile.moveTo(-2.35, 0.24); // front splitter nose (will map to -Z)
  profile.lineTo(-2.22, 0.56); // nose tip
  profile.lineTo(-1.15, 0.78); // sculpted hood
  profile.lineTo(-0.35, 1.16); // raked windshield
  profile.lineTo(0.68, 1.15);  // fastback roof
  profile.lineTo(1.75, 0.84);  // rear engine deck louvers
  profile.lineTo(2.34, 0.80);  // rear tail top
  profile.lineTo(2.38, 0.34);  // rear diffuser
  profile.lineTo(1.82, 0.22);
  profile.lineTo(-1.82, 0.22);
  profile.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.88,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.09,
    bevelSegments: 3,
  });
  // Center and orient so front nose (-X in shape) faces -Z!
  extrudeGeo.translate(0, 0, -0.94);
  extrudeGeo.rotateY(-Math.PI / 2);

  const chassis = new THREE.Mesh(extrudeGeo, paintMat);
  bodyGroup.add(chassis);

  // Wide flared rear fenders & side aero skirts
  const fenderGeo = new THREE.BoxGeometry(2.14, 0.44, 1.85);
  const rearFenders = new THREE.Mesh(fenderGeo, paintMat);
  rearFenders.position.set(0, 0.56, 1.15);
  bodyGroup.add(rearFenders);

  const frontFenders = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.36, 1.45), paintMat);
  frontFenders.position.set(0, 0.48, -1.35);
  bodyGroup.add(frontFenders);

  // Low carbon-fiber splitter, side skirts, and rear diffuser
  const underTray = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.12, 4.78), carbonMat);
  underTray.position.set(0, 0.22, 0);
  bodyGroup.add(underTray);

  // Recessed dark tinted cabin canopy + windshield
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.44, 1.78), glassMat);
  canopy.position.set(0, 1.01, 0.18);
  bodyGroup.add(canopy);

  // Subtle glowing cyan/magenta cockpit dashboard strip visible through windshield
  const dashGlow = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 0.12), neonCyanMat);
  dashGlow.position.set(0, 0.88, -0.45);
  bodyGroup.add(dashGlow);

  // Iconic Countach/hypercar rear aerodynamic wing
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.06, 0.42), paintMat);
  wingBlade.position.set(0, 1.14, 2.18);
  wingBlade.rotation.x = 0.09;
  bodyGroup.add(wingBlade);

  const endPlateGeo = new THREE.BoxGeometry(0.05, 0.26, 0.48);
  const leftEnd = new THREE.Mesh(endPlateGeo, carbonMat);
  leftEnd.position.set(-1.08, 1.10, 2.18);
  const rightEnd = new THREE.Mesh(endPlateGeo, carbonMat);
  rightEnd.position.set(1.08, 1.10, 2.18);
  const strutGeo = new THREE.BoxGeometry(0.08, 0.34, 0.22);
  const leftStrut = new THREE.Mesh(strutGeo, carbonMat);
  leftStrut.position.set(-0.62, 0.96, 2.14);
  const rightStrut = new THREE.Mesh(strutGeo, carbonMat);
  rightStrut.position.set(0.62, 0.96, 2.14);
  bodyGroup.add(leftEnd, rightEnd, leftStrut, rightStrut);

  // Rear engine deck slatted louvers
  for (let i = 0; i < 4; i++) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.04, 0.16), carbonMat);
    louver.position.set(0, 0.96 - i * 0.04, 1.18 + i * 0.24);
    louver.rotation.x = 0.22;
    bodyGroup.add(louver);
  }

  // Iconic full-width cyber-retro glowing crimson LED taillight bar + quad accents!
  const tailBacking = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.26, 0.08), carbonMat);
  tailBacking.position.set(0, 0.68, 2.41);
  bodyGroup.add(tailBacking);

  const tailBarTop = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.055, 0.06), neonRedMat);
  tailBarTop.position.set(0, 0.74, 2.45);
  const tailBarBot = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.045, 0.06), neonRedMat);
  tailBarBot.position.set(0, 0.62, 2.45);
  bodyGroup.add(tailBarTop, tailBarBot);

  // Subtle cyan underglow neon accent bar beneath side skirts
  const underGlowL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 2.8), neonCyanMat);
  underGlowL.position.set(-1.02, 0.17, 0.05);
  const underGlowR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 2.8), neonCyanMat);
  underGlowR.position.set(1.02, 0.17, 0.05);
  bodyGroup.add(underGlowL, underGlowR);

  // Sleek front carbon air-intake grille & glowing cyan daytime-running splitter accent
  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.16, 0.12), carbonMat);
  frontGrille.position.set(0, 0.36, -2.38);
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.05, 0.24), carbonMat);
  frontLip.position.set(0, 0.22, -2.42);
  const drlBar = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.025, 0.06), neonCyanMat);
  drlBar.position.set(0, 0.44, -2.40);
  bodyGroup.add(frontGrille, frontLip, drlBar);

  // Sharp dual LED headlights
  const headGeo = new THREE.BoxGeometry(0.46, 0.08, 0.1);
  const headL = new THREE.Mesh(headGeo, neonWhiteMat);
  headL.position.set(-0.72, 0.56, -2.38);
  const headR = new THREE.Mesh(headGeo, neonWhiteMat);
  headR.position.set(0.72, 0.56, -2.38);
  bodyGroup.add(headL, headR);

  // Soft gradient-faded volumetric headlight cones (no hard geometric edge!)
  const coneGeo = new THREE.ConeGeometry(1.65, 14.0, 16, 1, true);
  coneGeo.translate(0, -7.0, 0);
  coneGeo.rotateX(Math.PI / 2);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xdaf4ff) },
      uOpacity: { value: 0.085 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // vUv.y = 1 at tip (headlight), 0 at far open base
        float along = smoothstep(0.0, 0.82, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        float edgeSoft = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.35);
        float alpha = along * edgeSoft * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const headLightLeft = new THREE.Mesh(coneGeo, coneMat);
  headLightLeft.position.set(-0.72, 0.52, -2.4);
  const headLightRight = new THREE.Mesh(coneGeo, coneMat);
  headLightRight.position.set(0.72, 0.52, -2.4);
  bodyGroup.add(headLightLeft, headLightRight);

  // Dual Titanium Exhaust Pipes + Animated Turbo Backfire Flames!
  const exhaustFlames: THREE.Mesh[] = [];
  const pipeGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.25, 10);
  pipeGeo.rotateX(Math.PI / 2);
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8892a8, metalness: 0.95, roughness: 0.2 });

  const flameGeo = new THREE.ConeGeometry(0.11, 1.05, 8);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.52);

  for (const ex of [-0.42, 0.42]) {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(ex, 0.34, 2.46);
    bodyGroup.add(pipe);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x38b6ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(ex, 0.34, 2.52);
    bodyGroup.add(flame);
    exhaustFlames.push(flame);
  }

  // Real dynamic taillights & exhaust flash point lights (balanced for crisp bloom)
  const tailLight = new THREE.PointLight(0xff1442, 3.2, 14.0, 1.8);
  tailLight.position.set(0, 0.72, 2.9);
  bodyGroup.add(tailLight);

  const exhaustLight = new THREE.PointLight(0xff6b1a, 0.0, 11.0, 1.8);
  exhaustLight.position.set(0, 0.4, 3.1);
  bodyGroup.add(exhaustLight);

  // 4 detailed spinning wheels
  const wheels: THREE.Group[] = [];
  const wheelCoords: [number, number, number][] = [
    [-1.02, 0.36, -1.45],
    [1.02, 0.36, -1.45],
    [-1.06, 0.38, 1.38],
    [1.06, 0.38, 1.38],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const w = createWheel(wy, wz > 0 ? 0.32 : 0.26, 0xff2e7e);
    w.position.set(wx, wy, wz);
    group.add(w);
    wheels.push(w);
  }

  return {
    group,
    bodyGroup,
    wheels,
    exhaustFlames,
    exhaustLight,
    tailLight,
    headLightLeft,
    headLightRight,
  };
}

export function createPoliceInterceptor(): PoliceCarRig {
  const group = new THREE.Group();

  const blackMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0b10,
    metalness: 0.75,
    roughness: 0.24,
    clearcoat: 0.9,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6ecf5,
    metalness: 0.25,
    roughness: 0.28,
    clearcoat: 0.8,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x080c14, metalness: 0.9, roughness: 0.08 });

  // Lower body
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.56, 4.75), blackMat);
  lower.position.set(0, 0.56, 0);
  group.add(lower);

  // White cruiser doors & roof panel
  const doorStripe = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.44, 1.95), whiteMat);
  doorStripe.position.set(0, 0.58, 0.05);
  group.add(doorStripe);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.52, 2.05), glassMat);
  cabin.position.set(0, 1.06, 0.14);
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.55), whiteMat);
  roof.position.set(0, 1.34, 0.14);
  group.add(roof);

  // Heavy push bumper at front (-Z)
  const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.34, 0.18), blackMat);
  bullBar.position.set(0, 0.48, -2.44);
  group.add(bullBar);

  // Headlights & Taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1633 });
  for (const x of [-0.72, 0.72]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), headMat);
    hl.position.set(x, 0.62, -2.38);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.08), tailMat);
    tl.position.set(x, 0.64, 2.38);
    group.add(tl);
  }

  // Rooftop flashing Red/Blue lightbar!
  const redBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.14, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xff1128 })
  );
  redBar.position.set(-0.34, 1.46, 0.05);
  const blueBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.14, 0.26),
    new THREE.MeshBasicMaterial({ color: 0x0a66ff })
  );
  blueBar.position.set(0.34, 1.46, 0.05);
  group.add(redBar, blueBar);

  const redLight = new THREE.PointLight(0xff1128, 4.5, 22.0, 1.7);
  redLight.position.set(-0.5, 1.8, 0.0);
  const blueLight = new THREE.PointLight(0x0a66ff, 4.5, 22.0, 1.7);
  blueLight.position.set(0.5, 1.8, 0.0);
  group.add(redLight, blueLight);

  const wheels: THREE.Group[] = [];
  for (const [wx, wz] of [
    [-0.98, -1.42],
    [0.98, -1.42],
    [-0.98, 1.42],
    [0.98, 1.42],
  ]) {
    const w = createWheel(0.35, 0.25, 0x38bdf8);
    w.position.set(wx, 0.35, wz);
    group.add(w);
    wheels.push(w);
  }

  return { group, redBar, blueBar, redLight, blueLight, wheels };
}

export function createPoliceHelicopter(): HelicopterRig {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x10131e,
    metalness: 0.72,
    roughness: 0.32,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1628,
    metalness: 0.9,
    roughness: 0.06,
  });

  // Fuselage pod
  const pod = new THREE.Mesh(new THREE.SphereGeometry(1.45, 12, 10), hullMat);
  pod.scale.set(0.95, 0.82, 2.25);
  group.add(pod);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.22, 10, 8), glassMat);
  cockpit.scale.set(0.92, 0.72, 1.35);
  cockpit.position.set(0, 0.12, -1.45);
  group.add(cockpit);

  // Tail boom & vertical stabilizer
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 5.2, 8), hullMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.22, 4.4);
  group.add(boom);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.65, 0.95), hullMat);
  fin.position.set(0, 0.78, 6.8);
  fin.rotation.x = 0.25;
  group.add(fin);

  // Landing skids
  const skidGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6);
  skidGeo.rotateX(Math.PI / 2);
  for (const sx of [-1.15, 1.15]) {
    const skid = new THREE.Mesh(skidGeo, hullMat);
    skid.position.set(sx, -1.45, -0.2);
    group.add(skid);
  }

  // Spinning Main Rotor (4 blades + subtle motion blur disc)
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.48, -0.1);
  const bladeGeo = new THREE.BoxGeometry(0.24, 0.04, 9.6);
  const blade1 = new THREE.Mesh(bladeGeo, hullMat);
  const blade2 = new THREE.Mesh(bladeGeo, hullMat);
  blade2.rotation.y = Math.PI / 2;
  const rotorDisc = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 4.8, 24),
    new THREE.MeshBasicMaterial({
      color: 0xaad4ff,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  rotorDisc.rotation.x = -Math.PI / 2;
  mainRotor.add(blade1, blade2, rotorDisc);
  group.add(mainRotor);

  // Tail Rotor
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.45, 0.16), hullMat);
  tailRotor.position.set(0.22, 0.75, 6.85);
  group.add(tailRotor);

  // Flashing red navigation beacon
  const beaconLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff1a3c })
  );
  beaconLight.position.set(0, 1.7, 6.85);
  group.add(beaconLight);

  // Soft gradient-faded Volumetric Searchlight Beam Cone pointing down from nose
  const beamGeo = new THREE.ConeGeometry(6.8, 38.0, 20, 1, true);
  beamGeo.translate(0, -19.0, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xcff2ff) },
      uOpacity: { value: 0.22 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float along = smoothstep(0.0, 0.85, vUv.y);
        float edgeSoft = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.4);
        gl_FragColor = vec4(uColor, along * edgeSoft * uOpacity);
      }
    `,
  });
  const searchBeam = new THREE.Mesh(beamGeo, beamMat);
  searchBeam.position.set(0, -0.9, -1.8);
  group.add(searchBeam);

  return { group, mainRotor, tailRotor, searchBeam, beaconLight };
}

export function createTrafficCar(colorHex: number, oncoming: boolean): TrafficCarRig {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.75,
    roughness: 0.25,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x090c16, metalness: 0.9, roughness: 0.1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 4.35), bodyMat);
  body.position.y = 0.56;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.45, 1.9), glassMat);
  cabin.position.set(0, 1.0, 0.15);
  group.add(cabin);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1633 });

  for (const x of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.08), headMat);
    hl.position.set(x, 0.58, -2.19);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), tailMat);
    tl.position.set(x, 0.6, 2.19);
    group.add(tl);
  }

  const wheels: THREE.Group[] = [];
  for (const [wx, wz] of [
    [-0.92, -1.32],
    [0.92, -1.32],
    [-0.92, 1.32],
    [0.92, 1.32],
  ]) {
    const w = createWheel(0.33, 0.22, 0x888899);
    w.position.set(wx, 0.33, wz);
    group.add(w);
    wheels.push(w);
  }

  if (oncoming) {
    group.rotation.y = Math.PI;
  }

  return {
    group,
    laneX: 0,
    baseZ: 0,
    speed: 0,
    wheels,
  };
}
