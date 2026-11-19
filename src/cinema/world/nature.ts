import * as THREE from 'three';

export interface SwayingPalm {
  crown: THREE.Group;
  phase: number;
  baseRotX: number;
  baseRotZ: number;
}

export interface BirdAgent {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  basePos: THREE.Vector3;
  speed: number;
  phase: number;
}

function createFrondGeometry(): THREE.BufferGeometry {
  // Arched tapered tropical palm frond ribbon
  const segs = 10;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const len = u * 4.4;
    const droop = -Math.pow(u, 1.85) * 1.9 + Math.sin(u * Math.PI) * 0.35;
    const halfWidth = Math.sin(Math.pow(u, 0.7) * Math.PI) * 0.52;

    // Center spine slightly raised for natural V-profile frond
    positions.push(-halfWidth, droop - 0.08, len);
    positions.push(0, droop + 0.05, len);
    positions.push(halfWidth, droop - 0.08, len);
  }

  for (let i = 0; i < segs; i++) {
    const row = i * 3;
    const next = (i + 1) * 3;
    indices.push(row, next, row + 1);
    indices.push(row + 1, next, next + 1);
    indices.push(row + 1, next + 1, row + 2);
    indices.push(row + 2, next + 1, next + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

const sharedFrondGeo = createFrondGeometry();
const sharedTrunkMat = new THREE.MeshStandardMaterial({
  color: 0x3b2a29,
  roughness: 0.92,
  metalness: 0.05,
});
const sharedFrondMat = new THREE.MeshStandardMaterial({
  color: 0x102820,
  emissive: 0x061214,
  emissiveIntensity: 0.35,
  roughness: 0.72,
  metalness: 0.08,
  side: THREE.DoubleSide,
});

export function createPalmTree(
  height: number,
  leanX: number,
  leanZ: number,
  seed: number
): { group: THREE.Group; sway: SwayingPalm } {
  const group = new THREE.Group();

  // Curved tapered trunk via CatmullRomCurve3 + TubeGeometry
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * 0.28, height * 0.35, leanZ * 0.28),
    new THREE.Vector3(leanX * 0.75, height * 0.72, leanZ * 0.75),
    new THREE.Vector3(leanX, height, leanZ),
  ]);

  const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.24, 6, false);
  // Taper radius smoothly toward crown
  const posAttr = tubeGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const frac = Math.min(Math.max(y / height, 0), 1);
    const center = curve.getPoint(frac);
    const scale = 1.25 - frac * 0.62;
    posAttr.setXYZ(
      i,
      center.x + (posAttr.getX(i) - center.x) * scale,
      y,
      center.z + (posAttr.getZ(i) - center.z) * scale
    );
  }
  tubeGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(tubeGeo, sharedTrunkMat);
  group.add(trunk);

  // Crown group at top of curved trunk
  const crown = new THREE.Group();
  crown.position.set(leanX, height, leanZ);

  // Coconut cluster hub
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), sharedTrunkMat);
  crown.add(hub);

  // 11 lush arched fronds in two tiers
  const frondCount = 11;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + seed * 0.7;
    const tier = i % 2;
    const frond = new THREE.Mesh(sharedFrondGeo, sharedFrondMat);
    frond.rotation.y = angle;
    frond.rotation.x = tier === 0 ? -0.18 : 0.26;
    const s = (0.86 + ((i * 37) % 10) * 0.03) * (height / 13.0);
    frond.scale.set(s, s, s);
    crown.add(frond);
  }

  group.add(crown);

  return {
    group,
    sway: {
      crown,
      phase: seed * 1.9,
      baseRotX: 0,
      baseRotZ: 0,
    },
  };
}

export function createCoastalFlock(count = 16): { group: THREE.Group; birds: BirdAgent[] } {
  const group = new THREE.Group();
  const birds: BirdAgent[] = [];

  const bodyMat = new THREE.MeshBasicMaterial({ color: 0xff9ec4 });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xff6da8, side: THREE.DoubleSide });

  const bodyGeo = new THREE.ConeGeometry(0.11, 0.9, 5);
  bodyGeo.rotateX(Math.PI / 2);

  // Left & right wing shapes pivoted at shoulder
  const lwGeo = new THREE.BufferGeometry();
  lwGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0.18, -1.25, 0.06, -0.08, 0, 0, -0.22], 3)
  );
  const rwGeo = new THREE.BufferGeometry();
  rwGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0.18, 1.25, 0.06, -0.08, 0, 0, -0.22], 3)
  );

  for (let i = 0; i < count; i++) {
    const bGroup = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    const leftWing = new THREE.Mesh(lwGeo, wingMat);
    const rightWing = new THREE.Mesh(rwGeo, wingMat);
    bGroup.add(body, leftWing, rightWing);

    // V-formation cruising over the golden coast in Act I
    const side = i % 2 === 0 ? 1 : -1;
    const rank = Math.floor(i / 2);
    const basePos = new THREE.Vector3(
      -52 + side * (rank * 2.6 + (i % 3) * 0.9),
      15.5 + Math.sin(i * 1.3) * 2.2,
      -55 - rank * 3.8
    );
    bGroup.position.copy(basePos);
    bGroup.rotation.y = 0.25;
    group.add(bGroup);

    birds.push({
      group: bGroup,
      leftWing,
      rightWing,
      basePos,
      speed: 14.5 + (i % 4) * 0.6,
      phase: i * 0.65,
    });
  }

  return { group, birds };
}
