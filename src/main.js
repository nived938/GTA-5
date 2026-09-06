import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ba9c7);
scene.fog = new THREE.Fog(0x8ba9c7, 85, 430);

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
const vehicleHud = $('vehicleHud');
const vehicleNameEl = $('vehicleName');
const speedEl = $('speed');
const minimap = $('minimap');
const mapCanvas = $('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');

const missionText = document.createElement('div');
missionText.id = 'missionText';
missionText.style.cssText = 'position:fixed;left:24px;top:100px;max-width:380px;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-shadow:0 2px 8px #000;z-index:11;pointer-events:none;';
document.body.appendChild(missionText);

const world = new THREE.Group();
const city = new THREE.Group();
const interiors = new THREE.Group();
const actors = new THREE.Group();
const vehicles = new THREE.Group();
const fx = new THREE.Group();
scene.add(world, city, interiors, actors, vehicles, fx);

const keys = {};
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const temp = new THREE.Vector3();
const target = new THREE.Vector3();
const aim = new THREE.Vector3();

let locked = false;
let started = false;
let paused = false;
let player = null;
let currentVehicle = null;
let inInterior = false;
let activeBuilding = null;
let showMap = true;
let currentWeapon = 0;
let mission = null;
let health = 100;
let armor = 25;
let cash = 2500;
let wanted = 0;
let wantedDecay = 0;
let dayTime = 13;
let reloadTimer = 0;
let fireCooldown = 0;
let cameraYaw = 0;
let cameraPitch = 0.08;
let jumpVelocity = 0;
let onGround = true;
let walkTime = 0;

const weapons = [
  { name: '9MM', mag: 12, reserve: 120, damage: 50, cooldown: 0.14 },
  { name: 'SMG', mag: 30, reserve: 180, damage: 25, cooldown: 0.075 },
  { name: 'SHOTGUN', mag: 6, reserve: 48, damage: 85, cooldown: 0.55 }
];
const weaponAmmo = weapons.map(w => ({ ammo: w.mag, reserve: w.reserve }));

const colliders = [];
const buildings = [];
const cars = [];

const mats = {
  road: new THREE.MeshStandardMaterial({ color: 0x242932, roughness: 0.94 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x888b89, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x496045, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xb4b1a8, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x41697a, roughness: 0.14, metalness: 0.25 }),
  black: new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.5, metalness: 0.25 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa53b35, roughness: 0.75 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2e5d91, roughness: 0.72 }),
  green: new THREE.MeshStandardMaterial({ color: 0x466c4e, roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb9896c, roughness: 0.9 })
};

function box(w, h, d, material, x, y, z, parent = city) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(r, h, material, x, y, z, parent = city, radial = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, radial), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function addCollider(x, z, w, d) {
  colliders.push({ x, z, w, d });
}

function blocked(x, z, radius = 0.65) {
  return colliders.some(c =>
    Math.abs(x - c.x) < c.w / 2 + radius &&
    Math.abs(z - c.z) < c.d / 2 + radius
  );
}

function vehicleBlocked(x, z, radius = 1.9, ignore = null) {
  if (blocked(x, z, radius)) return true;
  return cars.some(car => car !== ignore && !car.userData.dead && distance2D(car.position, { x, z }) < radius + 2.0);
}

