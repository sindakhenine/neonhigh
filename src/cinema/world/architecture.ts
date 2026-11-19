import * as THREE from 'three';
import {
  createArtDecoWindowTexture,
  createNeonSignTexture,
  createSkyscraperWindowTexture,
} from './textures';
import { createPalmTree, type SwayingPalm } from './nature';

export interface CityBuildResult {
  group: THREE.Group;
  palms: SwayingPalm[];
  aviationBeacons: THREE.Mesh[];
}

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildViceCityWorld(): CityBuildResult {
  const group = new THREE.Group();
  const palms: SwayingPalm[] = [];
  const aviationBeacons: THREE.Mesh[] = [];
  const rand = seededRandom(19862026);

  // Shared materials
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x1d1c28,
    roughness: 0.82,
    metalness: 0.15,
  });
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0x452d36,
    roughness: 0.96,
    metalness: 0.02,
  });
  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x262938,
    roughness: 0.38,
    metalness: 0.8,
  });
  const warmLampMat = new THREE.MeshBasicMaterial({ color: 0xffbd6b });
  const cyanLampMat = new THREE.MeshBasicMaterial({ color: 0x24f2ff });
  const pinkLampMat = new THREE.MeshBasicMaterial({ color: 0xff2b93 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff173b });

  // =========================================================================
  // 1. SIDEWALKS, CURBS & BEACHFRONT (Continuous along entire boulevard)
  // =========================================================================
  // Curbs spanning entire 2.65 km expressway
  const curbGeo = new THREE.BoxGeometry(1.1, 0.55, 2760);
  const leftCurb = new THREE.Mesh(curbGeo, concreteMat);
  leftCurb.position.set(-12.05, 0.25, -1200);
  const rightCurb = new THREE.Mesh(curbGeo, concreteMat);
  rightCurb.position.set(12.05, 0.25, -1200);
  group.add(leftCurb, rightCurb);

  // Zone A Beach & Boardwalk (z from +140 to -540)
  const rightSidewalkA = new THREE.Mesh(new THREE.BoxGeometry(28, 0.38, 700), concreteMat);
  rightSidewalkA.position.set(26, 0.18, -200);
  group.add(rightSidewalkA);

  const boardwalkA = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.34, 700), concreteMat);
  boardwalkA.position.set(-16.2, 0.16, -200);
  group.add(boardwalkA);

  // Gently sloped beach dipping smoothly beneath the animated wave surface
  const beachSand = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 700), sandMat);
  beachSand.position.set(-24.2, -0.78, -200);
  beachSand.rotation.z = 0.088;
  group.add(beachSand);

  // Zone C Downtown Ground Decks (z from -1160 to -1940 — then opens back out onto ocean for Act VI!)
  const leftGroundC = new THREE.Mesh(new THREE.BoxGeometry(140, 0.5, 790), concreteMat);
  leftGroundC.position.set(-82, 0.1, -1555);
  const rightGroundC = new THREE.Mesh(new THREE.BoxGeometry(140, 0.5, 790), concreteMat);
  rightGroundC.position.set(82, 0.1, -1555);
  group.add(leftGroundC, rightGroundC);

  // =========================================================================
  // 2. ZONE A (z = +100 to -520): OCEAN DRIVE ART DECO STRIP + PALM COAST
  // =========================================================================
  const hotelConfigs = [
    { name: 'OCEAN VIEW', sub: 'ART DECO RESORT', wall: '#d697a8', p: '#ff2b93', s: '#22f5ff' },
    { name: 'STARLIGHT', sub: 'ROOFTOP LOUNGE', wall: '#8fbec2', p: '#22f5ff', s: '#ff8a3d' },
    { name: 'MALIBU CLUB', sub: 'EST. 1986 • VICE', wall: '#c797c7', p: '#ff42b0', s: '#ffd24c' },
    { name: 'PALM ROYALE', sub: 'BEACHFRONT SUITES', wall: '#d9b08c', p: '#ff7b33', s: '#22f5ff' },
    { name: 'SUNSET PLAZA', sub: 'CASINO & GRILL', wall: '#a2a0d4', p: '#ff2a85', s: '#4efcff' },
    { name: 'VICE HOTEL', sub: 'LEONIDA BAY', wall: '#91c2b8', p: '#2ef5ff', s: '#ff2b93' },
  ];

  for (let i = 0; i < 20; i++) {
    const zPos = 85 - i * 31;
    const cfg = hotelConfigs[i % hotelConfigs.length];
    const hWidth = 18 + rand() * 6;
    const hHeight = 14 + rand() * 11;
    const hDepth = 24 + rand() * 3.5;

    const { map, emissiveMap } = createArtDecoWindowTexture(i + 1, cfg.wall, cfg.p);
    const hotelMat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.92,
      roughness: 0.52,
      metalness: 0.18,
    });

    const hotelGroup = new THREE.Group();
    hotelGroup.position.set(17.5 + hWidth * 0.5, 0, zPos);

    const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(hWidth, hHeight, hDepth), hotelMat);
    mainBlock.position.y = hHeight * 0.5;
    hotelGroup.add(mainBlock);

    // Classic Miami Art Deco stepped rooftop crown
    const stepBlock = new THREE.Mesh(
      new THREE.BoxGeometry(hWidth * 0.68, 3.2, hDepth * 0.52),
      hotelMat
    );
    stepBlock.position.set(-hWidth * 0.12, hHeight + 1.6, 0);
    hotelGroup.add(stepBlock);

    // Glowing horizontal neon cornice ribbon facing Ocean Drive (-X)
    const neonCol = new THREE.Color(cfg.p);
    const neonMat = new THREE.MeshBasicMaterial({ color: neonCol });
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, hDepth + 0.4), neonMat);
    cornice.position.set(-hWidth * 0.5 - 0.15, hHeight - 0.3, 0);
    hotelGroup.add(cornice);

    // Vertical neon fin blade on building front
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, hHeight * 0.85, 0.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.s) })
    );
    fin.position.set(-hWidth * 0.5 - 0.4, hHeight * 0.52, -hDepth * 0.32);
    hotelGroup.add(fin);

    // Glowing Canvas Neon Sign facing street & oncoming camera
    const signTex = createNeonSignTexture(cfg.name, cfg.sub, cfg.p, cfg.s);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 4.6), signMat);
    signMesh.position.set(-hWidth * 0.5 - 0.45, hHeight + 3.4, 0);
    signMesh.rotation.y = -Math.PI / 2;
    hotelGroup.add(signMesh);

    // Protruding double-sided marquee sign angled toward oncoming viewer (+Z)
    if (i % 2 === 0) {
      const marquee = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.5, 0.35), [
        neonMat,
        neonMat,
        neonMat,
        neonMat,
        signMat,
        signMat,
      ]);
      marquee.position.set(-hWidth * 0.5 - 2.9, 6.8, hDepth * 0.25);
      hotelGroup.add(marquee);
    }

    group.add(hotelGroup);
  }

  // Towering Miami Skyline behind Zone A hotels (x = 65 to 170)
  const skyTexPool = [
    createSkyscraperWindowTexture(11, '#22f5ff', '#ff2b93'),
    createSkyscraperWindowTexture(23, '#ff8a3d', '#ff2b93'),
    createSkyscraperWindowTexture(37, '#38e8ff', '#ffe082'),
    createSkyscraperWindowTexture(53, '#ff47a8', '#52d6ff'),
  ];

  for (let i = 0; i < 34; i++) {
    const zPos = 60 - i * 24 + (rand() - 0.5) * 14;
    const xPos = 62 + (i % 3) * 34 + rand() * 18;
    const bw = 18 + rand() * 18;
    const bd = 18 + rand() * 18;
    const bh = 48 + rand() * 98;

    const texSet = skyTexPool[i % skyTexPool.length];
    const towerMat = new THREE.MeshStandardMaterial({
      map: texSet.map,
      emissiveMap: texSet.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.05,
      roughness: 0.22,
      metalness: 0.78,
    });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), towerMat);
    tower.position.set(xPos, bh * 0.5, zPos);
    group.add(tower);

    // Rooftop neon crown frame
    const crownColor = i % 2 === 0 ? 0x22f5ff : 0xff2b93;
    const crownRing = new THREE.Mesh(
      new THREE.BoxGeometry(bw + 0.5, 0.7, bd + 0.5),
      new THREE.MeshBasicMaterial({ color: crownColor })
    );
    crownRing.position.set(xPos, bh + 0.35, zPos);
    group.add(crownRing);

    // Spire + aviation blinking red beacon
    if (bh > 88) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.65, 18, 6), lampPoleMat);
      spire.position.set(xPos, bh + 9, zPos);
      group.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), beaconMat);
      beacon.position.set(xPos, bh + 18.2, zPos);
      group.add(beacon);
      aviationBeacons.push(beacon);
    }
  }

  // Lush Curved Palm Trees lining both sides of Ocean Drive & Beach (Zone A)
  for (let z = 90; z >= -520; z -= 21) {
    // Beachside palms (left)
    const pLeft = createPalmTree(
      11.5 + rand() * 4.5,
      -1.8 - rand() * 1.6,
      (rand() - 0.5) * 1.4,
      z * 0.1
    );
    pLeft.group.position.set(-15.2 - rand() * 4.2, 0.1, z);
    group.add(pLeft.group);
    palms.push(pLeft.sway);

    // Second staggered beach palm closer to surf for rich silhouette depth
    if (Math.abs(z) % 42 < 21) {
      const pBeach = createPalmTree(
        10.0 + rand() * 4.0,
        -2.2 - rand() * 1.5,
        (rand() - 0.5) * 1.5,
        z * 0.17 + 2
      );
      pBeach.group.position.set(-22.0 - rand() * 2.5, -0.1, z - 8);
      group.add(pBeach.group);
      palms.push(pBeach.sway);
    }

    // Hotel-side palms (right)
    const pRight = createPalmTree(
      11.0 + rand() * 3.8,
      -1.2 - rand() * 1.1,
      (rand() - 0.5) * 1.2,
      z * 0.13 + 5
    );
    pRight.group.position.set(14.5 + rand() * 1.4, 0.2, z - 10);
    group.add(pRight.group);
    palms.push(pRight.sway);
  }

  // =========================================================================
  // 3. ZONE B (z = -530 to -1160): MIDNIGHT BAY CABLE-STAY CAUSEWAY BRIDGE
  // =========================================================================
  const pylonZList = [-610, -760, -910, -1060];
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x45e6ff });

  for (let pi = 0; pi < pylonZList.length; pi++) {
    const pz = pylonZList[pi];
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(0, 0, pz);

    const pylonHeight = 68;
    const legGeo = new THREE.BoxGeometry(2.2, pylonHeight, 2.8);
    const leftLeg = new THREE.Mesh(legGeo, concreteMat);
    leftLeg.position.set(-13.8, pylonHeight * 0.5 - 4, 0);
    leftLeg.rotation.z = -0.065;
    const rightLeg = new THREE.Mesh(legGeo, concreteMat);
    rightLeg.position.set(13.8, pylonHeight * 0.5 - 4, 0);
    rightLeg.rotation.z = 0.065;
    pylonGroup.add(leftLeg, rightLeg);

    // Crossbeams spanning over the highway
    const beam1 = new THREE.Mesh(new THREE.BoxGeometry(26, 2.4, 2.6), concreteMat);
    beam1.position.set(0, 28, 0);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(22.5, 2.8, 2.8), concreteMat);
    beam2.position.set(0, 56, 0);
    pylonGroup.add(beam1, beam2);

    // Intense glowing architectural neon LED spines running vertically up both pylons
    const spineCol = pi % 2 === 0 ? cyanLampMat : pinkLampMat;
    const spineGeo = new THREE.BoxGeometry(0.45, pylonHeight - 4, 0.45);
    const spineL = new THREE.Mesh(spineGeo, spineCol);
    spineL.position.set(-12.5, pylonHeight * 0.5 - 3, 1.4);
    spineL.rotation.z = -0.065;
    const spineR = new THREE.Mesh(spineGeo, spineCol);
    spineR.position.set(12.5, pylonHeight * 0.5 - 3, 1.4);
    spineR.rotation.z = 0.065;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 0.6), spineCol);
    topBar.position.set(0, 56, 1.5);
    pylonGroup.add(spineL, spineR, topBar);

    // Fan of illuminated suspension stay cables anchoring to bridge deck
    for (const side of [-1, 1]) {
      for (let c = 1; c <= 6; c++) {
        const anchorZ = c * 11.5;
        const topY = 34 + c * 4.8;
        for (const dir of [-1, 1]) {
          const pTop = new THREE.Vector3(side * 12.2, topY, 0);
          const pBot = new THREE.Vector3(side * 12.6, 0.6, dir * anchorZ);
          const dist = pTop.distanceTo(pBot);
          const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, dist, 4), cableMat);
          cable.position.copy(pTop).add(pBot).multiplyScalar(0.5);
          cable.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            pBot.clone().sub(pTop).normalize()
          );
          pylonGroup.add(cable);
        }
      }
    }

    group.add(pylonGroup);
  }

  // Distant glowing island skyline silhouettes flanking the bay in Zone B
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const xPos = side * (165 + rand() * 90);
    const zPos = -580 - i * 34;
    const bh = 36 + rand() * 75;
    const texSet = skyTexPool[i % skyTexPool.length];
    const tMat = new THREE.MeshStandardMaterial({
      map: texSet.map,
      emissiveMap: texSet.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.6,
    });
    const bld = new THREE.Mesh(new THREE.BoxGeometry(22 + rand() * 14, bh, 22 + rand() * 14), tMat);
    bld.position.set(xPos, bh * 0.5 - 2, zPos);
    group.add(bld);
  }

  // =========================================================================
  // 4. ZONE C (z = -1170 to -2300): DOWNTOWN LEONIDA NEON SKYSCRAPER CANYON
  // =========================================================================
  const billboards = [
    { t: 'LEONIDA 2026', s: 'WELCOME BACK TO VICE', p: '#ff2b93', c: '#22f5ff' },
    { t: 'VICE FM 98.6', s: 'MIDNIGHT SYNTHWAVE', p: '#22f5ff', c: '#ff7b33' },
    { t: 'APEX MOTORS', s: 'ZERO TO HORIZON', p: '#ffd24c', c: '#ff2b93' },
    { t: 'SUNSET CORP', s: 'OCEANFRONT TOWER', p: '#ff3898', c: '#4efcff' },
  ];

  for (let i = 0; i < 34; i++) {
    const zPos = -1185 - Math.floor(i / 2) * 44 + (rand() - 0.5) * 10;
    const side = i % 2 === 0 ? -1 : 1;
    const bw = 22 + rand() * 16;
    const bd = 22 + rand() * 16;
    const bh = 68 + rand() * 115;
    const xPos = side * (22 + bw * 0.5 + rand() * 6);

    const texSet = skyTexPool[(i + 1) % skyTexPool.length];
    const towerMat = new THREE.MeshStandardMaterial({
      map: texSet.map,
      emissiveMap: texSet.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.08,
      roughness: 0.2,
      metalness: 0.82,
    });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), towerMat);
    tower.position.set(xPos, bh * 0.5, zPos);
    group.add(tower);

    // Vertical neon accent edge strips facing the highway canyon!
    const edgeCol = i % 3 === 0 ? cyanLampMat : i % 3 === 1 ? pinkLampMat : warmLampMat;
    const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.55, bh * 0.92, 0.55), edgeCol);
    edgeStrip.position.set(xPos - side * (bw * 0.5 + 0.15), bh * 0.48, zPos + bd * 0.45);
    group.add(edgeStrip);

    // Giant glowing roadside holographic billboard on selected towers
    if (i % 5 === 0) {
      const bb = billboards[(i / 5) % billboards.length];
      const bbTex = createNeonSignTexture(bb.t, bb.s, bb.p, bb.c, 512, 256);
      const bbMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 9),
        new THREE.MeshBasicMaterial({ map: bbTex })
      );
      bbMesh.position.set(xPos - side * (bw * 0.5 + 0.6), 24 + rand() * 16, zPos + bd * 0.2);
      bbMesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(bbMesh);
    }

    if (bh > 115) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), beaconMat);
      beacon.position.set(xPos, bh + 1.5, zPos);
      group.add(beacon);
      aviationBeacons.push(beacon);
    }
  }

  // Dramatic illuminated Neon Highway Gantry Arches spanning over Zone C!
  for (let z = -1230; z >= -2050; z -= 140) {
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, z);
    const colL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 13.5, 0.9), concreteMat);
    colL.position.set(-13.2, 6.75, 0);
    const colR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 13.5, 0.9), concreteMat);
    colR.position.set(13.2, 6.75, 0);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(27.5, 1.4, 1.1), concreteMat);
    cross.position.set(0, 13.4, 0);

    const isCyan = Math.abs(z) % 280 < 140;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(26.5, 0.42, 0.42),
      isCyan ? cyanLampMat : pinkLampMat
    );
    strip.position.set(0, 12.6, 0.55);

    const overheadSignTex = createNeonSignTexture(
      isCyan ? 'VICE DOWNTOWN  EX 86' : 'OCEAN BEACH  -->',
      'LEONIDA EXPRESSWAY',
      isCyan ? '#22f5ff' : '#ff2b93',
      '#ffd24c',
      512,
      160
    );
    const signPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 3.6),
      new THREE.MeshBasicMaterial({ map: overheadSignTex })
    );
    signPanel.position.set(0, 14.5, 0.62);

    gantry.add(colL, colR, cross, strip, signPanel);
    group.add(gantry);
  }

  // =========================================================================
  // 4B. ZONE D (z = -1950 to -2520): SUNSET OCEAN FINALE EXPRESSWAY (PALM-LINED!)
  // =========================================================================
  for (let z = -1965; z >= -2480; z -= 24) {
    for (const side of [-1, 1]) {
      const palm = createPalmTree(
        11.5 + rand() * 3.8,
        side * (1.8 + rand() * 1.4),
        (rand() - 0.5) * 1.2,
        z * 0.13 + side
      );
      palm.group.position.set(side * 13.6, 0.1, z);
      group.add(palm.group);
      palms.push(palm.sway);
    }
  }

  // =========================================================================
  // 5. CONTINUOUS RHYTHMIC STREETLAMPS ALONG THE ENTIRE 2.6 KM CORRIDOR
  // =========================================================================
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.16, 9.5, 6);
  const armGeo = new THREE.BoxGeometry(2.6, 0.14, 0.14);
  const bulbGeo = new THREE.BoxGeometry(1.1, 0.16, 0.36);

  for (let z = 110; z >= -2480; z -= 26) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Group();
      lamp.position.set(side * 12.2, 0, z);

      const pole = new THREE.Mesh(poleGeo, lampPoleMat);
      pole.position.y = 4.75;
      lamp.add(pole);

      const arm = new THREE.Mesh(armGeo, lampPoleMat);
      arm.position.set(-side * 1.2, 9.45, 0);
      lamp.add(arm);

      const isBridge = z < -530 && z > -1160;
      const isDowntown = z <= -1160 && z > -1950;
      const mat = isDowntown
        ? side > 0
          ? pinkLampMat
          : cyanLampMat
        : isBridge
        ? side > 0
          ? cyanLampMat
          : warmLampMat
        : warmLampMat;

      const bulb = new THREE.Mesh(bulbGeo, mat);
      bulb.position.set(-side * 2.1, 9.35, 0);
      lamp.add(bulb);

      group.add(lamp);
    }
  }

  return { group, palms, aviationBeacons };
}
