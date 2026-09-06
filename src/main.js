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
const menu = $('menu'), pause = $('pause'), promptEl = $('prompt'), ammoEl = $('ammo');
const healthFill = $('healthFill'), wantedEl = $('wanted'), cashEl = $('cash'), locationEl = $('location');
const vehicleHud = $('vehicleHud'), vehicleNameEl = $('vehicleName'), speedEl = $('speed');
const minimap = $('minimap'), mapCanvas = $('mapCanvas'), mapCtx = mapCanvas.getContext('2d');

const missionText = document.createElement('div');
missionText.id = 'missionText';
missionText.style.cssText = 'position:fixed;left:24px;top:100px;max-width:360px;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-shadow:0 2px 8px #000;z-index:11;pointer-events:none;';
document.body.appendChild(missionText);

const world = new THREE.Group(), city = new THREE.Group(), interiors = new THREE.Group();
const actors = new THREE.Group(), vehicles = new THREE.Group(), fx = new THREE.Group();
scene.add(world, city, interiors, actors, vehicles, fx);

const keys = {};
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const temp = new THREE.Vector3(), target = new THREE.Vector3(), aim = new THREE.Vector3();

let locked = false, started = false, paused = false;
let health = 100, armor = 25, fireCooldown = 0, reloadTimer = 0;
let wanted = 0, wantedDecay = 0, cash = 2500, dayTime = 13;
let cameraYaw = 0, cameraPitch = 0.08;
let player = null, currentVehicle = null, inInterior = false, activeBuilding = null;
let showMap = true, currentWeapon = 0, mission = null;
let jumpVelocity = 0, onGround = true, walkTime = 0;

const weapons = [
  { name: '9MM', mag: 12, reserve: 120, damage: 50, cooldown: 0.14 },
  { name: 'SMG', mag: 30, reserve: 180, damage: 25, cooldown: 0.075 },
  { name: 'SHOTGUN', mag: 6, reserve: 48, damage: 85, cooldown: 0.55 }
];
const weaponAmmo = weapons.map(w => ({ ammo: w.mag, reserve: w.reserve }));

const colliders = [], buildings = [], cars = [];
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
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cyl(r, h, material, x, y, z, parent = city) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const addCollider = (x, z, w, d) => colliders.push({ x, z, w, d });
function blocked(x, z, radius = .65) {
  return colliders.some(c => Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius);
}

function makeCity() {
  box(240, .16, 26, mats.road, 0, 0, 0); box(240, .16, 26, mats.road, 0, 0, 55);
  box(26, .16, 240, mats.road, 0, 0, 27); box(26, .16, 240, mats.road, 55, 0, 27);
  [[0,-15.5,240,5],[0,15.5,240,5],[0,39.5,240,5],[0,70.5,240,5],[-15.5,27,5,240],[15.5,27,5,240],[39.5,27,5,240],[70.5,27,5,240]].forEach(([x,z,w,d]) => box(w,.18,d,mats.sidewalk,x,.12,z));
  for(let x=-110;x<=110;x+=14){box(7,.03,.14,mats.concrete,x,.1,-.8);box(7,.03,.14,mats.concrete,x,.1,55.8)}
  for(let z=-80;z<=130;z+=14){box(.14,.03,7,mats.concrete,-.8,.1,z);box(.14,.03,7,mats.concrete,55.8,.1,z)}
  box(240,.1,240,mats.grass,0,-.08,27);

  const data=[[-46,-45,24,25,18,0x7d7268,'OCEAN VIEW HOTEL'],[47,-45,24,25,26,0x69737e,'PACIFIC TOWER'],[-47,42,25,25,13,0x82776d,'VESPUCCI MARKET'],[47,42,25,25,20,0x6c7075,'ARCADE PLAZA'],[92,10,28,22,16,0x796b60,'EASTSIDE LOFTS'],[-92,10,28,22,22,0x596a70,'WESTSIDE OFFICES']];
  data.forEach(v => makeBuilding(...v));
  for(let x=-110;x<=110;x+=11) for(const z of [-12.5,12.5,42.5,72.5]) { if(Math.abs(x)<20 && z<60) continue; cyl(.18,5,mats.black,x,2.5,z); cyl(.48,.08,mats.red,x,5.1,z); }
  for(let i=0;i<55;i++){const x=(Math.random()-.5)*220,z=(Math.random()-.5)*210+27;if(Math.abs(x%55)<19||Math.abs(z%55)<19)continue;cyl(.22,2.8,new THREE.MeshStandardMaterial({color:0x594438}),x,1.4,z);const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55,1),mats.green);c.position.set(x,3.3,z);c.castShadow=true;city.add(c)}
}

