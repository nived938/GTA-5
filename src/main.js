import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ba9c7);
scene.fog = new THREE.Fog(0x8ba9c7, 70, 420);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 700);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector('#game').appendChild(renderer.domElement);

const $ = id => document.getElementById(id);
const menu = $('menu');
const pause = $('pause');
const promptEl = $('prompt');
const ammoEl = $('ammo');
const healthFill = $('healthFill');
const wantedEl = $('wanted');
const cashEl = $('cash');
const locationEl = $('location');
const vehicleNameEl = $('vehicleName');
const speedEl = $('speed');
const vehicleHud = $('vehicleHud');
const minimap = $('minimap');
const mapCanvas = $('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');

const world = new THREE.Group();
const city = new THREE.Group();
const interiors = new THREE.Group();
const actors = new THREE.Group();
const vehicles = new THREE.Group();
const pickups = new THREE.Group();
const fx = new THREE.Group();
scene.add(world, city, interiors, actors, vehicles, pickups, fx);

const keys = {};
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const forward = new THREE.Vector3();
const temp = new THREE.Vector3();
const target = new THREE.Vector3();

let locked = false;
let started = false;
let paused = false;
let health = 100;
let armor = 25;
let ammo = 12;
let reserve = 120;
let reloadTimer = 0;
let fireCooldown = 0;
let wanted = 0;
let wantedDecay = 0;
let cash = 2500;
let dayTime = 13;
let cameraYaw = Math.PI;
let cameraPitch = 0.12;
let currentVehicle = null;
let inInterior = false;
let activeBuilding = null;
let showMap = true;
let currentWeapon = 0;
let mission = null;
let missionReward = 0;

const weapons = [
  { name: '9MM', mag: 12, reserve: 120, damage: 50, cooldown: 0.14 },
  { name: 'SMG', mag: 30, reserve: 180, damage: 25, cooldown: 0.075 },
  { name: 'SHOTGUN', mag: 6, reserve: 48, damage: 85, cooldown: 0.55 }
];
const weaponAmmo = weapons.map(w => ({ ammo: w.mag, reserve: w.reserve }));

const colliders = [];
const buildings = [];
const cars = [];
const missionObjects = [];

const mats = {
  road: new THREE.MeshStandardMaterial({ color: 0x242932, roughness: 0.94 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x888b89, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x496045, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xb4b1a8, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x41697a, roughness: 0.14, metalness: 0.25 }),
  black: new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.5, metalness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe2e5e7, roughness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa53b35, roughness: 0.75 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2e5d91, roughness: 0.72 }),
  green: new THREE.MeshStandardMaterial({ color: 0x466c4e, roughness: 0.9 })
};

const box = (w, h, d, material, x, y, z, parent = city) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const cyl = (r, h, material, x, y, z, parent = city) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const addCollider = (x, z, w, d) => colliders.push({ x, z, w, d });
const blocked = (x, z, radius = 0.65) => colliders.some(c => Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius);

function makeRoads() {
  box(240, 0.16, 26, mats.road, 0, 0, 0);
  box(240, 0.16, 26, mats.road, 0, 0, 55);
  box(26, 0.16, 240, mats.road, 0, 0, 27);
  box(26, 0.16, 240, mats.road, 55, 0, 27);
  [[0, -15.5, 240, 5], [0, 15.5, 240, 5], [0, 39.5, 240, 5], [0, 70.5, 240, 5], [-15.5, 27, 5, 240], [15.5, 27, 5, 240], [39.5, 27, 5, 240], [70.5, 27, 5, 240]].forEach(([x, z, w, d]) => box(w, 0.18, d, mats.sidewalk, x, 0.12, z));
  for (let x = -110; x <= 110; x += 14) {
    box(7, 0.03, 0.14, mats.white, x, 0.1, -0.8);
    box(7, 0.03, 0.14, mats.white, x, 0.1, 55.8);
  }
  for (let z = -80; z <= 130; z += 14) {
    box(0.14, 0.03, 7, mats.white, -0.8, 0.1, z);
    box(0.14, 0.03, 7, mats.white, 55.8, 0.1, z);
  }
}