function makeRoads() {
  box(240, 0.16, 26, mats.road, 0, 0, 0);
  box(240, 0.16, 26, mats.road, 0, 0, 55);
  box(26, 0.16, 240, mats.road, 0, 0, 27);
  box(26, 0.16, 240, mats.road, 55, 0, 27);

  [[0, -15.5, 240, 5], [0, 15.5, 240, 5], [0, 39.5, 240, 5], [0, 70.5, 240, 5],
   [-15.5, 27, 5, 240], [15.5, 27, 5, 240], [39.5, 27, 5, 240], [70.5, 27, 5, 240]]
    .forEach(([x, z, w, d]) => box(w, 0.18, d, mats.sidewalk, x, 0.12, z));

  for (let x = -110; x <= 110; x += 14) {
    box(7, 0.03, 0.14, mats.white, x, 0.1, -6.4);
    box(7, 0.03, 0.14, mats.white, x, 0.1, 6.4);
    box(7, 0.03, 0.14, mats.white, x, 0.1, 48.6);
    box(7, 0.03, 0.14, mats.white, x, 0.1, 61.4);
  }
  for (let z = -80; z <= 130; z += 14) {
    box(0.14, 0.03, 7, mats.white, -6.4, 0.1, z);
    box(0.14, 0.03, 7, mats.white, 6.4, 0.1, z);
    box(0.14, 0.03, 7, mats.white, 48.6, 0.1, z);
    box(0.14, 0.03, 7, mats.white, 61.4, 0.1, z);
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
  interior.position.set(x, 0, z);
  interiors.add(interior);
  interior.visible = false;
  box(w - 1, 0.2, d - 1, mats.concrete, 0, 0, 0, interior);
  box(w - 1, 0.2, d - 1, mats.black, 0, 6, 0, interior);
  box(0.2, 6, d - 1, mats.concrete, -(w - 1) / 2, 3, 0, interior);
  box(0.2, 6, d - 1, mats.concrete, (w - 1) / 2, 3, 0, interior);
  box(w - 1, 6, 0.2, mats.concrete, 0, 3, -(d - 1) / 2, interior);

  for (let i = 0; i < 5; i++) {
    box(1.8, 1, 1.8, i % 2 ? mats.blue : mats.red, -w / 3 + i * 3.4, 1, -d / 4, interior);
  }

  group.userData = {
    name,
    interior,
    doorWorld: new THREE.Vector3(x, 0, z + d / 2 + 0.75),
    size: { w, d, h }
  };

  buildings.push(group);
  addCollider(x, z, w + 0.6, d + 0.6);
}

function makeCity() {
  makeRoads();
  box(240, 0.1, 240, mats.grass, 0, -0.08, 27);

  // Buildings are deliberately placed inside city blocks, never across road lanes.
  [
    [-46, -42, 22, 23, 18, 0x7d7268, 'OCEAN VIEW HOTEL'],
    [27, -42, 22, 23, 24, 0x69737e, 'PACIFIC TOWER'],
    [88, -42, 22, 23, 16, 0x796b60, 'EASTSIDE LOFTS'],
    [-46, 28, 22, 22, 14, 0x82776d, 'VESPUCCI MARKET'],
    [27, 28, 22, 22, 20, 0x6c7075, 'ARCADE PLAZA'],
    [88, 28, 22, 22, 18, 0x596a70, 'WESTSIDE OFFICES']
  ].forEach(data => makeBuilding(...data));

  for (let x = -110; x <= 110; x += 11) {
    for (const z of [-18, 18, 42, 72]) {
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
  p.position.set(0, 0, 10);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  p.add(shadow);

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35), new THREE.MeshStandardMaterial({ color: 0x182033, roughness: 0.85 }));
  legs.position.y = 0.58;
  legs.castShadow = true;
  p.add(legs);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.85, 5, 10), new THREE.MeshStandardMaterial({ color: 0x3e4652, roughness: 0.7 }));
  torso.position.y = 1.32;
  torso.castShadow = true;
  p.add(torso);

  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: 0x253b58, roughness: 0.75 }));
  shirt.position.y = 1.57;
  shirt.castShadow = true;
  p.add(shirt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 12), mats.skin);
  head.position.y = 2.12;
  head.castShadow = true;
  p.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    new THREE.MeshStandardMaterial({ color: 0x171717 })
  );
  hair.position.y = 2.25;
  p.add(hair);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.65, 4, 8), new THREE.MeshStandardMaterial({ color: 0x313844 }));
  armL.position.set(-0.53, 1.35, 0);
  armL.castShadow = true;
  p.add(armL);

  const armR = armL.clone();
  armR.position.x = 0.53;
  p.add(armR);

  p.userData.armL = armL;
  p.userData.armR = armR;
  world.add(p);
  return p;
}

