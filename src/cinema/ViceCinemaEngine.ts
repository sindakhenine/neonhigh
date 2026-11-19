import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createSkyMaterial } from './shaders/skyShader';
import { createOceanMaterial } from './shaders/oceanShader';
import { createRoadMaterial } from './shaders/roadShader';
import { CinemaGradeShader } from './shaders/cinemaGradeShader';
import { buildViceCityWorld } from './world/architecture';
import { createCoastalFlock, type BirdAgent, type SwayingPalm } from './world/nature';
import {
  createHeroSupercar,
  createPoliceHelicopter,
  createPoliceInterceptor,
  createTrafficCar,
  type HelicopterRig,
  type HeroCarRig,
  type PoliceCarRig,
  type TrafficCarRig,
} from './world/vehicles';
import { evaluateChoreography, type FrameState } from './director/choreography';

export class ViceCinemaEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  private controls: OrbitControls | null = null;

  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private oceanMat: THREE.ShaderMaterial;
  private roadMat: THREE.ShaderMaterial;
  private fog: THREE.FogExp2;
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private heroCar: HeroCarRig;
  private police1: PoliceCarRig;
  private police2: PoliceCarRig;
  private heli: HelicopterRig;
  private traffic: TrafficCarRig[] = [];
  private palms: SwayingPalm[] = [];
  private beacons: THREE.Mesh[] = [];
  private birds: BirdAgent[] = [];
  private speedParticles: THREE.Points;

  public freeCamera = false;
  private currentFrameState: FrameState;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio = 1) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.NoToneMapping; // Handled in CinemaGradeShader

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x3a153a, 0.00095);
    this.scene.fog = this.fog;

    // Procedural Sunset & Neon PMREM Environment Map so metallic cars & glass catch realistic reflections!
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x140822);
    const stripWarm = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8a47, side: THREE.DoubleSide })
    );
    stripWarm.position.set(0, 6, -12);
    const stripPink = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 5),
      new THREE.MeshBasicMaterial({ color: 0xff2b93, side: THREE.DoubleSide })
    );
    stripPink.position.set(12, 4, 0);
    stripPink.rotation.y = -Math.PI / 2;
    const stripCyan = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 5),
      new THREE.MeshBasicMaterial({ color: 0x22f5ff, side: THREE.DoubleSide })
    );
    stripCyan.position.set(-12, 4, 0);
    stripCyan.rotation.y = Math.PI / 2;
    envScene.add(stripWarm, stripPink, stripCyan);
    const envRT = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = envRT.texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.25, 3600);

    // Lighting rig: warm Miami sunset key + electric cyan fill + indigo hemisphere
    this.hemiLight = new THREE.HemisphereLight(0xff94c8, 0x1a1436, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xff844b, 1.85);
    this.sunLight.position.set(-80, 65, -450);
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x28e8ff, 1.15);
    this.rimLight.position.set(90, 40, 220);
    this.scene.add(this.rimLight);

    // 1. Atmospheric Sunset Sky Dome
    this.skyMat = createSkyMaterial();
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 24), this.skyMat);
    this.scene.add(this.skyMesh);

    // 2. Reflective Animated Atlantic Ocean
    this.oceanMat = createOceanMaterial();
    const oceanGeo = new THREE.PlaneGeometry(3600, 4000, 96, 120);
    oceanGeo.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    ocean.position.set(0, -1.25, -1350);
    this.scene.add(ocean);

    // 3. Wet Neon Boulevard & Causeway Highway (extended to z = -2580 for Act VI ocean sunset!)
    this.roadMat = createRoadMaterial();
    const roadGeo = new THREE.PlaneGeometry(23.0, 2760, 1, 1);
    roadGeo.rotateX(-Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, this.roadMat);
    road.position.set(0, 0.02, -1200);
    this.scene.add(road);

    // 4. Entire Vice City / Leonida Architectural Corridor
    const city = buildViceCityWorld();
    this.scene.add(city.group);
    this.palms = city.palms;
    this.beacons = city.aviationBeacons;

    // 5. Flock of Coastal Flamingos / Birds (Act I)
    const flock = createCoastalFlock(16);
    this.scene.add(flock.group);
    this.birds = flock.birds;

    // 6. Hero Supercar
    this.heroCar = createHeroSupercar();
    this.scene.add(this.heroCar.group);

    // 7. Pursuit Police Interceptors (Act IV)
    this.police1 = createPoliceInterceptor();
    this.police2 = createPoliceInterceptor();
    this.scene.add(this.police1.group, this.police2.group);

    // 8. Tactical Helicopter with Sweeping Volumetric Searchlight (Act IV)
    this.heli = createPoliceHelicopter();
    this.scene.add(this.heli.group);

    // 9. Ambient Traffic Vehicles along highway
    const trafficPalette = [0x1c2842, 0x8a2248, 0x16383b, 0x5c3e1e, 0x2a1c44, 0x883b28];
    const trafficDefs = [
      { lane: -8.2, z: -320, speed: 26, on: true },
      { lane: -3.2, z: -680, speed: 24, on: true },
      { lane: -8.2, z: -980, speed: 28, on: true },
      { lane: -3.2, z: -1320, speed: 25, on: true },
      { lane: -8.2, z: -1680, speed: 27, on: true },
      { lane: -3.2, z: -2020, speed: 24, on: true },
      { lane: 8.2, z: -380, speed: -22, on: false },
      { lane: 8.2, z: -760, speed: -26, on: false },
      { lane: 8.2, z: -1240, speed: -24, on: false },
      { lane: 8.2, z: -1750, speed: -25, on: false },
    ];
    trafficDefs.forEach((def, idx) => {
      const car = createTrafficCar(trafficPalette[idx % trafficPalette.length], def.on);
      car.laneX = def.lane;
      car.baseZ = def.z;
      car.speed = def.speed;
      this.scene.add(car.group);
      this.traffic.push(car);
    });

    // 10. Atmospheric Neon Dust & High-Speed Coastal Mist Particles
    const pCount = 420;
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    const cPink = new THREE.Color(0xff42a5);
    const cCyan = new THREE.Color(0x22f5ff);
    const cGold = new THREE.Color(0xffc978);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3 + 0] = (Math.sin(i * 12.9898) * 0.5) * 44;
      pPos[i * 3 + 1] = 0.6 + ((i * 17.3) % 14);
      pPos[i * 3 + 2] = -((i * 5.7) % 2300);
      const c = i % 3 === 0 ? cPink : i % 3 === 1 ? cCyan : cGold;
      pCol[i * 3 + 0] = c.r;
      pCol[i * 3 + 1] = c.g;
      pCol[i * 3 + 2] = c.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedParticles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.speedParticles);

    // Post-processing pipeline: RenderPass -> UnrealBloomPass -> CinemaGradeShader
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.34, 0.42, 0.78);
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(CinemaGradeShader);
    this.composer.addPass(this.gradePass);

    this.currentFrameState = evaluateChoreography(0);
  }

  public enableOrbitControls(domElement: HTMLElement) {
    if (this.controls) return;
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 140;
  }

  public setFreeCamera(enabled: boolean) {
    this.freeCamera = enabled;
    if (this.controls) {
      this.controls.enabled = enabled;
      if (enabled) {
        this.controls.target.copy(this.currentFrameState.heroPos).add(new THREE.Vector3(0, 1.2, 0));
        this.controls.update();
      }
    }
  }

  public setLetterbox(enabled: boolean) {
    this.gradePass.uniforms.uLetterbox.value = enabled ? 0.105 : 0.0;
  }

  public resize(width: number, height: number, pixelRatio = Math.min(window.devicePixelRatio || 1, 2)) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public renderAt(timeSec: number): FrameState {
    const state = evaluateChoreography(timeSec);
    this.currentFrameState = state;
    const t = state.t;

    // Update sky dome centered on camera so horizon is infinitely distant
    this.skyMat.uniforms.uTime.value = t;
    this.skyMat.uniforms.uNightFactor.value = state.nightFactor;
    this.skyMat.uniforms.uSunDir.value.copy(state.sunDir);

    // Update fog color to blend smoothly with sky horizon
    const dayFog = new THREE.Color(0x6e2845);
    const nightFog = new THREE.Color(0x180724);
    this.fog.color.copy(dayFog).lerp(nightFog, state.nightFactor);
    this.fog.density = 0.00072 + state.nightFactor * 0.00028;

    // Update lighting warmth
    this.sunLight.intensity = 1.95 - state.nightFactor * 1.05;
    this.rimLight.intensity = 1.05 + state.nightFactor * 0.65;
    this.hemiLight.intensity = 0.92 - state.nightFactor * 0.30;

    // Update Hero Supercar
    this.heroCar.group.position.copy(state.heroPos);
    this.heroCar.group.rotation.y = state.heroYaw;
    this.heroCar.bodyGroup.rotation.z = state.heroRoll;
    this.heroCar.bodyGroup.position.y = Math.sin(t * 16) * 0.015;
    for (const w of this.heroCar.wheels) {
      w.rotation.x = -state.heroWheelAngle;
    }

    // Animated blue-to-orange turbo exhaust flames
    const flameIntensity = state.exhaustFlame;
    this.heroCar.exhaustLight.intensity = flameIntensity * 5.2;
    for (let i = 0; i < this.heroCar.exhaustFlames.length; i++) {
      const f = this.heroCar.exhaustFlames[i];
      const mat = f.material as THREE.MeshBasicMaterial;
      if (flameIntensity > 0.03) {
        const flicker = 0.75 + 0.5 * Math.sin(t * 75 + i * 2.1);
        f.visible = true;
        f.scale.set(0.85 + flameIntensity * 0.35, 0.85 + flameIntensity * 0.35, (0.4 + flameIntensity * 1.45) * flicker);
        mat.opacity = Math.min(0.95, flameIntensity * 0.95);
        mat.color.setHex(flicker > 1.0 ? 0xff7c24 : 0x38b6ff);
      } else {
        f.visible = false;
      }
    }

    // Update Police Interceptors & alternating Red/Blue strobes
    const showPolice = state.policeActive > 0.02;
    this.police1.group.visible = showPolice;
    this.police2.group.visible = showPolice;
    if (showPolice) {
      this.police1.group.position.copy(state.police1Pos);
      this.police2.group.position.copy(state.police2Pos);

      const strobeA = Math.sin(t * 22.0) > 0;
      const intensity = 5.4 * state.policeActive;

      this.police1.redLight.intensity = strobeA ? intensity : 0.25;
      this.police1.blueLight.intensity = !strobeA ? intensity : 0.25;
      (this.police1.redBar.material as THREE.MeshBasicMaterial).color.setHex(strobeA ? 0xff1128 : 0x3a050c);
      (this.police1.blueBar.material as THREE.MeshBasicMaterial).color.setHex(!strobeA ? 0x0a66ff : 0x04143a);

      this.police2.redLight.intensity = !strobeA ? intensity : 0.25;
      this.police2.blueLight.intensity = strobeA ? intensity : 0.25;
      (this.police2.redBar.material as THREE.MeshBasicMaterial).color.setHex(!strobeA ? 0xff1128 : 0x3a050c);
      (this.police2.blueBar.material as THREE.MeshBasicMaterial).color.setHex(strobeA ? 0x0a66ff : 0x04143a);

      for (const w of this.police1.wheels) w.rotation.x = -t * 30;
      for (const w of this.police2.wheels) w.rotation.x = -t * 30;
    }

    // Update Helicopter & Sweeping Volumetric Searchlight
    const showHeli = state.heliActive > 0.02;
    this.heli.group.visible = showHeli;
    if (showHeli) {
      this.heli.group.position.copy(state.heliPos);
      this.heli.group.rotation.z = Math.sin(t * 0.9) * 0.16;
      this.heli.group.rotation.x = 0.14;
      this.heli.mainRotor.rotation.y = t * 28.0;
      this.heli.tailRotor.rotation.x = t * 44.0;
      this.heli.beaconLight.visible = Math.sin(t * 10.0) > 0.2;

      // Aim volumetric searchlight cone directly at moving ground spotlight pool!
      const beamWorldOrigin = new THREE.Vector3(0, -0.9, -1.8).applyMatrix4(this.heli.group.matrixWorld);
      const toTarget = state.heliSpotlightPos.clone().sub(beamWorldOrigin).normalize();
      const localDown = new THREE.Vector3(0, -1, 0);
      this.heli.searchBeam.quaternion.setFromUnitVectors(localDown, toTarget);
      const beamMat = this.heli.searchBeam.material as THREE.ShaderMaterial;
      if (beamMat.uniforms?.uOpacity) {
        beamMat.uniforms.uOpacity.value = 0.24 * state.heliActive;
      }
    }

    // Update Traffic Vehicles smoothly along highway
    for (const car of this.traffic) {
      let cz = car.baseZ + car.speed * t;
      // Wrap smoothly within highway bounds so traffic always populates the scene
      if (cz > 120) cz -= 2300;
      if (cz < -2250) cz += 2300;
      car.group.position.set(car.laneX, 0, cz);
      for (const w of car.wheels) {
        w.rotation.x = -t * 20;
      }
    }

    // Update swaying tropical palm crowns
    for (const palm of this.palms) {
      palm.crown.rotation.z = Math.sin(t * 1.45 + palm.phase) * 0.065;
      palm.crown.rotation.x = Math.cos(t * 1.15 + palm.phase) * 0.045;
    }

    // Update coastal bird flock gliding across golden sunset in Act I
    for (const bird of this.birds) {
      bird.group.position.set(
        bird.basePos.x + t * 3.8,
        bird.basePos.y + Math.sin(t * 1.8 + bird.phase) * 0.85,
        bird.basePos.z - t * bird.speed * 0.72
      );
      const flap = Math.sin(t * 7.5 + bird.phase) * 0.58;
      bird.leftWing.rotation.z = flap;
      bird.rightWing.rotation.z = -flap;
    }

    // Blink skyscraper aviation beacons
    const blinkOn = Math.sin(t * 3.8) > 0.35;
    for (let i = 0; i < this.beacons.length; i++) {
      this.beacons[i].visible = (i % 2 === 0) ? blinkOn : !blinkOn;
    }

    // Camera update (Director choreography vs Interactive Free Orbit)
    if (!this.freeCamera) {
      this.camera.position.copy(state.cameraPos);
      this.camera.fov = state.cameraFov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(state.cameraLookAt);
      if (Math.abs(state.cameraRoll) > 0.0001) {
        this.camera.rotateZ(state.cameraRoll);
      }
    } else if (this.controls) {
      this.controls.update();
    }

    // Keep sky dome locked around camera
    this.skyMesh.position.copy(this.camera.position);

    // Update ocean & wet-asphalt reflection uniforms
    this.oceanMat.uniforms.uTime.value = t;
    this.oceanMat.uniforms.uNightFactor.value = state.nightFactor;
    this.oceanMat.uniforms.uSunDir.value.copy(state.sunDir);
    this.oceanMat.uniforms.uCameraPos.value.copy(this.camera.position);

    this.roadMat.uniforms.uTime.value = t;
    this.roadMat.uniforms.uNightFactor.value = state.nightFactor;
    this.roadMat.uniforms.uCameraPos.value.copy(this.camera.position);
    this.roadMat.uniforms.uHeroPos.value.copy(state.heroPos);
    this.roadMat.uniforms.uHeroSpeed.value = state.heroSpeed;
    this.roadMat.uniforms.uPolice1Pos.value.copy(state.police1Pos);
    this.roadMat.uniforms.uPolice2Pos.value.copy(state.police2Pos);
    this.roadMat.uniforms.uPoliceActive.value = state.policeActive;
    this.roadMat.uniforms.uSpotlightPos.value.copy(state.heliSpotlightPos);
    this.roadMat.uniforms.uSpotlightActive.value = state.heliActive;

    // Post-processing Cinema Grade & Bloom
    this.bloomPass.strength = state.bloomStrength + state.beatPulse * 0.14;
    this.gradePass.uniforms.uTime.value = t;
    this.gradePass.uniforms.uBeatPulse.value = state.beatPulse;
    this.gradePass.uniforms.uChromatic.value = state.chromatic;
    this.gradePass.uniforms.uFade.value = state.globalFade;

    this.composer.render();
    return state;
  }

  public dispose() {
    this.controls?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
