import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ba9c7);
scene.fog = new THREE.Fog(0x8ba9c7, 70, 420);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 650);
camera.position.set(0, 2.2, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector('#game').appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const look = new THREE.Vector3();
const move = new THREE.Vector3();
const tmp = new THREE.Vector3();

const menu = document.querySelector('#menu');
const pause = document.querySelector('#pause');
const prompt = document.querySelector('#prompt');
const ammoEl = document.querySelector('#ammo');
const healthFill = document.querySelector('#healthFill');
const wantedEl = document.querySelector('#wanted');
const locationEl = document.querySelector('#location');
const cashEl = document.querySelector('#cash');

const keys = {};
let started = false;
let paused = false;
let health = 100;
let ammo = 12;
let reserve = 120;
let fireCooldown = 0;
let reloadCooldown = 0;
let wanted = 0;
let wantedDecay = 0;
let cash = 2500;
let inInterior = false;
let activeBuilding = null;
let dayTime = 12;

const world = new THREE.Group();
const city = new THREE.Group();
const interiors = new THREE.Group();
const actors = new THREE.Group();
const bullets = new THREE.Group();
scene.add(world, city, interiors, actors, bullets);

const mats = {
  road: new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.92 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x8b8e8c, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x50654a, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xb7b4aa, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x4c7083, roughness: 0.15, metalness: 0.25 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa52c, emissiveIntensity: 2 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa33a35, roughness: 0.75 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x315e8c, roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: 0xdfe3e5, roughness: 0.75 }),
  black: new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.55, metalness: 0.3 }),
};

function box(w, h, d, material, x, y, z, parent = city) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(r, h, material, x, y, z, parent = city) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeRoads() {
  box(240, 0.15, 26, mats.road, 0, 0, 0);
  box(240, 0.15, 26, mats.road, 0, 0, 55);
  box(26, 0.15, 240, mats.road, 0, 0, 27);
  box(26, 0.15, 240, mats.road, 55, 0, 27);
  box(240, 0.18, 5, mats.sidewalk, 0, 0.12, -15.5);
  box(240, 0.18, 5, mats.sidewalk, 0, 0.12, 15.5);
  box(240, 0.18, 5, mats.sidewalk, 0, 0.12, 39.5);
  box(240, 0.18, 5, mats.sidewalk, 0, 0.12, 70.5);
  box(5, 0.18, 240, mats.sidewalk, -15.5, 0.12, 27);
  box(5, 0.18, 240, mats.sidewalk, 15.5, 0.12, 27);
  box(5, 0.18, 240, mats.sidewalk, 39.5, 0.12, 27);
  box(5, 0.18, 240, mats.sidewalk, 70.5, 0.12, 27);

  for (let x = -110; x <= 110; x += 14) {
    box(7, 0.025, 0.16, mats.white, x, 0.1, -0.8);
    box(7, 0.025, 0.16, mats.white, x, 0.1, 55.8);
  }
  for (let z = -80; z <= 130; z += 14) {
    box(0.16, 0.025, 7, mats.white, -0.8, 0.1, z);
    box(0.16, 0.025, 7, mats.white, 55.8, 0.1, z);
  }
}

function makeBuilding(x, z, w, d, h, color, name) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  city.add(group);
  const body = box(w, h, d, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), 0, h / 2, 0, group);
  body.userData.building = name;
  for (let y = 3; y < h - 1; y += 3.1) {
    for (let px = -w / 2 + 2.2; px < w / 2 - 1; px += 4.4) {
      const win = box(2.2, 1.25, 0.08, mats.glass, px, y, d / 2 + 0.03, group);
      win.userData.building = name;
      const win2 = box(2.2, 1.25, 0.08, mats.glass, px, y, -d / 2 - 0.03, group);
      win2.userData.building = name;
    }
  }
  const door = box(2.2, 2.8, 0.15, mats.black, 0, 1.4, d / 2 + 0.12, group);
  door.userData.enterDoor = true;
  door.userData.building = name;
  const sign = box(Math.min(w - 4, 10), 1, 0.15, mats.red, 0, Math.min(h - 1.2, 8), d / 2 + 0.2, group);
  sign.userData.label = name;

  const interior = new THREE.Group();
  interior.position.set(x, 0, z + 0.1);
  interiors.add(interior);
  interior.visible = false;
  box(w - 1, 0.2, d - 1, mats.concrete, 0, 0, 0, interior);
  box(w - 1, 0.2, d - 1, mats.black, 0, 5.8, 0, interior);
  box(0.2, 5.8, d - 1, mats.concrete, -(w - 1) / 2, 2.9, 0, interior);
  box(0.2, 5.8, d - 1, mats.concrete, (w - 1) / 2, 2.9, 0, interior);
  box(w - 1, 5.8, 0.2, mats.concrete, 0, 2.9, -(d - 1) / 2, interior);
  for (let i = 0; i < 4; i++) box(2, 1.2, 2, mats.red, -w / 3 + i * 4, 1, -d / 4, interior);
  group.userData = { name, interior, doorWorld: new THREE.Vector3(x, 1.4, z + d / 2 + 0.25) };
  return group;
}