function makeCar(x, z, color, rotation = 0, traffic = true, police = false) {
  const car = new THREE.Group();
  car.position.set(x, 0.5, z);
  car.rotation.y = rotation;
  car.userData = {
    speed: traffic ? 5 + Math.random() * 2 : 0,
    traffic,
    police,
    occupied: false,
    dead: false,
    name: police ? 'POLICE CRUISER' : 'SENTINEL'
  };

  // Car body length is X, width is Z. The front is +X at rotation 0.
  box(4.2, 0.78, 1.9, new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.2 }), 0, 0.35, 0, car);
  box(2.05, 0.64, 1.55, mats.glass, 0.15, 0.9, 0, car);

  // Wheels use a Z-axis axle, so they are not rotated 90 degrees incorrectly.
  for (const wx of [-1.42, 1.42]) {
    for (const wz of [-0.94, 0.94]) {
      const wheel = cyl(0.34, 0.22, mats.black, wx, 0.11, wz, car, 14);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      const hub = cyl(0.12, 0.235, mats.concrete, wx, 0.11, wz, car, 12);
      hub.rotation.x = Math.PI / 2;
    }
  }

  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.52), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
  headL.position.set(2.1, 0.45, -0.55);
  const headR = headL.clone();
  headR.position.z = 0.55;
  car.add(headL, headR);

  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x17202b }));
    bar.position.y = 1.3;
    car.add(bar);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.25), new THREE.MeshBasicMaterial({ color: 0x285eff }));
    blue.position.set(-0.25, 1.36, 0);
    const red = blue.clone();
    red.material = new THREE.MeshBasicMaterial({ color: 0xff334c });
    red.position.x = 0.25;
    car.add(blue, red);
  }

  vehicles.add(car);
  cars.push(car);
  return car;
}

function makeTraffic() {
  const colors = [0x9e3434, 0x345f8a, 0xd0c4a5, 0x292d31, 0x64845a, 0x8c6333];
  const horizontalLanes = [-6, 6, 49, 61];
  const verticalLanes = [-6, 6, 49, 61];

  for (let i = 0; i < 36; i++) {
    const horizontal = i % 2 === 0;
    if (horizontal) {
      const lane = horizontalLanes[i % horizontalLanes.length];
      const x = -105 + Math.random() * 210;
      const eastbound = i % 4 < 2;
      makeCar(x, lane, colors[i % colors.length], eastbound ? 0 : Math.PI, true);
    } else {
      const lane = verticalLanes[i % verticalLanes.length];
      const z = -105 + Math.random() * 210;
      const southbound = i % 4 < 2;
      makeCar(lane, z, colors[i % colors.length], southbound ? -Math.PI / 2 : Math.PI / 2, true);
    }
  }
}

function makeNPC(x, z, police = false) {
  const actor = new THREE.Group();
  actor.position.set(x, 1, z);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: police ? 0x294b73 : 0x8a4c41 })
  );
  body.castShadow = true;
  body.userData.actor = actor;
  actor.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mats.skin);
  head.position.y = 0.82;
  head.userData.actor = actor;
  actor.add(head);

  actor.userData = {
    health: 100,
    police,
    dir: Math.random() * Math.PI * 2,
    speed: police ? 2.9 : 1.05,
    shotAt: 0
  };
  actors.add(actor);
  return actor;
}

function makeNPCs() {
  for (let i = 0; i < 36; i++) {
    makeNPC((Math.random() - 0.5) * 205, (Math.random() - 0.5) * 175 + 27);
  }
}

