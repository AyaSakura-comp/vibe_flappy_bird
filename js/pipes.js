import { PIPE_GAP, PIPE_Y_PATTERN, PIPE_SPACING } from './constants.js';
import * as THREE from 'three';

export const pipes = [];
export let pipeCount = 0;

export function resetPipes(scene) {
  pipes.forEach(p => scene.remove(p.group));
  pipes.length = 0;
  pipeCount = 0;
}

export function makePipeSegment(height) {
  const group = new THREE.Group();

  const cylGeo = new THREE.CylinderGeometry(1.0, 1.0, height, 12);
  const cylMat = new THREE.MeshBasicMaterial({ color: 0x6600cc });
  group.add(new THREE.Mesh(cylGeo, cylMat));

  const capGeo = new THREE.CylinderGeometry(1.01, 1.01, 0.08, 16);
  const capMat = new THREE.MeshBasicMaterial({ color: 0xff00aa });
  const cap    = new THREE.Mesh(capGeo, capMat);
  group.add(cap);

  const innerGeo = new THREE.CylinderGeometry(1.005, 1.005, 0.04, 16);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const inner    = new THREE.Mesh(innerGeo, innerMat);
  group.add(inner);

  return { group, cap, inner };
}

export function spawnPipe(scene, spawnZ = -18) {
  const yOffset = PIPE_Y_PATTERN[pipeCount % 5];
  pipeCount++;
  const gapTop  = yOffset + PIPE_GAP / 2;
  const gapBot  = yOffset - PIPE_GAP / 2;

  const pipeGroup = new THREE.Group();
  pipeGroup.position.set(0, 0, spawnZ);
  pipeGroup.frustumCulled = false;
  scene.add(pipeGroup);

  const topHeight = 12;
  const { group: topGroup, cap: topCap, inner: topInner } = makePipeSegment(topHeight);
  topGroup.position.y = gapTop + topHeight / 2;
  topCap.position.y   = -topHeight / 2;
  topInner.position.y = -topHeight / 2;
  pipeGroup.add(topGroup);

  const botHeight = 12;
  const { group: botGroup, cap: botCap, inner: botInner } = makePipeSegment(botHeight);
  botGroup.position.y = gapBot - botHeight / 2;
  botCap.position.y   = botHeight / 2;
  botInner.position.y = botHeight / 2;
  pipeGroup.add(botGroup);

  pipes.push({ group: pipeGroup, gapTop, gapBot, scored: false });
}

export function prefillPipes(scene) {
  const farZ  = -27;
  const nearZ =  -3;
  for (let z = nearZ; z >= farZ; z -= PIPE_SPACING) {
    spawnPipe(scene, z);
  }
}