function makeCity() {
  makeRoads();
  box(240, 0.1, 240, mats.grass, 0, -0.08, 27);
  const buildings = [
    [-46, -45, 24, 25, 18, 0x7d7268, 'OCEAN VIEW HOTEL'],
    [47, -45, 24, 25, 26, 0x6f7680, 'PACIFIC TOWER'],
    [-47, 42, 25, 25, 13, 0x82776d, 'VESPUCCI MARKET'],
    [47, 42, 25, 25, 20, 0x6c6f72, 'ARCADE PLAZA'],
    [92, 10, 28, 22, 16, 0x796b60, 'EASTSIDE LOFTS'],
    [-92, 10, 28, 22, 22, 0x596a70, 'WESTSIDE OFFICES'],
  ];
  buildings.forEach(b => makeBuilding(...b));

  for (let x = -110; x <= 110; x += 11) {
    for (const z of [-12.5, 12.5, 42.5, 72.5]) {
      if (Math.abs(x) < 20 && z < 60) continue;
      cylinder(0.18, 5, mats.black, x, 2.5, z);
      cylinder(0.48, 0.08, mats.lamp, x, 5.1, z);
    }
  }
  for (let i = 0; i < 28; i++) {
    const x = (Math.random() - .5) * 220;
    const z = (Math.random() - .5) * 210 + 27;
    if (Math.abs(x % 55) < 20 || Math.abs(z % 55) < 20) continue;
    const trunk = cylinder(.22, 2.8, new THREE.MeshStandardMaterial({ color: 0x594438 }), x, 1.4, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x31583c, roughness: 1 }));
    crown.position.set(x, 3.3, z);
    crown.castShadow = true;
    city.add(crown);
  }
}

function makeCar(x, z, color, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, .55, z);
  g.rotation.y = rotation;
  city.add(g);
  box(3.8, .75, 1.8, new THREE.MeshStandardMaterial({ color, metalness: .15, roughness: .6 }), 0, .35, 0, g);
  box(1.9, .65, 1.55, mats.glass, -.25, .9, 0, g);
  for (const wx of [-1.3, 1.3]) for (const wz of [-.88, .88]) cylinder(.35, .18, mats.black, wx, .12, wz, g).rotation.z = Math.PI / 2;
  return g;
}

function makeStreetCars() {
  const colors = [0x9b3433, 0x355c85, 0xd0c5a8, 0x25292d, 0x6c8d5a, 0x9a6a2f];
  for (let i = 0; i < 18; i++) {
    const road = i % 2 === 0;
    const pos = -100 + Math.random() * 200;
    if (road) makeCar(pos, i % 4 < 2 ? 7 : 48, colors[i % colors.length], Math.PI / 2);
    else makeCar(i % 4 < 2 ? 7 : 48, pos, colors[i % colors.length], 0);
  }
}

function makePlayer() {
  camera.position.set(0, 2.2, 12);
}

function makeActor(x, z, police = false) {
  const g = new THREE.Group();
  g.position.set(x, 1, z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .95, 4, 8), new THREE.MeshStandardMaterial({ color: police ? 0x27466b : 0x8b4e42 }));
  body.castShadow = true;
  body.userData.actor = g;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb98a6d }));
  head.position.y = .85;
  head.userData.actor = g;
  g.add(head);
  g.userData = { health: 100, police, dir: Math.random() * Math.PI * 2, speed: police ? 2.5 : 1.1, shotAt: 0 };
  actors.add(g);
  return g;
}