function makeBuilding(x, z, w, d, h, color, name) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  city.add(group);
  box(w, h, d, new THREE.MeshStandardMaterial({ color, roughness: 0.84 }), 0, h / 2, 0, group);
  for (let y = 3; y < h - 1; y += 3.1) {
    for (let px = -w / 2 + 2.2; px < w / 2 - 1; px += 4.4) {
      box(2.2, 1.25, 0.08, mats.glass, px, y, d / 2 + 0.04, group);
      box(2.2, 1.25, 0.08, mats.glass, px, y, -d / 2 - 0.04, group);
    }
  }
  const door = box(2.3, 2.9, 0.16, mats.black, 0, 1.45, d / 2 + 0.1, group);
  door.userData.building = group;
  box(Math.min(w - 4, 11), 1, 0.16, mats.red, 0, Math.min(h - 1.1, 8), d / 2 + 0.17, group);

  const interior = new THREE.Group();
  interior.position.set(x, 0, z + 0.1);
  interior.visible = false;
  interiors.add(interior);
  box(w - 1, 0.2, d - 1, mats.concrete, 0, 0, 0, interior);
  box(w - 1, 0.2, d - 1, mats.black, 0, 6, 0, interior);
  box(0.2, 6, d - 1, mats.concrete, -(w - 1) / 2, 3, 0, interior);
  box(0.2, 6, d - 1, mats.concrete, (w - 1) / 2, 3, 0, interior);
  box(w - 1, 6, 0.2, mats.concrete, 0, 3, -(d - 1) / 2, interior);
  for (let i = 0; i < 5; i++) box(1.8, 1, 1.8, i % 2 ? mats.blue : mats.red, -w / 3 + i * 3.4, 1, -d / 4, interior);

  group.userData = {
    name,
    interior,
    doorWorld: new THREE.Vector3(x, 0, z + d / 2 + 0.7),
    size: { w, d, h }
  };
  buildings.push(group);
  addCollider(x, z, w, d);
}

function makeCity() {
  makeRoads();
  box(240, 0.1, 240, mats.grass, 0, -0.08, 27);
  [
    [-46, -45, 24, 25, 18, 0x7d7268, 'OCEAN VIEW HOTEL'],
    [47, -45, 24, 25, 26, 0x69737e, 'PACIFIC TOWER'],
    [-47, 42, 25, 25, 13, 0x82776d, 'VESPUCCI MARKET'],
    [47, 42, 25, 25, 20, 0x6c7075, 'ARCADE PLAZA'],
    [92, 10, 28, 22, 16, 0x796b60, 'EASTSIDE LOFTS'],
    [-92, 10, 28, 22, 22, 0x596a70, 'WESTSIDE OFFICES']
  ].forEach(data => makeBuilding(...data));

  for (let x = -110; x <= 110; x += 11) {
    for (const z of [-12.5, 12.5, 42.5, 72.5]) {
      if (Math.abs(x) < 20 && z < 60) continue;
      cyl(0.18, 5, mats.black, x, 2.5, z);
      cyl(0.48, 0.08, new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xff8b22, emissiveIntensity: 2 }), x, 5.1, z);
    }
  }

  for (let i = 0; i < 55; i++) {
    const x = (Math.random() - 0.5) * 220;
    const z = (Math.random() - 0.5) * 210 + 27;
    if (Math.abs(x % 55) < 19 || Math.abs(z % 55) < 19) continue;
    cyl(0.22, 2.8, new THREE.MeshStandardMaterial({ color: 0x594438 }), x, 1.4, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), mats.green);
    crown.position.set(x, 3.3, z);
    crown.castShadow = true;
    city.add(crown);
  }
}