function updateWeaponUI() {
  const weapon = weapons[currentWeapon];
  const ammo = weaponAmmo[currentWeapon];
  $('weaponName').textContent = weapon.name;
  ammoEl.textContent = `${ammo.ammo} / ${ammo.reserve}`;
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
  flash.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function damagePlayer(amount) {
  const armorDamage = Math.min(armor, Math.ceil(amount * 0.55));
  armor -= armorDamage;
  health = Math.max(0, health - (amount - armorDamage));
  healthFill.style.width = `${health}%`;
  document.body.classList.add('damage');
  setTimeout(() => document.body.classList.remove('damage'), 150);
  if (health <= 0) respawn();
}

function respawn() {
  health = 100;
  armor = 25;
  mission = null;
  setWanted(0);
  wantedDecay = 0;
  if (currentVehicle) currentVehicle.userData.occupied = false;
  currentVehicle = null;
  inInterior = false;
  activeBuilding = null;
  for (const building of buildings) {
    building.visible = true;
    building.userData.interior.visible = false;
  }
  player.visible = true;
  player.position.set(0, 0, 10);
  vehicleHud.classList.remove('active');
  healthFill.style.width = '100%';
  locationEl.textContent = 'VESPUCCI DISTRICT';
  flash('WASTED • RESPAWNED');
}

function switchWeapon(index) {
  if (index < 0 || index >= weapons.length) return;
  currentWeapon = index;
  reloadTimer = 0;
  fireCooldown = 0;
  updateWeaponUI();
  flash(`EQUIPPED ${weapons[index].name}`);
}

function reload() {
  const weapon = weapons[currentWeapon];
  const ammo = weaponAmmo[currentWeapon];
  if (reloadTimer > 0 || ammo.ammo >= weapon.mag || ammo.reserve <= 0 || currentVehicle) return;
  reloadTimer = currentWeapon === 2 ? 1.2 : 0.9;
}

function fire() {
  if (!locked || !started || paused || currentVehicle || reloadTimer > 0 || fireCooldown > 0) return;
  const weapon = weapons[currentWeapon];
  const ammo = weaponAmmo[currentWeapon];
  if (ammo.ammo <= 0) return reload();

  ammo.ammo--;
  fireCooldown = weapon.cooldown;
  updateWeaponUI();

  const origin = camera.position.clone();
  camera.getWorldDirection(aim);
  const pellets = currentWeapon === 2 ? 7 : 1;
  let hitAnything = false;

  for (let i = 0; i < pellets; i++) {
    const spread = currentWeapon === 2 ? 0.09 : 0.012;
    const shot = aim.clone();
    shot.x += (Math.random() - 0.5) * spread;
    shot.y += (Math.random() - 0.5) * spread;
    shot.normalize();
    raycaster.set(origin, shot);

    const hit = raycaster.intersectObjects(actors.children, true).find(h => h.object.userData.actor);
    if (!hit) continue;
    hitAnything = true;

    const actor = hit.object.userData.actor;
    actor.userData.health -= weapon.damage;
    actor.userData.shotAt = performance.now();
    hitFX(hit.point);

    if (actor.userData.health <= 0) {
      const police = actor.userData.police;
      actor.removeFromParent();
      cash += police ? 75 : 25;
      cashEl.textContent = '$' + cash.toLocaleString();
      missionProgress('eliminate');
      setWanted(wanted + (police ? 2 : 1));
    }
  }

  if (!hitAnything) tracer(origin, origin.clone().add(aim.multiplyScalar(42)));
}

function tracer(a, b) {
  const d = b.clone().sub(a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  mesh.position.copy(a.clone().add(d.normalize().multiplyScalar(3)));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  fx.add(mesh);
  setTimeout(() => mesh.removeFromParent(), 55);
}

function hitFX(point) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let i = 0; i < 4; i++) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.65), material);
    spark.rotation.y = i * Math.PI / 2;
    group.add(spark);
  }
  group.position.copy(point);
  fx.add(group);
  setTimeout(() => group.removeFromParent(), 90);
}