function makeBuilding(x,z,w,d,h,color,name) {
  const group=new THREE.Group(); group.position.set(x,0,z); city.add(group);
  box(w,h,d,new THREE.MeshStandardMaterial({color,roughness:.84}),0,h/2,0,group);
  for(let y=3;y<h-1;y+=3.1) for(let px=-w/2+2.2;px<w/2-1;px+=4.4){box(2.2,1.25,.08,mats.glass,px,y,d/2+.04,group);box(2.2,1.25,.08,mats.glass,px,y,-d/2-.04,group)}
  const door=box(2.3,2.9,.16,mats.black,0,1.45,d/2+.1,group); door.userData.building=group;
  box(Math.min(w-4,11),1,.16,mats.red,0,Math.min(h-1.1,8),d/2+.17,group);
  const interior=new THREE.Group(); interior.position.set(x,0,z+.1); interiors.add(interior); interior.visible=false;
  box(w-1,.2,d-1,mats.concrete,0,0,0,interior); box(w-1,.2,d-1,mats.black,0,6,0,interior);
  box(.2,6,d-1,mats.concrete,-(w-1)/2,3,0,interior); box(.2,6,d-1,mats.concrete,(w-1)/2,3,0,interior);
  box(w-1,6,.2,mats.concrete,0,3,-(d-1)/2,interior);
  for(let i=0;i<5;i++)box(1.8,1,1.8,i%2?mats.blue:mats.red,-w/3+i*3.4,1,-d/4,interior);
  group.userData={name,interior,doorWorld:new THREE.Vector3(x,0,z+d/2+.75)};
  buildings.push(group); addCollider(x,z,w,d);
}

function makePlayer() {
  const p=new THREE.Group(); p.position.set(0,0,12);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;p.add(shadow);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.6,.75,.35),new THREE.MeshStandardMaterial({color:0x182033,roughness:.85}));legs.position.y=.58;legs.castShadow=true;p.add(legs);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.43,.85,5,10),new THREE.MeshStandardMaterial({color:0x3e4652,roughness:.7}));torso.position.y=1.32;torso.castShadow=true;p.add(torso);
  const shirt=new THREE.Mesh(new THREE.BoxGeometry(.68,.4,.42),new THREE.MeshStandardMaterial({color:0x253b58,roughness:.75}));shirt.position.y=1.57;shirt.castShadow=true;p.add(shirt);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,14,12),mats.skin);head.position.y=2.12;head.castShadow=true;p.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.32,14,8,0,Math.PI*2,0,Math.PI*.45),new THREE.MeshStandardMaterial({color:0x171717}));hair.position.y=2.25;p.add(hair);
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.65,4,8),new THREE.MeshStandardMaterial({color:0x313844}));armL.position.set(-.53,1.35,0);armL.rotation.z=-.15;armL.castShadow=true;p.add(armL);p.userData.armL=armL;
  const armR=armL.clone();armR.position.x=.53;armR.rotation.z=.15;p.add(armR);p.userData.armR=armR;
  world.add(p); return p;
}