function makePlayer() {
  const p = new THREE.Group();
  p.position.set(0, 0, 12);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 5, 10), new THREE.MeshStandardMaterial({ color: 0x3e4652, roughness: 0.7 }));
  body.position.y = 1;
  body.castShadow = true;
  p.add(body);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.38), new THREE.MeshStandardMaterial({ color: 0x253044 }));
  shirt.position.y = 1.45;
  p.add(shirt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: 0xb9896c, roughness: 0.9 }));
  head.position.y = 1.82;
  p.add(head);
  world.add(p);
  return p;
}

function makeCar(x, z, color, rotation = 0, traffic = true, police = false) {
  const g = new THREE.Group();
  g.position.set(x, 0.52, z);
  g.rotation.y = rotation;
  g.userData = { speed: traffic ? 4 + Math.random() * 3 : 0, traffic, occupied: false, name: police ? 'POLICE CRUISER' : 'SENTINEL', police };

  box(4.1, 0.75, 1.85, new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.2 }), 0, 0.35, 0, g);
  box(2, 0.62, 1.56, mats.glass, -0.2, 0.9, 0, g);
  for (const wx of [-1.38, 1.38]) for (const wz of [-0.9, 0.9]) cyl(0.34, 0.18, mats.black, wx, 0.12, wz, g).rotation.z = Math.PI / 2;

  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x1c2530, emissive: 0x203040 }));
    bar.position.y = 1.28;
    g.add(bar);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x285eff }));
    left.position.set(-0.25, 1.35, 0);
    const right = left.clone();
    right.material = new THREE.MeshBasicMaterial({ color: 0xff334c });
    right.position.x = 0.25;
    g.add(left, right);
  }
  vehicles.add(g);
  cars.push(g);
  return g;
}

function makeTraffic() {
  const colors = [0x9e3434, 0x345f8a, 0xd0c4a5, 0x292d31, 0x64845a, 0x8c6333];
  for (let i = 0; i < 34; i++) {
    const horizontal = i % 2 === 0;
    const p = -105 + Math.random() * 210;
    makeCar(horizontal ? p : (i % 4 < 2 ? 7 : 48), horizontal ? (i % 4 < 2 ? 7 : 48) : p, colors[i % colors.length], horizontal ? Math.PI / 2 : 0, true);
  }
}

function makeNPC(x, z, police = false) {
  const g = new THREE.Group();
  g.position.set(x, 1, z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: police ? 0x294b73 : 0x8a4c41 }));
  body.castShadow = true;
  body.userData.actor = g;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb98a6d }));
  head.position.y = 0.82;
  head.userData.actor = g;
  g.add(head);
  g.userData = { health: 100, police, dir: Math.random() * Math.PI * 2, speed: police ? 2.8 : 1.05, shotAt: 0 };
  actors.add(g);
  return g;
}

function makeNPCs() {
  for (let i = 0; i < 36; i++) makeNPC((Math.random() - 0.5) * 205, (Math.random() - 0.5) * 175 + 27);
}

function updateWeaponUI() {
  const w = weapons[currentWeapon];
  const a = weaponAmmo[currentWeapon];
  $('weaponName').textContent = w.name;
  ammoEl.textContent = `${a.ammo} / ${a.reserve}`;
}

function setWanted(value) {
  wanted = THREE.MathUtils.clamp(Math.round(value), 0, 5);
  wantedEl.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
  wantedEl.style.color = wanted ? '#f3d35a' : '#657080';
}