function nearestCar() {
  let best = null;
  let bestDistance = 4.2;
  for (const car of cars) {
    if (car.userData.occupied || car.userData.dead) continue;
    const d = distance2D(player.position, car.position);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
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
  setWanted(wanted + (car.userData.police ? 2 : 1));
  flash(`ENTERED ${car.userData.name}`);
}

function exitCar() {
  if (!currentVehicle) return;
  const car = currentVehicle;
  const side = new THREE.Vector3(0, 0, 2.5).applyQuaternion(car.quaternion);
  let exitPosition = car.position.clone().add(side);
  if (blocked(exitPosition.x, exitPosition.z, 0.7)) {
    exitPosition = car.position.clone().add(new THREE.Vector3(0, 0, -2.5).applyQuaternion(car.quaternion));
  }
  player.position.copy(exitPosition);
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
  player.visible = true;
  player.position.copy(building.position);
  player.position.y = 0;
  locationEl.textContent = building.userData.name;
  flash(`ENTERED ${building.userData.name}`);
}

function exitBuilding() {
  if (!inInterior || !activeBuilding) return;
  const building = activeBuilding;
  building.visible = true;
  building.userData.interior.visible = false;
  player.position.copy(building.userData.doorWorld);
  player.position.y = 0;
  inInterior = false;
  activeBuilding = null;
  locationEl.textContent = 'VESPUCCI DISTRICT';
}

function interact() {
  if (inInterior) return exitBuilding();
  if (currentVehicle) return exitCar();

  const car = nearestCar();
  if (car) return enterCar(car);

  let closest = null;
  let best = 4.5;
  for (const building of buildings) {
    const d = distance2D(player.position, building.userData.doorWorld);
    if (d < best) {
      best = d;
      closest = building;
    }
  }
  if (closest) enterBuilding(closest);
}

function updateOnFoot(dt) {
  if (!locked || paused || inInterior || currentVehicle) return;

  let x = 0;
  let z = 0;
  if (keys.KeyW) z += 1;
  if (keys.KeyS) z -= 1;
  if (keys.KeyA) x -= 1;
  if (keys.KeyD) x += 1;

  if (x || z) {
    const length = Math.hypot(x, z);
    x /= length;
    z /= length;

    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const movement = forward.multiplyScalar(z).add(right.multiplyScalar(x));
    const sprint = keys.ShiftLeft || keys.ShiftRight;
    const speed = sprint ? 8.5 : 5.2;
    const nx = player.position.x + movement.x * speed * dt;
    const nz = player.position.z + movement.z * speed * dt;

    if (!blocked(nx, nz, 0.68)) {
      player.position.x = nx;
      player.position.z = nz;
    }

    player.rotation.y = Math.atan2(movement.x, movement.z);
    walkTime += dt * (sprint ? 12 : 8);
    player.userData.armL.rotation.x = Math.sin(walkTime) * 0.55;
    player.userData.armR.rotation.x = -Math.sin(walkTime) * 0.55;
  } else {
    player.userData.armL.rotation.x *= 0.84;
    player.userData.armR.rotation.x *= 0.84;
  }

  if (keys.Space && onGround) {
    jumpVelocity = 6;
    onGround = false;
  }
  jumpVelocity -= 15 * dt;
  player.position.y += jumpVelocity * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    jumpVelocity = 0;
    onGround = true;
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -116, 116);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -112, 142);
}

function updateVehicle(dt) {
  if (!currentVehicle || !locked || paused) return;

  const car = currentVehicle;
  const accelerate = keys.KeyW ? 1 : keys.KeyS ? -1 : 0;
  const boost = keys.ShiftLeft || keys.ShiftRight ? 1.35 : 1;
  const maxSpeed = 18 * boost;
  const targetSpeed = accelerate * maxSpeed;
  car.userData.speed = THREE.MathUtils.lerp(car.userData.speed, targetSpeed, accelerate ? 0.08 : 0.045);

  const steering = (keys.KeyA ? -1 : 0) + (keys.KeyD ? 1 : 0);
  const reverse = car.userData.speed < 0 ? -1 : 1;
  if (Math.abs(car.userData.speed) > 0.35) {
    car.rotation.y += steering * dt * (1.1 + Math.abs(car.userData.speed) / 20) * reverse;
  }

  // Vehicle front is +X at rotation 0, so movement matches the visible car body.
  const heading = new THREE.Vector3(Math.cos(car.rotation.y), 0, Math.sin(car.rotation.y));
  const next = car.position.clone().add(heading.multiplyScalar(car.userData.speed * dt));

  if (!vehicleBlocked(next.x, next.z, 1.9, car) && Math.abs(next.x) < 118 && Math.abs(next.z) < 116) {
    car.position.copy(next);
  } else {
    car.userData.speed *= 0.25;
  }

  speedEl.textContent = `${Math.round(Math.abs(car.userData.speed) * 4.9)} KM/H`;
  car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, -steering * 0.035, dt * 7);
}