function makeNPCs() {
  for (let i = 0; i < 26; i++) makeActor((Math.random() - .5) * 200, (Math.random() - .5) * 180 + 27);
}

function setWanted(value) {
  wanted = Math.max(0, Math.min(5, value));
  wantedEl.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
  wantedEl.style.color = wanted ? '#f3d35a' : '#657080';
}

function spawnPolice() {
  const angle = Math.random() * Math.PI * 2;
  const distance = 30 + Math.random() * 25;
  const p = makeActor(camera.position.x + Math.cos(angle) * distance, camera.position.z + Math.sin(angle) * distance, true);
  p.userData.shotAt = performance.now();
}

function addBuildingGlow() {
  const glow = new THREE.PointLight(0xffa84a, 2.4, 18);
  glow.position.set(0, 3, 0);
  world.add(glow);
}

function shoot() {
  if (!started || !controls.isLocked || reloadCooldown > 0 || fireCooldown > 0) return;
  if (ammo <= 0) { reload(); return; }
  ammo--;
  fireCooldown = .12;
  updateAmmo();
  controls.getDirection(look);
  raycaster.set(camera.position, look);
  const hits = raycaster.intersectObjects(actors.children, true);
  const target = hits.find(h => h.object.userData.actor);
  if (target) {
    const actor = target.object.userData.actor;
    actor.userData.health -= 50;
    actor.userData.shotAt = performance.now();
    addHitMarker(target.point);
    setWanted(Math.min(5, wanted + (actor.userData.police ? 2 : 1)));
    cash += actor.userData.police ? 50 : 20;
    cashEl.textContent = '$' + cash.toLocaleString();
    if (actor.userData.health <= 0) {
      actors.remove(actor);
      if (actor.userData.police) setWanted(Math.min(5, wanted + 1));
    }
  } else {
    const point = camera.position.clone().add(look.multiplyScalar(45));
    addTracer(point);
  }
}

function addHitMarker(point) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  for (let i = 0; i < 4; i++) {
    const q = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .7), m);
    q.rotation.y = i * Math.PI / 2;
    g.add(q);
  }
  g.position.copy(point);
  world.add(g);
  setTimeout(() => world.remove(g), 100);
}

function addTracer(point) {
  const start = camera.position.clone();
  const dir = point.clone().sub(start).normalize();
  const line = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  line.position.copy(start.clone().add(dir.multiplyScalar(3.5)));
  line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  bullets.add(line);
  setTimeout(() => bullets.remove(line), 45);
}

function reload() {
  if (reloadCooldown > 0 || ammo === 12 || reserve <= 0) return;
  reloadCooldown = 1.1;
}

function updateAmmo() {
  ammoEl.textContent = `${ammo} / ${reserve}`;
}

function enterBuilding(building) {
  if (inInterior) return;
  activeBuilding = building;
  inInterior = true;
  building.visible = false;
  building.userData.interior.visible = true;
  camera.position.set(building.position.x, 2.2, building.position.z);
  locationEl.textContent = building.userData.name;
}

function exitBuilding() {
  if (!inInterior || !activeBuilding) return;
  const b = activeBuilding;
  b.visible = true;
  b.userData.interior.visible = false;
  camera.position.set(b.userData.doorWorld.x, 2.2, b.userData.doorWorld.z + 2);
  inInterior = false;
  activeBuilding = null;
  locationEl.textContent = 'VESPUCCI DISTRICT';
}

function findNearestDoor() {
  let nearest = null;
  let distance = Infinity;
  city.children.forEach(g => {
    if (!g.userData?.doorWorld) return;
    const d = camera.position.distanceTo(g.userData.doorWorld);
    if (d < distance) { distance = d; nearest = g; }
  });
  return distance < 4.5 ? nearest : null;
}

function tryInteract() {
  if (inInterior) exitBuilding();
  else {
    const b = findNearestDoor();
    if (b) enterBuilding(b);
  }
}

function damagePlayer(amount) {
  health = Math.max(0, health - amount);
  healthFill.style.width = health + '%';
  document.body.classList.add('damage');
  setTimeout(() => document.body.classList.remove('damage'), 180);
  if (health <= 0) respawn();
}

function respawn() {
  health = 100; ammo = 12; reserve = 120; wanted = 0; inInterior = false;
  if (activeBuilding) { activeBuilding.visible = true; activeBuilding.userData.interior.visible = false; }
  activeBuilding = null;
  camera.position.set(0, 2.2, 12);
  setWanted(0); updateAmmo(); healthFill.style.width = '100%';
}