function makeCar(x,z,color,rotation=0,traffic=true,police=false){
  const g=new THREE.Group(); g.position.set(x,.5,z); g.rotation.y=rotation;
  g.userData={speed:traffic?3.5+Math.random()*3:0,traffic,occupied:false,name:police?'POLICE CRUISER':'SENTINEL',police,turnCooldown:0};
  box(4.2,.78,1.9,new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.2}),0,.35,0,g);
  box(2.05,.64,1.55,mats.glass,-.2,.9,0,g);
  for(const wx of[-1.42,1.42])for(const wz of[-.93,.93])cyl(.34,.18,mats.black,wx,.11,wz,g).rotation.z=Math.PI/2;
  const headL=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.52),new THREE.MeshBasicMaterial({color:0xffe0a0}));headL.position.set(2.1,.45,-.55);
  const headR=headL.clone();headR.position.z=.55;g.add(headL,headR);
  if(police){const bar=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.28),new THREE.MeshStandardMaterial({color:0x17202b}));bar.position.y=1.3;g.add(bar);const a=new THREE.Mesh(new THREE.BoxGeometry(.25,.11,.25),new THREE.MeshBasicMaterial({color:0x285eff}));a.position.set(-.25,1.36,0);const b=a.clone();b.material=new THREE.MeshBasicMaterial({color:0xff334c});b.position.x=.25;g.add(a,b);}
  vehicles.add(g);cars.push(g);return g;
}
function makeTraffic(){const colors=[0x9e3434,0x345f8a,0xd0c4a5,0x292d31,0x64845a,0x8c6333];for(let i=0;i<34;i++){const horizontal=i%2===0,p=-105+Math.random()*210;makeCar(horizontal?p:(i%4<2?7:48),horizontal?(i%4<2?7:48):p,colors[i%colors.length],horizontal?Math.PI/2:0,true)}}
function makeNPC(x,z,police=false){const g=new THREE.Group();g.position.set(x,1,z);const body=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.9,4,8),new THREE.MeshStandardMaterial({color:police?0x294b73:0x8a4c41}));body.castShadow=true;body.userData.actor=g;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),mats.skin);head.position.y=.82;head.userData.actor=g;g.add(head);g.userData={health:100,police,dir:Math.random()*Math.PI*2,speed:police?2.9:1.05,shotAt:0};actors.add(g);return g}
function makeNPCs(){for(let i=0;i<36;i++)makeNPC((Math.random()-.5)*205,(Math.random()-.5)*175+27)}

function setWanted(v){wanted=THREE.MathUtils.clamp(Math.round(v),0,5);wantedEl.textContent='★'.repeat(wanted)+'☆'.repeat(5-wanted);wantedEl.style.color=wanted?'#f3d35a':'#657080'}
function updateWeaponUI(){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];$('weaponName').textContent=w.name;ammoEl.textContent=`${a.ammo} / ${a.reserve}`}
function flash(text){let toast=$('toast');if(!toast){toast=document.createElement('div');toast.id='toast';toast.className='toast';document.body.appendChild(toast)}toast.textContent=text;toast.classList.add('show');clearTimeout(flash.timer);flash.timer=setTimeout(()=>toast.classList.remove('show'),1700)}
function damagePlayer(amount){const blockedAmount=Math.min(armor,Math.ceil(amount*.55));armor-=blockedAmount;health=Math.max(0,health-(amount-blockedAmount));healthFill.style.width=health+'%';document.body.classList.add('damage');setTimeout(()=>document.body.classList.remove('damage'),150);if(health<=0)respawn()}
function respawn(){health=100;armor=25;setWanted(0);mission=null;if(currentVehicle){currentVehicle.userData.occupied=false;currentVehicle=null}for(const b of buildings){b.visible=true;b.userData.interior.visible=false}inInterior=false;activeBuilding=null;player.visible=true;player.position.set(0,0,12);vehicleHud.classList.remove('active');healthFill.style.width='100%';locationEl.textContent='VESPUCCI DISTRICT';flash('WASTED • RESPAWNED')}
function switchWeapon(i){if(i<0||i>=weapons.length)return;currentWeapon=i;reloadTimer=0;updateWeaponUI();flash(`EQUIPPED ${weapons[i].name}`)}
function reload(){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];if(reloadTimer>0||a.ammo>=w.mag||a.reserve<=0||currentVehicle)return;reloadTimer=currentWeapon===2?1.2:.9}