function updateTraffic(dt) {
  for (const car of cars) {
    if (car === currentVehicle || !car.userData.traffic || car.userData.dead) continue;

    const heading = new THREE.Vector3(Math.cos(car.rotation.y), 0, Math.sin(car.rotation.y));
    const next = car.position.clone().add(heading.multiplyScalar(car.userData.speed * dt));

    // Never allow ambient cars to cross building collision boxes.
    if (!vehicleBlocked(next.x, next.z, 1.85, car)) {
      car.position.copy(next);
    } else {
      car.userData.speed = Math.max(2.5, car.userData.speed * 0.82);
      car.position.add(heading.multiplyScalar(-0.35));
    }

    // Wrap only after a car has completely left the road network.
    if (car.position.x > 124) car.position.x = -123;
    if (car.position.x < -124) car.position.x = 123;
    if (car.position.z > 148) car.position.z = -119;
    if (car.position.z < -120) car.position.z = 147;
  }
}

function spawnPolice() {
  const center = currentVehicle ? currentVehicle.position : player.position;
  const angle = Math.random() * Math.PI * 2;
  const distance = 34 + Math.random() * 18;
  makeNPC(center.x + Math.cos(angle) * distance, center.z + Math.sin(angle) * distance, true);
  if (wanted >= 2) {
    makeCar(center.x + Math.cos(angle) * (distance + 5), center.z + Math.sin(angle) * (distance + 5), 0x243b5c, angle, false, true);
  }
}

function updateActors(dt) {
  for (const actor of [...actors.children]) {
    const u = actor.userData;
    const position = currentVehicle ? currentVehicle.position : player.position;
    const distance = distance2D(actor.position, position);

    if (u.police) {
      temp.subVectors(position, actor.position).setY(0);
      if (temp.length() > 7) actor.position.add(temp.normalize().multiplyScalar(u.speed * dt));
      actor.lookAt(position.x, actor.position.y, position.z);
      if (wanted > 0 && distance < 22 && performance.now() - u.shotAt > 1600) {
        u.shotAt = performance.now();
        damagePlayer(5 + wanted);
      }
    } else {
      u.dir += (Math.random() - 0.5) * dt * 0.7;
      const nextX = actor.position.x + Math.cos(u.dir) * u.speed * dt;
      const nextZ = actor.position.z + Math.sin(u.dir) * u.speed * dt;
      if (!blocked(nextX, nextZ, 0.5)) {
        actor.position.x = nextX;
        actor.position.z = nextZ;
      } else {
        u.dir += Math.PI * 0.6;
      }
      if (Math.abs(actor.position.x) > 112 || Math.abs(actor.position.z) > 118) u.dir += Math.PI;
    }
  }

  if (wanted > 0) {
    const nearby = actors.children.some(a => a.userData.police && distance2D(a.position, currentVehicle ? currentVehicle.position : player.position) < 38);
    wantedDecay = nearby ? 0 : wantedDecay + dt;
    if (wantedDecay > 12) {
      setWanted(wanted - 1);
      wantedDecay = 0;
    }

    const policeCount = actors.children.filter(a => a.userData.police).length;
    if (policeCount < Math.ceil(wanted / 2) && Math.random() < dt * 0.7) spawnPolice();
  }
}