function flash(text) {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function damagePlayer(amount) {
  if (currentVehicle) return;
  const armorDamage = Math.min(armor, Math.ceil(amount * 0.55));
  armor -= armorDamage;
  health = Math.max(0, health - (amount - armorDamage));
  healthFill.style.width = `${health}%`;
  document.body.classList.add('damage');
  setTimeout(() => document.body.classList.remove('damage'), 180);
  if (health <= 0) respawn();
}

function respawn() {
  health = 100;
  armor = 25;
  wanted = 0;
  currentVehicle = null;
  inInterior = false;
  activeBuilding = null;
  player.visible = true;
  player.position.set(0, 0, 12);
  for (const b of buildings) { b.visible = true; b.userData.interior.visible = false; }
  vehicleHud.classList.remove('active');
  healthFill.style.width = '100%';
  setWanted(0);
  locationEl.textContent = 'VESPUCCI DISTRICT';
  flash('WASTED • RESPAWNED');
}

function switchWeapon(index) {
  if (index < 0 || index >= weapons.length) return;
  currentWeapon = index;
  fireCooldown = 0;
  reloadTimer = 0;
  updateWeaponUI();
  flash(`EQUIPPED ${weapons[index].name}`);
}

function reload() {
  const w = weapons[currentWeapon];
  const a = weaponAmmo[currentWeapon];
  if (reloadTimer > 0 || a.ammo >= w.mag || a.reserve <= 0 || currentVehicle) return;
  reloadTimer = currentWeapon === 2 ? 1.25 : 0.95;
}

function fire() {
  if (!locked || !started || paused || currentVehicle || reloadTimer > 0 || fireCooldown > 0) return;
  const w = weapons[currentWeapon];
  const a = weaponAmmo[currentWeapon];
  if (a.ammo <= 0) { reload(); return; }
  a.ammo--;
  fireCooldown = w.cooldown;
  updateWeaponUI();

  const origin = camera.position.clone();
  const ray = camera.getWorldDirection(forward).normalize();
  const pellets = currentWeapon === 2 ? 7 : 1;
  let hitAnything = false;
  for (let p = 0; p < pellets; p++) {
    const spread = new THREE.Vector3((Math.random() - 0.5) * (currentWeapon === 2 ? 0.09 : 0.012), (Math.random() - 0.5) * (currentWeapon === 2 ? 0.09 : 0.012), 0);
    const shot = ray.clone().add(spread).normalize();
    raycaster.set(origin, shot);
    const hit = raycaster.intersectObjects(actors.children, true).find(h => h.object.userData.actor);
    if (!hit) continue;
    hitAnything = true;
    const actor = hit.object.userData.actor;
    actor.userData.health -= w.damage;
    actor.userData.shotAt = performance.now();
    hitFX(hit.point);
    setWanted(wanted + (actor.userData.police ? 2 : 1));
    if (actor.userData.health <= 0) {
      const wasPolice = actor.userData.police;
      actor.removeFromParent();
      cash += wasPolice ? 75 : 25;
      cashEl.textContent = '$' + cash.toLocaleString();
      missionProgress('eliminate', wasPolice);
    }
  }
  if (!hitAnything) tracer(origin, origin.clone().add(ray.multiplyScalar(42)));
}

function tracer(a, b) {
  const d = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  mesh.position.copy(a.clone().add(d.normalize().multiplyScalar(3)));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  fx.add(mesh);
  setTimeout(() => mesh.removeFromParent(), 55);
}

function hitFX(point) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i < 4; i++) {
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.65), m);
    q.rotation.y = i * Math.PI / 2;
    g.add(q);
  }
  g.position.copy(point);
  fx.add(g);
  setTimeout(() => g.removeFromParent(), 90);
}