function fire(){if(!locked||!started||paused||currentVehicle||reloadTimer>0||fireCooldown>0)return;const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];if(a.ammo<=0){reload();return}a.ammo--;fireCooldown=w.cooldown;updateWeaponUI();const origin=camera.position.clone();camera.getWorldDirection(aim);const pellets=currentWeapon===2?7:1;let any=false;for(let i=0;i<pellets;i++){const shot=aim.clone();const spread=currentWeapon===2?.09:.012;shot.x+=(Math.random()-.5)*spread;shot.y+=(Math.random()-.5)*spread;shot.normalize();raycaster.set(origin,shot);const hit=raycaster.intersectObjects(actors.children,true).find(h=>h.object.userData.actor);if(hit){any=true;const actor=hit.object.userData.actor;actor.userData.health-=w.damage;actor.userData.shotAt=performance.now();if(actor.userData.health<=0){const police=actor.userData.police;actor.removeFromParent();cash+=police?75:25;cashEl.textContent='$'+cash.toLocaleString();missionProgress('eliminate')}hitFX(hit.point)}}if(!any)tracer(origin,origin.clone().add(aim.multiplyScalar(42)));setWanted(wanted+(any?1:0))}
function tracer(a,b){const d=b.clone().sub(a);const m=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,6,5),new THREE.MeshBasicMaterial({color:0xffd27a}));m.position.copy(a.clone().add(d.normalize().multiplyScalar(3)));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());fx.add(m);setTimeout(()=>m.removeFromParent(),55)}
function hitFX(point){const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:0xffd27a});for(let i=0;i<4;i++){const q=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.65),m);q.rotation.y=i*Math.PI/2;g.add(q)}g.position.copy(point);fx.add(g);setTimeout(()=>g.removeFromParent(),90)}

function nearestCar(){let best=null,bd=4;for(const c of cars)if(!c.userData.occupied&&!c.userData.police||(!c.userData.occupied&&c.userData.police&&wanted===0)){const d=distance2D(player.position,c.position);if(d<bd){bd=d;best=c}}return best}
function enterCar(car){currentVehicle=car;car.userData.occupied=true;player.visible=false;vehicleHud.classList.add('active');vehicleNameEl.textContent=car.userData.name;locationEl.textContent='CITY STREETS';if(car.userData.police)setWanted(wanted+2);else setWanted(wanted+1);flash(`ENTERED ${car.userData.name}`)}
function exitCar(){if(!currentVehicle)return;const car=currentVehicle;const side=new THREE.Vector3(2.7,0,0).applyQuaternion(car.quaternion);player.position.copy(car.position).add(side);player.position.y=0;player.visible=true;car.userData.occupied=false;currentVehicle=null;vehicleHud.classList.remove('active');}
function enterBuilding(b){inInterior=true;activeBuilding=b;b.visible=false;b.userData.interior.visible=true;player.position.set(b.position.x,0,b.position.z);locationEl.textContent=b.userData.name;flash(`ENTERED ${b.userData.name}`)}
function exitBuilding(){if(!inInterior||!activeBuilding)return;const b=activeBuilding;b.visible=true;b.userData.interior.visible=false;player.position.copy(b.userData.doorWorld);player.position.y=0;inInterior=false;activeBuilding=null;locationEl.textContent='VESPUCCI DISTRICT'}
function interact(){if(inInterior){exitBuilding();return}if(currentVehicle){exitCar();return}const car=nearestCar();if(car){enterCar(car);return}let best=null,bd=4.5;for(const b of buildings){const d=distance2D(player.position,b.userData.doorWorld);if(d<bd){bd=d;best=b}}if(best)enterBuilding(best)}