function startMission() {
  if (mission) return flash('MISSION ALREADY ACTIVE');
  const type = Math.random() > 0.5 ? 'reach' : 'eliminate';
  mission = {
    type,
    target: buildings[Math.floor(Math.random() * buildings.length)],
    progress: 0,
    goal: 3,
    reward: 700 + Math.floor(Math.random() * 600)
  };
  flash(`MISSION STARTED • ${type === 'reach' ? 'REACH DESTINATION' : 'ELIMINATE TARGETS'}`);
}

function missionProgress(type) {
  if (!mission || mission.type !== type) return;
  mission.progress++;
  if (mission.progress >= mission.goal) completeMission();
}

function completeMission() {
  cash += mission.reward;
  cashEl.textContent = '$' + cash.toLocaleString();
  flash(`MISSION PASSED • +$${mission.reward.toLocaleString()}`);
  mission = null;
}

function updateMission() {
  if (!mission) {
    missionText.textContent = 'NO ACTIVE MISSION • PRESS J';
    return;
  }
  if (mission.type === 'reach' && distance2D(player.position, mission.target.position) < 8) completeMission();
  missionText.textContent = mission.type === 'reach'
    ? `MISSION • REACH ${mission.target.userData.name} • $${mission.reward}`
    : `MISSION • ELIMINATE ${mission.progress}/${mission.goal} • $${mission.reward}`;
}

function updatePrompt() {
  if (currentVehicle) {
    promptEl.textContent = 'F / E  EXIT VEHICLE';
    return;
  }
  if (inInterior) {
    promptEl.textContent = 'E  EXIT BUILDING';
    return;
  }
  const car = nearestCar();
  if (car) {
    promptEl.textContent = 'E  ENTER VEHICLE';
    return;
  }
  let closest = null;
  let best = 4.5;
  for (const building of buildings) {
    const d = distance2D(player.position, building.userData.doorWorld);
    if (d < best) {
      best = d;
      closest = building;
    }
  }
  promptEl.textContent = closest ? `E  ENTER ${closest.userData.name}` : '';
}

function drawMap() {
  if (!showMap) return;
  mapCtx.clearRect(0, 0, 220, 220);
  mapCtx.fillStyle = 'rgba(8,11,16,.84)';
  mapCtx.fillRect(0, 0, 220, 220);

  const scale = 0.82;
  const point = (x, z) => [110 + x * scale, 110 + z * scale];
  mapCtx.strokeStyle = 'rgba(255,255,255,.17)';
  mapCtx.lineWidth = 7;

  for (const [x, z, w, d] of [[0, 0, 240, 26], [0, 55, 240, 26], [0, 27, 26, 240], [55, 27, 26, 240]]) {
    const p = point(x, z);
    mapCtx.strokeRect(p[0] - w * scale / 2, p[1] - d * scale / 2, w * scale, d * scale);
  }

  for (const building of buildings) {
    const p = point(building.position.x, building.position.z);
    mapCtx.fillStyle = '#69737e';
    mapCtx.fillRect(p[0] - 8, p[1] - 8, 16, 16);
  }

  for (const car of cars.slice(0, 40)) {
    const p = point(car.position.x, car.position.z);
    mapCtx.fillStyle = car.userData.police ? '#5e8dff' : car === currentVehicle ? '#f5c451' : '#9aa2ad';
    mapCtx.fillRect(p[0] - 2, p[1] - 2, 4, 4);
  }

  if (mission) {
    const p = point(mission.target.position.x, mission.target.position.z);
    mapCtx.strokeStyle = '#f5c451';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc(p[0], p[1], 9, 0, Math.PI * 2);
    mapCtx.stroke();
  }

  const position = currentVehicle ? currentVehicle.position : player.position;
  const p = point(position.x, position.z);
  mapCtx.fillStyle = '#fff';
  mapCtx.beginPath();
  mapCtx.arc(p[0], p[1], 5, 0, Math.PI * 2);
  mapCtx.fill();
}