function updateActors(dt) {
  actors.children.forEach(actor => {
    const u = actor.userData;
    const distance = actor.position.distanceTo(camera.position);
    if (u.police) {
      tmp.subVectors(camera.position, actor.position).setY(0);
      if (tmp.length() > 7) actor.position.add(tmp.normalize().multiplyScalar(u.speed * dt));
      actor.lookAt(camera.position.x, actor.position.y, camera.position.z);
      if (distance < 20 && performance.now() - u.shotAt > 1800) {
        u.shotAt = performance.now();
        damagePlayer(6);
      }
    } else {
      u.dir += (Math.random() - .5) * dt * .5;
      actor.position.x += Math.cos(u.dir) * u.speed * dt;
      actor.position.z += Math.sin(u.dir) * u.speed * dt;
      actor.rotation.y = -u.dir;
      if (Math.abs(actor.position.x) > 115 || Math.abs(actor.position.z) > 120) u.dir += Math.PI;
    }
  });
}

function updatePlayer(dt) {
  if (!controls.isLocked || paused) return;
  const speed = keys.ShiftLeft || keys.ShiftRight ? 8.5 : 5.2;
  move.set(0, 0, 0);
  if (keys.KeyW) move.z -= 1;
  if (keys.KeyS) move.z += 1;
  if (keys.KeyA) move.x -= 1;
  if (keys.KeyD) move.x += 1;
  if (move.lengthSq()) {
    move.normalize();
    controls.moveRight(move.x * speed * dt);
    controls.moveForward(-move.z * speed * dt);
  }
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -116, 116);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -112, 142);
  camera.position.y = 2.2;
}

function updatePrompt() {
  if (inInterior) prompt.textContent = 'E  EXIT BUILDING';
  else {
    const b = findNearestDoor();
    prompt.textContent = b ? `E  ENTER ${b.userData.name}` : '';
  }
}

function updateWanted(dt) {
  if (wanted <= 0) return;
  const policeNearby = actors.children.some(a => a.userData.police && a.position.distanceTo(camera.position) < 38);
  if (!policeNearby) wantedDecay += dt;
  else wantedDecay = 0;
  if (wantedDecay > 12) { setWanted(wanted - 1); wantedDecay = 0; }
  if (wanted > 0 && actors.children.filter(a => a.userData.police).length < Math.ceil(wanted / 2)) spawnPolice();
}

function updateWorld(dt) {
  dayTime = (dayTime + dt * .025) % 24;
  const sun = scene.getObjectByName('sun');
  const night = dayTime < 6 || dayTime > 19;
  const brightness = night ? .18 : .75;
  if (sun) sun.intensity = brightness;
  const sky = night ? 0x11182b : 0x8ba9c7;
  scene.background.setHex(sky);
  scene.fog.color.setHex(sky);
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xd7e8ff, 0x34402e, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe5bd, .8);
  sun.name = 'sun';
  sun.position.set(-70, 100, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 300;
  scene.add(sun);
}

function startGame() {
  if (!started) started = true;
  menu.classList.add('hidden');
  pause.classList.add('hidden');
  paused = false;
  controls.lock();
}

document.querySelector('#play').addEventListener('click', startGame);
document.querySelector('#resume').addEventListener('click', startGame);
controls.addEventListener('unlock', () => {
  if (!started) return;
  paused = true;
  pause.classList.remove('hidden');
});
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && !e.repeat) tryInteract();
  if (e.code === 'KeyR' && !e.repeat) reload();
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousedown', e => { if (e.button === 0) shoot(); });
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

makeCity();
makeStreetCars();
makeNPCs();
makePlayer();
setupLights();
addBuildingGlow();
setWanted(0);
updateAmmo();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (reloadCooldown > 0) {
    reloadCooldown -= dt;
    if (reloadCooldown <= 0) {
      const needed = 12 - ammo;
      const loaded = Math.min(needed, reserve);
      ammo += loaded; reserve -= loaded; updateAmmo();
    }
  }
  updatePlayer(dt);
  updateActors(dt);
  updateWanted(dt);
  updatePrompt();
  updateWorld(dt);
  renderer.render(scene, camera);
}
animate();