function updateOnFoot(dt){if(!locked||paused||inInterior||currentVehicle)return;let x=0,z=0;if(keys.KeyW)z+=1;if(keys.KeyS)z-=1;if(keys.KeyA)x-=1;if(keys.KeyD)x+=1;if(x||z){const len=Math.hypot(x,z);x/=len;z/=len;const forward=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));const right=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));const velocity=forward.multiplyScalar(z).add(right.multiplyScalar(x));const sprint=keys.ShiftLeft||keys.ShiftRight;const speed=sprint?8.5:5.2;const nx=player.position.x+velocity.x*speed*dt,nz=player.position.z+velocity.z*speed*dt;if(!blocked(nx,nz,.68)){player.position.x=nx;player.position.z=nz}player.rotation.y=Math.atan2(velocity.x,velocity.z);walkTime+=dt*(sprint?12:8);player.userData.armL.rotation.x=Math.sin(walkTime)*.55;player.userData.armR.rotation.x=-Math.sin(walkTime)*.55}else{player.userData.armL.rotation.x*=.85;player.userData.armR.rotation.x*=.85}if(keys.Space&&onGround){jumpVelocity=6;onGround=false}jumpVelocity-=15*dt;player.position.y+=jumpVelocity*dt;if(player.position.y<=0){player.position.y=0;jumpVelocity=0;onGround=true}player.position.x=THREE.MathUtils.clamp(player.position.x,-116,116);player.position.z=THREE.MathUtils.clamp(player.position.z,-112,142)}

function updateVehicle(dt){if(!currentVehicle||!locked||paused)return;const car=currentVehicle;const accelerate=keys.KeyW?1:keys.KeyS?-1:0;const boost=keys.ShiftLeft||keys.ShiftRight?1.35:1;const maxSpeed=16*boost;const targetSpeed=accelerate*maxSpeed;car.userData.speed=THREE.MathUtils.lerp(car.userData.speed,targetSpeed,accelerate?0.075:0.045);const steering=(keys.KeyA?-1:0)+(keys.KeyD?1:0);const reverse=car.userData.speed<0?-1:1;if(Math.abs(car.userData.speed)>.4)car.rotation.y+=steering*dt*(1.15+Math.abs(car.userData.speed)/20)*reverse;const heading=new THREE.Vector3(-Math.sin(car.rotation.y),0,-Math.cos(car.rotation.y));const next=car.position.clone().add(heading.multiplyScalar(car.userData.speed*dt));if(blocked(next.x,next.z,1.9)||Math.abs(next.x)>118||Math.abs(next.z)>116){car.userData.speed*=.35}else car.position.copy(next);speedEl.textContent=`${Math.round(Math.abs(car.userData.speed)*4.9)} KM/H`;car.rotation.z=THREE.MathUtils.lerp(car.rotation.z,-steering*.035,dt*7);}
function updateTraffic(dt){for(const car of cars){if(car===currentVehicle||!car.userData.traffic)continue;const heading=new THREE.Vector3(-Math.sin(car.rotation.y),0,-Math.cos(car.rotation.y));car.position.add(heading.multiplyScalar(car.userData.speed*dt));if(car.position.x>122||car.position.x<-122)car.position.x=car.position.x>0?-120:120;if(car.position.z>146||car.position.z<-116)car.position.z=car.position.z>0?-114:144}}
function spawnPolice(){const p=currentVehicle?currentVehicle.position:player.position,angle=Math.random()*Math.PI*2,dist=34+Math.random()*18;makeNPC(p.x+Math.cos(angle)*dist,p.z+Math.sin(angle)*dist,true);if(wanted>=2)makeCar(p.x+Math.cos(angle)*dist,p.z+Math.sin(angle)*dist,0x243b5c,angle+Math.PI/2,false,true)}
function updateActors(dt){for(const actor of [...actors.children]){const u=actor.userData,p=currentVehicle?currentVehicle.position:player.position,d=distance2D(actor.position,p);if(u.police){temp.subVectors(p,actor.position).setY(0);if(temp.length()>7)actor.position.add(temp.normalize().multiplyScalar(u.speed*dt));actor.lookAt(p.x,actor.position.y,p.z);if(wanted>0&&d<22&&performance.now()-u.shotAt>1600){u.shotAt=performance.now();damagePlayer(5+wanted)}}else{u.dir+=(Math.random()-.5)*dt*.7;actor.position.x+=Math.cos(u.dir)*u.speed*dt;actor.position.z+=Math.sin(u.dir)*u.speed*dt;if(Math.abs(actor.position.x)>112||Math.abs(actor.position.z)>118)u.dir+=Math.PI}}if(wanted>0){const nearby=actors.children.some(a=>a.userData.police&&distance2D(a.position,currentVehicle?currentVehicle.position:player.position)<38);wantedDecay=nearby?0:wantedDecay+dt;if(wantedDecay>12){setWanted(wanted-1);wantedDecay=0}const count=actors.children.filter(a=>a.userData.police).length;if(count<Math.ceil(wanted/2)&&Math.random()<dt*.7)spawnPolice()}}