function updateCamera(dt) {
  const focus = (currentVehicle || player).position.clone();
  focus.y = currentVehicle ? 1.3 : 1.35;
  const distance = currentVehicle ? 8.8 : 7;
  const height = currentVehicle ? 3 : 2.65 + cameraPitch * 2;
  const offset = new THREE.Vector3(Math.sin(cameraYaw) * distance, height, Math.cos(cameraYaw) * distance);
  target.copy(focus).add(offset);
  camera.position.lerp(target, Math.min(1, dt * 9));
  camera.lookAt(focus);
}

function updateWorld(dt) {
  dayTime = (dayTime + dt * 0.02) % 24;
  const night = dayTime < 6 || dayTime > 19;
  const sky = night ? 0x0d1525 : 0x8ba9c7;
  scene.background.setHex(sky);
  scene.fog.color.setHex(sky);
  const sun = scene.getObjectByName('sun');
  if (sun) sun.intensity = night ? 0.17 : 0.78;
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x34402e, 1.12));
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
  localStorage.setItem('los-santos-save', JSON.stringify({
    health,
    armor,
    cash,
    wanted,
    weapon: currentWeapon,
    ammo: weaponAmmo,
    dayTime,
    player: { x: player.position.x, z: player.position.z }
  }));
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
    currentWeapon = state.weapon ?? 0;
    if (Array.isArray(state.ammo) && state.ammo.length === weaponAmmo.length) {
      weaponAmmo.splice(0, weaponAmmo.length, ...state.ammo);
    }
    dayTime = state.dayTime ?? 13;
    player.position.set(state.player?.x ?? 0, 0, state.player?.z ?? 10);
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

function pointerLockChanged() {
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
missionText.textContent = 'NO ACTIVE MISSION • PRESS J';

$('play').addEventListener('click', startGame);
$('resume').addEventListener('click', startGame);
document.addEventListener('pointerlockchange', pointerLockChanged);

window.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (event.code === 'KeyE' && !event.repeat) interact();
  if (event.code === 'KeyF' && !event.repeat && currentVehicle) exitCar();
  if (event.code === 'KeyR' && !event.repeat) reload();
  if (event.code === 'Digit1' && !event.repeat) switchWeapon(0);
  if (event.code === 'Digit2' && !event.repeat) switchWeapon(1);
  if (event.code === 'Digit3' && !event.repeat) switchWeapon(2);
  if (event.code === 'KeyM' && !event.repeat) {
    showMap = !showMap;
    minimap.classList.toggle('hidden', !showMap);
  }
  if (event.code === 'KeyJ' && !event.repeat) startMission();
  if (event.code === 'F5' && !event.repeat) {
    event.preventDefault();
    saveGame();
  }
  if (event.code === 'F9' && !event.repeat) {
    event.preventDefault();
    loadGame();
  }
  if (event.code === 'Space') event.preventDefault();
});

window.addEventListener('keyup', event => {
  keys[event.code] = false;
});

window.addEventListener('mousedown', event => {
  if (event.button === 0) fire();
});

window.addEventListener('mousemove', event => {
  if (!locked || paused) return;
  cameraYaw -= event.movementX * 0.0025;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + event.movementY * 0.0018, -0.45, 0.5);
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
      const weapon = weapons[currentWeapon];
      const ammo = weaponAmmo[currentWeapon];
      const amount = Math.min(weapon.mag - ammo.ammo, ammo.reserve);
      ammo.ammo += amount;
      ammo.reserve -= amount;
      updateWeaponUI();
      flash(`${weapon.name} RELOADED`);
    }
  }

  updateOnFoot(dt);
  updateVehicle(dt);
  updateTraffic(dt);
  updateActors(dt);
  updateMission();
  updateCamera(dt);
  updatePrompt();
  updateWorld(dt);
  drawMap();
  renderer.render(scene, camera);
}

animate();