function nearestCar() {
  let best = null;
  let bestDistance = 4;
  for (const car of cars) {
    if (car.userData.occupied) continue;
    const d = distance2D(player.position, car.position);
    if (d < bestDistance) { bestDistance = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  currentVehicle = car;
  car.userData.occupied = true;
  player.visible = false;
  vehicleHud.classList.add('active');
  vehicleNameEl.textContent = car.userData.name;
  locationEl.textContent = 'CITY STREETS';
  if (car.userData.police) setWanted(wanted + 2);
  else setWanted(wanted + 1);
}

function exitCar() {
  if (!currentVehicle) return;
  const car = currentVehicle;
  const side = new THREE.Vector3(0, 0, 2.5).applyQuaternion(car.quaternion);
  player.position.copy(car.position).add(side);
  player.position.y = 0;
  player.visible = true;
  car.userData.occupied = false;
  currentVehicle = null;
  vehicleHud.classList.remove('active');
}

function enterBuilding(building) {
  if (inInterior) return;
  inInterior = true;
  activeBuilding = building;
  building.visible = false;
  building.userData.interior.visible = true;
  player.position.copy(building.position);
  player.visible = true;
  locationEl.textContent = building.userData.name;
}

function exitBuilding() {
  if (!inInterior || !activeBuilding) return;
  const b = activeBuilding;
  b.visible = true;
  b.userData.interior.visible = false;
  player.position.copy(b.userData.doorWorld);
  player.position.y = 0;
  inInterior = false;
  activeBuilding = null;
  locationEl.textContent = 'VESPUCCI DISTRICT';
}

function interact() {
  if (inInterior) { exitBuilding(); return; }
  if (currentVehicle) { exitCar(); return; }
  const car = nearestCar();
  if (car) { enterCar(car); return; }
  let closest = null;
  let dBest = 4.5;
  for (const b of buildings) {
    const d = distance2D(player.position, b.userData.doorWorld);
    if (d < dBest) { dBest = d; closest = b; }
  }
  if (closest) enterBuilding(closest);
}

function updateOnFoot(dt) {
  if (!locked || paused || inInterior || currentVehicle) return;
  let x = 0;
  let z = 0;
  if (keys.KeyW) z -= 1;
  if (keys.KeyS) z += 1;
  if (keys.KeyA) x -= 1;
  if (keys.KeyD) x += 1;
  if (!x && !z) return;
  const length = Math.hypot(x, z);
  x /= length; z /= length;
  const speed = keys.ShiftLeft || keys.ShiftRight ? 8 : 4.8;
  const f = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const r = new THREE.Vector3(f.z, 0, -f.x);
  const velocity = f.multiplyScalar(-z).add(r.multiplyScalar(x)).multiplyScalar(speed * dt);
  const nx = player.position.x + velocity.x;
  const nz = player.position.z + velocity.z;
  if (!blocked(nx, nz)) player.position.set(nx, 0, nz);
  player.rotation.y = Math.atan2(velocity.x, velocity.z);
}

function updateVehicle(dt) {
  if (!currentVehicle || !locked || paused) return;
  const car = currentVehicle;
  let throttle = 0;
  if (keys.KeyW) throttle = 1;
  if (keys.KeyS) throttle = -0.75;
  const boost = keys.ShiftLeft || keys.ShiftRight ? 1.35 : 1;
  car.userData.speed = THREE.MathUtils.lerp(car.userData.speed, throttle * 18 * boost, 0.08);
  const steering = (keys.KeyA ? -1 : 0) + (keys.KeyD ? 1 : 0);
  car.rotation.y -= steering * dt * (0.9 + Math.abs(car.userData.speed) / 17);
  const heading = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  const next = car.position.clone().add(heading.multiplyScalar(car.userData.speed * dt));
  if (!blocked(next.x, next.z, 1.9) && Math.abs(next.x) < 118 && Math.abs(next.z) < 116) car.position.copy(next);
  else car.userData.speed *= 0.25;
  speedEl.textContent = `${Math.round(Math.abs(car.userData.speed) * 4.8)} KM/H`;
}

function updateTraffic(dt) {
  for (const car of cars) {
    if (car === currentVehicle || !car.userData.traffic) continue;
    const heading = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    car.position.add(heading.multiplyScalar(car.userData.speed * dt));
    if (car.position.x > 122 || car.position.x < -122 || car.position.z > 146 || car.position.z < -116) {
      if (Math.abs(Math.sin(car.rotation.y)) > 0.5) car.position.x = car.position.x > 0 ? -120 : 120;
      else car.position.z = car.position.z > 0 ? -114 : 144;
    }
  }
}

function spawnPolice() {
  const center = currentVehicle ? currentVehicle.position : player.position;
  const angle = Math.random() * Math.PI * 2;
  const distance = 32 + Math.random() * 18;
  const police = makeCar(center.x + Math.cos(angle) * distance, center.z + Math.sin(angle) * distance, 0x243b5c, angle + Math.PI / 2, false, true);
  police.userData.traffic = false;
}

function updateActors(dt) {
  for (const actor of actors.children) {
    const u = actor.userData;
    const targetPosition = currentVehicle ? currentVehicle.position : player.position;
    const distance = distance2D(actor.position, targetPosition);
    if (u.police) {
      temp.subVectors(targetPosition, actor.position).setY(0);
      if (temp.length() > 7) actor.position.add(temp.normalize().multiplyScalar(u.speed * dt));
      actor.lookAt(targetPosition.x, actor.position.y, targetPosition.z);
      if (wanted > 0 && distance < 22 && performance.now() - u.shotAt > 1500) {
        u.shotAt = performance.now();
        damagePlayer(5 + wanted);
      }
    } else {
      u.dir += (Math.random() - 0.5) * dt * 0.7;
      actor.position.x += Math.cos(u.dir) * u.speed * dt;
      actor.position.z += Math.sin(u.dir) * u.speed * dt;
      if (Math.abs(actor.position.x) > 112 || Math.abs(actor.position.z) > 118) u.dir += Math.PI;
    }
  }

  if (wanted > 0) {
    const policeNearby = actors.children.some(a => a.userData.police && distance2D(a.position, currentVehicle ? currentVehicle.position : player.position) < 38);
    if (!policeNearby) wantedDecay += dt;
    else wantedDecay = 0;
    if (wantedDecay > 12) { setWanted(wanted - 1); wantedDecay = 0; }
    const policeCount = actors.children.filter(a => a.userData.police).length;
    if (policeCount < Math.ceil(wanted / 2)) {
      const p = currentVehicle ? currentVehicle.position : player.position;
      const angle = Math.random() * Math.PI * 2;
      makeNPC(p.x + Math.cos(angle) * 35, p.z + Math.sin(angle) * 35, true);
    }
  }
}

function startMission() {
  if (mission) return flash('MISSION ALREADY ACTIVE');
  const types = ['reach', 'collect', 'eliminate'];
  const type = types[Math.floor(Math.random() * types.length)];
  const targetBuilding = buildings[Math.floor(Math.random() * buildings.length)];
  mission = {
    type,
    target: targetBuilding,
    progress: 0,
    goal: type === 'eliminate' ? 3 : 1,
    reward: 500 + Math.floor(Math.random() * 500)
  };
  missionReward = mission.reward;
  flash(`MISSION STARTED • ${missionTitle()}`);
}

function missionTitle() {
  if (!mission) return '';
  if (mission.type === 'reach') return `REACH ${mission.target.userData.name}`;
  if (mission.type === 'collect') return `COLLECT CASH AT ${mission.target.userData.name}`;
  return `ELIMINATE ${mission.goal} ENEMIES`;
}

function missionProgress(type) {
  if (!mission || mission.type !== type) return;
  mission.progress++;
  if (mission.progress >= mission.goal) completeMission();
}

function updateMission(dt) {
  if (!mission) return;
  if (mission.type === 'reach' && distance2D(player.position, mission.target.position) < 8) completeMission();
  if (mission.type === 'collect' && distance2D(player.position, mission.target.position) < 8) completeMission();
}

function completeMission() {
  cash += mission.reward;
  cashEl.textContent = '$' + cash.toLocaleString();
  flash(`MISSION PASSED • +$${mission.reward.toLocaleString()}`);
  mission = null;
  missionReward = 0;
}

function updatePrompt() {
  if (currentVehicle) promptEl.textContent = 'F / E  EXIT VEHICLE';
  else if (inInterior) promptEl.textContent = 'E  EXIT BUILDING';
  else {
    const car = nearestCar();
    if (car) { promptEl.textContent = 'E  ENTER VEHICLE'; return; }
    let closest = null;
    let best = 4.5;
    for (const b of buildings) {
      const d = distance2D(player.position, b.userData.doorWorld);
      if (d < best) { best = d; closest = b; }
    }
    promptEl.textContent = closest ? `E  ENTER ${closest.userData.name}` : '';
  }
}

function updateMissionHUD() {
  const el = $('missionText');
  if (!el) return;
  if (!mission) {
    el.textContent = 'NO ACTIVE MISSION • PRESS J TO START';
    return;
  }
  el.textContent = `${missionTitle()} • $${mission.reward} • ${mission.type === 'eliminate' ? `${mission.progress}/${mission.goal}` : 'ACTIVE'}`;
}

function drawMap() {
  if (!showMap) return;
  mapCtx.clearRect(0, 0, 220, 220);
  mapCtx.fillStyle = 'rgba(8,11,16,.84)';
  mapCtx.fillRect(0, 0, 220, 220);
  const scale = 0.82;
  const mapPoint = (x, z) => [110 + x * scale, 110 + z * scale];
  mapCtx.strokeStyle = 'rgba(255,255,255,.17)';
  mapCtx.lineWidth = 7;
  for (const [x, z, w, d] of [[0, 0, 240, 26], [0, 55, 240, 26], [0, 27, 26, 240], [55, 27, 26, 240]]) {
    const p = mapPoint(x, z);
    mapCtx.strokeRect(p[0] - w * scale / 2, p[1] - d * scale / 2, w * scale, d * scale);
  }
  for (const b of buildings) {
    const p = mapPoint(b.position.x, b.position.z);
    mapCtx.fillStyle = '#68707c';
    mapCtx.fillRect(p[0] - 8, p[1] - 8, 16, 16);
  }
  for (const car of cars.slice(0, 30)) {
    const p = mapPoint(car.position.x, car.position.z);
    mapCtx.fillStyle = car.userData.police ? '#5e8dff' : (car === currentVehicle ? '#f5c451' : '#9aa2ad');
    mapCtx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
  }
  if (mission && mission.target) {
    const p = mapPoint(mission.target.position.x, mission.target.position.z);
    mapCtx.strokeStyle = '#f5c451';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc(p[0], p[1], 8, 0, Math.PI * 2);
    mapCtx.stroke();
  }
  const pos = currentVehicle ? currentVehicle.position : player.position;
  const p = mapPoint(pos.x, pos.z);
  mapCtx.fillStyle = '#fff';
  mapCtx.beginPath();
  mapCtx.arc(p[0], p[1], 5, 0, Math.PI * 2);
  mapCtx.fill();
}

function updateCamera(dt) {
  const focus = (currentVehicle || player).position.clone();
  focus.y = currentVehicle ? 1.2 : 1.15;
  const distance = currentVehicle ? 8 : 6.5;
  const height = currentVehicle ? 2.7 : 2.55 + cameraPitch * 2;
  const offset = new THREE.Vector3(Math.sin(cameraYaw) * distance, height, Math.cos(cameraYaw) * distance);
  target.copy(focus).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 9));
  camera.lookAt(focus);
}