function startMission(){if(mission)return flash('MISSION ALREADY ACTIVE');const types=['reach','eliminate'];const type=types[Math.floor(Math.random()*types.length)];mission={type,target:buildings[Math.floor(Math.random()*buildings.length)],progress:0,goal:3,reward:700+Math.floor(Math.random()*600)};flash(`MISSION STARTED • ${mission.type.toUpperCase()}`)}
function missionProgress(type){if(!mission||mission.type!==type)return;mission.progress++;if(mission.progress>=mission.goal)completeMission()}
function completeMission(){cash+=mission.reward;cashEl.textContent='$'+cash.toLocaleString();flash(`MISSION PASSED • +$${mission.reward}`);mission=null}
function updateMission(){if(!mission){missionText.textContent='NO ACTIVE MISSION • PRESS J';return}if(mission.type==='reach'&&distance2D(player.position,mission.target.position)<8)completeMission();missionText.textContent=mission.type==='reach'?`MISSION • REACH ${mission.target.userData.name} • $${mission.reward}`:`MISSION • ELIMINATE ${mission.progress}/${mission.goal} • $${mission.reward}`}

function updatePrompt(){if(currentVehicle)promptEl.textContent='F / E  EXIT VEHICLE';else if(inInterior)promptEl.textContent='E  EXIT BUILDING';else{const car=nearestCar();if(car){promptEl.textContent='E  ENTER VEHICLE';return}let best=null,bd=4.5;for(const b of buildings){const d=distance2D(player.position,b.userData.doorWorld);if(d<bd){bd=d;best=b}}promptEl.textContent=best?`E  ENTER ${best.userData.name}`:''}}
function drawMap(){if(!showMap)return;mapCtx.clearRect(0,0,220,220);mapCtx.fillStyle='rgba(8,11,16,.84)';mapCtx.fillRect(0,0,220,220);const s=.82,to=(x,z)=>[110+x*s,110+z*s];mapCtx.strokeStyle='rgba(255,255,255,.16)';mapCtx.lineWidth=7;for(const[x,z,w,d]of[[0,0,240,26],[0,55,240,26],[0,27,26,240],[55,27,26,240]]){const p=to(x,z);mapCtx.strokeRect(p[0]-w*s/2,p[1]-d*s/2,w*s,d*s)}for(const b of buildings){const p=to(b.position.x,b.position.z);mapCtx.fillStyle='#69737e';mapCtx.fillRect(p[0]-8,p[1]-8,16,16)}for(const c of cars.slice(0,34)){const p=to(c.position.x,c.position.z);mapCtx.fillStyle=c.userData.police?'#5e8dff':c===currentVehicle?'#f5c451':'#9aa2ad';mapCtx.fillRect(p[0]-2,p[1]-2,4,4)}if(mission){const p=to(mission.target.position.x,mission.target.position.z);mapCtx.strokeStyle='#f5c451';mapCtx.beginPath();mapCtx.arc(p[0],p[1],9,0,Math.PI*2);mapCtx.stroke()}const pos=currentVehicle?currentVehicle.position:player.position,p=to(pos.x,pos.z);mapCtx.fillStyle='#fff';mapCtx.beginPath();mapCtx.arc(p[0],p[1],5,0,Math.PI*2);mapCtx.fill()}
function updateCamera(dt){const focus=(currentVehicle||player).position.clone();focus.y=currentVehicle?1.3:1.35;const distance=currentVehicle?8.8:7;const height=currentVehicle?3:2.65+cameraPitch*2;const offset=new THREE.Vector3(Math.sin(cameraYaw)*distance,height,Math.cos(cameraYaw)*distance);target.copy(focus).add(offset);camera.position.lerp(target,Math.min(1,dt*9));camera.lookAt(focus)}
function updateWorld(dt){dayTime=(dayTime+dt*.02)%24;const night=dayTime<6||dayTime>19;const sky=night?0x0d1525:0x8ba9c7;scene.background.setHex(sky);scene.fog.color.setHex(sky);const sun=scene.getObjectByName('sun');if(sun)sun.intensity=night?.17:.78}
function setupLights(){scene.add(new THREE.HemisphereLight(0xd7e8ff,0x34402e,1.12));const sun=new THREE.DirectionalLight(0xffe5bd,.8);sun.name='sun';sun.position.set(-70,100,-40);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;sun.shadow.camera.far=300;scene.add(sun)}
function saveGame(){localStorage.setItem('los-santos-save',JSON.stringify({health,armor,cash,wanted,weapon:currentWeapon,ammo:weaponAmmo,dayTime,player:{x:player.position.x,z:player.position.z}}));flash('GAME SAVED')}
function loadGame(){const raw=localStorage.getItem('los-santos-save');if(!raw)return flash('NO SAVE FOUND');try{const s=JSON.parse(raw);health=s.health??100;armor=s.armor??25;cash=s.cash??2500;setWanted(s.wanted??0);currentWeapon=s.weapon??0;if(Array.isArray(s.ammo)&&s.ammo.length===weaponAmmo.length)weaponAmmo.splice(0,weaponAmmo.length,...s.ammo);dayTime=s.dayTime??13;player.position.set(s.player?.x??0,0,s.player?.z??12);healthFill.style.width=health+'%';cashEl.textContent='$'+cash.toLocaleString();updateWeaponUI();flash('GAME LOADED')}catch{flash('SAVE DATA INVALID')}}
function startGame(){started=true;paused=false;menu.classList.add('hidden');pause.classList.add('hidden');renderer.domElement.requestPointerLock()}
function pointerLockChanged(){locked=document.pointerLockElement===renderer.domElement;if(!locked&&started){paused=true;pause.classList.remove('hidden')}}

player=makePlayer();makeCity();makeTraffic();makeNPCs();setupLights();setWanted(0);updateWeaponUI();cashEl.textContent='$'+cash.toLocaleString();healthFill.style.width='100%';
$('play').addEventListener('click',startGame);$('resume').addEventListener('click',startGame);document.addEventListener('pointerlockchange',pointerLockChanged);
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyF'&&!e.repeat&&currentVehicle)exitCar();if(e.code==='KeyR'&&!e.repeat)reload();if(e.code==='Digit1'&&!e.repeat)switchWeapon(0);if(e.code==='Digit2'&&!e.repeat)switchWeapon(1);if(e.code==='Digit3'&&!e.repeat)switchWeapon(2);if(e.code==='KeyM'&&!e.repeat){showMap=!showMap;minimap.classList.toggle('hidden',!showMap)}if(e.code==='KeyJ'&&!e.repeat)startMission();if(e.code==='F5'&&!e.repeat){e.preventDefault();saveGame()}if(e.code==='F9'&&!e.repeat){e.preventDefault();loadGame()}if(e.code==='Space')e.preventDefault()});
window.addEventListener('keyup',e=>{keys[e.code]=false});
window.addEventListener('mousedown',e=>{if(e.button===0)fire()});
window.addEventListener('mousemove',e=>{if(!locked||paused)return;cameraYaw-=e.movementX*.0025;cameraPitch=THREE.MathUtils.clamp(cameraPitch+e.movementY*.0018,-.45,.5)});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);fireCooldown=Math.max(0,fireCooldown-dt);if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];const n=Math.min(w.mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;updateWeaponUI();flash(`${w.name} RELOADED`)}}updateOnFoot(dt);updateVehicle(dt);updateTraffic(dt);updateActors(dt);updateMission();updateCamera(dt);updatePrompt();updateWorld(dt);drawMap();renderer.render(scene,camera)}animate();