function updateWorld(dt) {
  dayTime = (dayTime + dt * 0.025) % 24;
  const night = dayTime < 6 || dayTime > 19;
  scene.background.setHex(night ? 0x0d1525 : 0x8ba9c7);
  scene.fog.color.setHex(night ? 0x0d1525 : 0x8ba9c7);
  const sun = scene.getObjectByName('sun');
  if (sun) sun.intensity = night ? 0.17 : 0.78;
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x34402e, 1.1));
  const sun = new THREE.DirectionalLight(0xffe5bd, 0.8);
  sun.name = 'sun';
  sun.position.set(-70, 100, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 300;
  scene.add(sun);
}

function saveGame() {
  const state = {
    health, armor, cash, wanted, player: { x: player.position.x, z: player.position.z },
    weapon: currentWeapon, ammo: weaponAmmo, dayTime
  };
  localStorage.setItem('los-santos-save', JSON.stringify(state));
  flash('GAME SAVED');
}

function loadGame() {
  const raw = localStorage.getItem('los-santos-save');
  if (!raw) return flash('NO SAVE FOUND');
  try {
    const state = JSON.parse(raw);
    health = state.health ?? 100;
    armor = state.armor ?? 25;
    cash = state.cash ?? 2500;
    setWanted(state.wanted ?? 0);
    player.position.set(state.player?.x ?? 0, 0, state.player?.z ?? 12);
    currentWeapon = state.weapon ?? 0;
    if (Array.isArray(state.ammo) && state.ammo.length === weaponAmmo.length) weaponAmmo.splice(0, weaponAmmo.length, ...state.ammo);
    dayTime = state.dayTime ?? 13;
    healthFill.style.width = health + '%';
    cashEl.textContent = '$' + cash.toLocaleString();
    updateWeaponUI();
    flash('GAME LOADED');
  } catch {
    flash('SAVE DATA INVALID');
  }
}

function startGame() {
  started = true;
  paused = false;
  menu.classList.add('hidden');
  pause.classList.add('hidden');
  renderer.domElement.requestPointerLock();
}

function onPointerLockChange() {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && started) {
    paused = true;
    pause.classList.remove('hidden');
  }
}

player = makePlayer();
makeCity();
makeTraffic();
makeNPCs();
setupLights();
setWanted(0);
updateWeaponUI();
cashEl.textContent = '$' + cash.toLocaleString();
healthFill.style.width = '100%';

$('play').addEventListener('click', startGame);
$('resume').addEventListener('click', startGame);
document.addEventListener('pointerlockchange', onPointerLockChange);

window.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (event.code === 'KeyE' && !event.repeat) interact();
  if (event.code === 'KeyF' && !event.repeat && currentVehicle) exitCar();
  if (event.code === 'KeyR' && !event.repeat) reload();
  if (event.code === 'Digit1' && !event.repeat) switchWeapon(0);
  if (event.code === 'Digit2' && !event.repeat) switchWeapon(1);
  if (event.code === 'Digit3' && !event.repeat) switchWeapon(2);
  if (event.code === 'KeyM' && !event.repeat) { showMap = !showMap; minimap.classList.toggle('hidden', !showMap); }
  if (event.code === 'KeyJ' && !event.repeat) startMission();
  if (event.code === 'F5' && !event.repeat) { event.preventDefault(); saveGame(); }
  if (event.code === 'F9' && !event.repeat) { event.preventDefault(); loadGame(); }
  if (event.code === 'Space') event.preventDefault();
});
window.addEventListener('keyup', event => { keys[event.code] = false; });
window.addEventListener('mousedown', event => { if (event.button === 0) fire(); });
window.addEventListener('mousemove', event => {
  if (!locked || paused) return;
  cameraYaw -= event.movementX * 0.0025;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + event.movementY * 0.0018, -0.55, 0.55);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      const w = weapons[currentWeapon];
      const a = weaponAmmo[currentWeapon];
      const amount = Math.min(w.mag - a.ammo, a.reserve);
      a.ammo += amount;
      a.reserve -= amount;
      updateWeaponUI();
      flash(`${w.name} RELOADED`);
    }
  }
  updateOnFoot(dt);
  updateVehicle(dt);
  updateTraffic(dt);
  updateActors(dt);
  updateMission(dt);
  updateCamera(dt);
  updatePrompt();
  updateMissionHUD();
  updateWorld(dt);
  drawMap();
  renderer.render(scene, camera);
}

animate();