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
const aim = new THREE.Vector3();
const target = new THREE.Vector3();
const temp = new THREE.Vector3();

let locked = false, started = false, paused = false;
let player = null, currentVehicle = null, activeBuilding = null;
let inInterior = false, showMap = true, currentWeapon = 0, mission = null;
let health = 100, armor = 25, cash = 2500, wanted = 0, wantedDecay = 0;
let dayTime = 13, reloadTimer = 0, fireCooldown = 0;
let cameraYaw = 0, cameraPitch = 0.08, jumpVelocity = 0, onGround = true, walkTime = 0;

const weapons = [
  { name:'9MM', mag:12, reserve:120, damage:50, cooldown:.14 },
  { name:'SMG', mag:30, reserve:180, damage:25, cooldown:.075 },
  { name:'SHOTGUN', mag:6, reserve:48, damage:85, cooldown:.55 }
];
const weaponAmmo = weapons.map(w => ({ ammo:w.mag, reserve:w.reserve }));
const buildings = [], colliders = [], cars = [];

const mats = {
  road:new THREE.MeshStandardMaterial({color:0x242932,roughness:.94}),
  sidewalk:new THREE.MeshStandardMaterial({color:0x888b89,roughness:1}),
  grass:new THREE.MeshStandardMaterial({color:0x496045,roughness:1}),
  concrete:new THREE.MeshStandardMaterial({color:0xb4b1a8,roughness:.9}),
  glass:new THREE.MeshStandardMaterial({color:0x41697a,roughness:.14,metalness:.25}),
  black:new THREE.MeshStandardMaterial({color:0x101316,roughness:.5,metalness:.25}),
  red:new THREE.MeshStandardMaterial({color:0xa53b35,roughness:.75}),
  blue:new THREE.MeshStandardMaterial({color:0x2e5d91,roughness:.72}),
  green:new THREE.MeshStandardMaterial({color:0x466c4e,roughness:.9}),
  skin:new THREE.MeshStandardMaterial({color:0xb9896c,roughness:.9})
};

function box(w,h,d,material,x,y,z,parent=city){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function cyl(r,h,material,x,y,z,parent=city,radial=12){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,radial),material);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function addCollider(x,z,w,d){colliders.push({x,z,w,d})}
function blocked(x,z,r=.65){return colliders.some(c=>Math.abs(x-c.x)<c.w/2+r&&Math.abs(z-c.z)<c.d/2+r)}
function vehicleBlocked(x,z,r=2,ignore=null){
  if(blocked(x,z,r))return true;
  return cars.some(c=>c!==ignore&&!c.userData.dead&&dist(c.position,{x,z})<r+1.7);
}

function makeRoads(){
  box(240,.16,26,mats.road,0,0,0); box(240,.16,26,mats.road,0,0,55);
  box(26,.16,240,mats.road,0,0,27); box(26,.16,240,mats.road,55,0,27);
  for(const z of [-15.5,15.5,39.5,70.5]) box(240,.18,5,mats.sidewalk,0,.12,z);
  for(const x of [-15.5,15.5,39.5,70.5]) box(5,.18,240,mats.sidewalk,x,.12,27);
  for(let x=-110;x<=110;x+=14) for(const z of [-6.4,6.4,48.6,61.4]) box(7,.03,.14,mats.concrete,x,.1,z);
  for(let z=-80;z<=130;z+=14) for(const x of [-6.4,6.4,48.6,61.4]) box(.14,.03,7,mats.concrete,x,.1,z);
}

function makeBuilding(x,z,w,d,h,color,name){
  const g=new THREE.Group(); g.position.set(x,0,z); city.add(g);
  box(w,h,d,new THREE.MeshStandardMaterial({color,roughness:.84}),0,h/2,0,g);
  for(let y=3;y<h-1;y+=3.1) for(let px=-w/2+2.2;px<w/2-1;px+=4.4){
    box(2.2,1.25,.08,mats.glass,px,y,d/2+.04,g);
    box(2.2,1.25,.08,mats.glass,px,y,-d/2-.04,g);
  }
  box(2.3,2.9,.16,mats.black,0,1.45,d/2+.1,g);
  box(Math.min(w-4,11),1,.16,mats.red,0,Math.min(h-1.1,8),d/2+.17,g);
  const interior=new THREE.Group(); interior.position.set(x,0,z); interiors.add(interior); interior.visible=false;
  box(w-1,.2,d-1,mats.concrete,0,0,0,interior); box(w-1,.2,d-1,mats.black,0,6,0,interior);
  box(.2,6,d-1,mats.concrete,-(w-1)/2,3,0,interior); box(.2,6,d-1,mats.concrete,(w-1)/2,3,0,interior);
  box(w-1,6,.2,mats.concrete,0,3,-(d-1)/2,interior);
  for(let i=0;i<5;i++) box(1.8,1,1.8,i%2?mats.blue:mats.red,-w/3+i*3.4,1,-d/4,interior);
  g.userData={name,interior,doorWorld:new THREE.Vector3(x,0,z+d/2+.75)};
  buildings.push(g); addCollider(x,z,w+.8,d+.8);
}

function makeCity(){
  makeRoads(); box(240,.1,240,mats.grass,0,-.08,27);
  [
    [-46,-42,22,23,18,0x7d7268,'OCEAN VIEW HOTEL'],
    [27,-42,22,23,24,0x69737e,'PACIFIC TOWER'],
    [88,-42,22,23,16,0x796b60,'EASTSIDE LOFTS'],
    [-46,28,22,22,14,0x82776d,'VESPUCCI MARKET'],
    [27,28,22,22,20,0x6c7075,'ARCADE PLAZA'],
    [88,28,22,22,18,0x596a70,'WESTSIDE OFFICES']
  ].forEach(v=>makeBuilding(...v));
  for(let i=0;i<50;i++){
    const x=(Math.random()-.5)*220,z=(Math.random()-.5)*210+27;
    if(Math.abs(x%55)<19||Math.abs(z%55)<19)continue;
    cyl(.22,2.8,new THREE.MeshStandardMaterial({color:0x594438}),x,1.4,z);
    const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55,1),mats.green);c.position.set(x,3.3,z);c.castShadow=true;city.add(c);
  }
}

function makePlayer(){
  const p=new THREE.Group(); p.position.set(0,0,10);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;p.add(shadow);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.6,.75,.35),new THREE.MeshStandardMaterial({color:0x182033,roughness:.85}));legs.position.y=.58;legs.castShadow=true;p.add(legs);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.43,.85,5,10),new THREE.MeshStandardMaterial({color:0x3e4652,roughness:.7}));torso.position.y=1.32;torso.castShadow=true;p.add(torso);
  const shirt=new THREE.Mesh(new THREE.BoxGeometry(.68,.4,.42),new THREE.MeshStandardMaterial({color:0x253b58,roughness:.75}));shirt.position.y=1.57;p.add(shirt);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,14,12),mats.skin);head.position.y=2.12;head.castShadow=true;p.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.32,14,8,0,Math.PI*2,0,Math.PI*.45),new THREE.MeshStandardMaterial({color:0x171717}));hair.position.y=2.25;p.add(hair);
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.65,4,8),new THREE.MeshStandardMaterial({color:0x313844}));armL.position.set(-.53,1.35,0);armL.castShadow=true;p.add(armL);
  const armR=armL.clone();armR.position.x=.53;p.add(armR);p.userData={armL,armR}; world.add(p); return p;
}

function makeCar(x,z,color,rotation=0,traffic=true,police=false){
  const car=new THREE.Group(); car.position.set(x,.5,z); car.rotation.y=rotation;
  car.userData={speed:traffic?5+Math.random()*2:0,traffic,police,occupied:false,dead:false,name:police?'POLICE CRUISER':'SENTINEL',previousHeading:new THREE.Vector3(1,0,0)};
  box(4.2,.78,1.9,new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.2}),0,.35,0,car);
  box(2.05,.64,1.55,mats.glass,.15,.9,0,car);
  for(const x of [-1.42,1.42]) for(const z2 of [-.94,.94]){
    const wheel=cyl(.34,.22,mats.black,x,.11,z2,car,16); wheel.rotation.x=Math.PI/2;
    const hub=cyl(.12,.24,mats.concrete,x,.11,z2,car,12); hub.rotation.x=Math.PI/2;
  }
  const frontL=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.52),new THREE.MeshBasicMaterial({color:0xffe0a0}));frontL.position.set(2.1,.45,-.55);
  const frontR=frontL.clone();frontR.position.z=.55;car.add(frontL,frontR);
  if(police){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.28),new THREE.MeshStandardMaterial({color:0x17202b}));bar.position.y=1.3;car.add(bar);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.25,.11,.25),new THREE.MeshBasicMaterial({color:0x285eff}));b.position.set(-.25,1.36,0);
    const r=b.clone();r.material=new THREE.MeshBasicMaterial({color:0xff334c});r.position.x=.25;car.add(b,r);
  }
  vehicles.add(car); cars.push(car); return car;
}

function makeTraffic(){
  const colors=[0x9e3434,0x345f8a,0xd0c4a5,0x292d31,0x64845a,0x8c6333];
  const horizontal=[-6,6,49,61], vertical=[-6,6,49,61];
  for(let i=0;i<36;i++){
    if(i%2===0){
      const lane=horizontal[i%4], x=-105+Math.random()*210, east=i%4<2;
      makeCar(x,lane,colors[i%colors.length],east?0:Math.PI,true);
    }else{
      const lane=vertical[i%4], z=-105+Math.random()*210, south=i%4<2;
      // Rotation +PI/2 points local +X toward world -Z. -PI/2 points toward +Z.
      makeCar(lane,z,colors[i%colors.length],south?Math.PI/2:-Math.PI/2,true);
    }
  }
}

function makeNPC(x,z,police=false){
  const a=new THREE.Group();a.position.set(x,1,z);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.9,4,8),new THREE.MeshStandardMaterial({color:police?0x294b73:0x8a4c41}));body.castShadow=true;body.userData.actor=a;a.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),mats.skin);head.position.y=.82;head.userData.actor=a;a.add(head);
  a.userData={health:100,police,dir:Math.random()*Math.PI*2,speed:police?2.9:1.05,shotAt:0};actors.add(a);return a;
}
function makeNPCs(){for(let i=0;i<36;i++)makeNPC((Math.random()-.5)*205,(Math.random()-.5)*175+27)}

function updateWeaponUI(){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];$('weaponName').textContent=w.name;ammoEl.textContent=`${a.ammo} / ${a.reserve}`}
function setWanted(v){wanted=THREE.MathUtils.clamp(Math.round(v),0,5);wantedEl.textContent='★'.repeat(wanted)+'☆'.repeat(5-wanted);wantedEl.style.color=wanted?'#f3d35a':'#657080'}
function flash(text){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(flash.timer);flash.timer=setTimeout(()=>t.classList.remove('show'),1700)}
function damagePlayer(amount){const ad=Math.min(armor,Math.ceil(amount*.55));armor-=ad;health=Math.max(0,health-(amount-ad));healthFill.style.width=health+'%';if(health<=0)respawn()}
function respawn(){health=100;armor=25;setWanted(0);mission=null;if(currentVehicle)currentVehicle.userData.occupied=false;currentVehicle=null;inInterior=false;activeBuilding=null;for(const b of buildings){b.visible=true;b.userData.interior.visible=false}player.visible=true;player.position.set(0,0,10);vehicleHud.classList.remove('active');healthFill.style.width='100%';locationEl.textContent='VESPUCCI DISTRICT';flash('WASTED • RESPAWNED')}
function switchWeapon(i){if(i<0||i>=weapons.length)return;currentWeapon=i;reloadTimer=0;fireCooldown=0;updateWeaponUI();flash(`EQUIPPED ${weapons[i].name}`)}
function reload(){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];if(reloadTimer>0||a.ammo>=w.mag||a.reserve<=0||currentVehicle)return;reloadTimer=currentWeapon===2?1.2:.9}

function fire(){
  if(!locked||!started||paused||currentVehicle||reloadTimer>0||fireCooldown>0)return;
  const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon];if(a.ammo<=0)return reload();
  a.ammo--;fireCooldown=w.cooldown;updateWeaponUI();const origin=camera.position.clone();camera.getWorldDirection(aim);
  for(let i=0;i<(currentWeapon===2?7:1);i++){
    const shot=aim.clone(),s=currentWeapon===2?.09:.012;shot.x+=(Math.random()-.5)*s;shot.y+=(Math.random()-.5)*s;shot.normalize();raycaster.set(origin,shot);
    const hit=raycaster.intersectObjects(actors.children,true).find(h=>h.object.userData.actor);if(!hit)continue;
    const actor=hit.object.userData.actor;actor.userData.health-=w.damage;
    if(actor.userData.health<=0){const p=actor.userData.police;actor.removeFromParent();cash+=p?75:25;cashEl.textContent='$'+cash.toLocaleString();missionProgress('eliminate');setWanted(wanted+(p?2:1))}
  }
}
function missionProgress(type){if(!mission||mission.type!==type)return;mission.progress++;if(mission.progress>=mission.goal)completeMission()}
function completeMission(){cash+=mission.reward;cashEl.textContent='$'+cash.toLocaleString();flash(`MISSION PASSED • +$${mission.reward}`);mission=null}
function startMission(){if(mission)return flash('MISSION ALREADY ACTIVE');const type=Math.random()>.5?'reach':'eliminate';mission={type,target:buildings[Math.floor(Math.random()*buildings.length)],progress:0,goal:3,reward:700+Math.floor(Math.random()*600)};flash(`MISSION STARTED • ${type.toUpperCase()}`)}

function nearestCar(){let best=null,bd=4.2;for(const car of cars){if(car.userData.occupied||car.userData.dead)continue;const d=dist(player.position,car.position);if(d<bd){bd=d;best=car}}return best}
function enterCar(car){currentVehicle=car;car.userData.occupied=true;player.visible=false;vehicleHud.classList.add('active');vehicleNameEl.textContent=car.userData.name;locationEl.textContent='CITY STREETS';setWanted(wanted+(car.userData.police?2:1));flash(`ENTERED ${car.userData.name}`)}
function exitCar(){if(!currentVehicle)return;const car=currentVehicle;const side=new THREE.Vector3(0,0,2.6).applyQuaternion(car.quaternion);let p=car.position.clone().add(side);if(blocked(p.x,p.z,.7))p=car.position.clone().add(side.multiplyScalar(-1));player.position.copy(p);player.position.y=0;player.visible=true;car.userData.occupied=false;currentVehicle=null;vehicleHud.classList.remove('active')}
function enterBuilding(b){if(inInterior)return;inInterior=true;activeBuilding=b;b.visible=false;b.userData.interior.visible=true;player.position.copy(b.position);player.position.y=0;locationEl.textContent=b.userData.name;flash(`ENTERED ${b.userData.name}`)}
function exitBuilding(){if(!inInterior||!activeBuilding)return;const b=activeBuilding;b.visible=true;b.userData.interior.visible=false;player.position.copy(b.userData.doorWorld);player.position.y=0;inInterior=false;activeBuilding=null;locationEl.textContent='VESPUCCI DISTRICT'}
function interact(){if(inInterior)return exitBuilding();if(currentVehicle)return exitCar();const car=nearestCar();if(car)return enterCar(car);let best=null,bd=4.5;for(const b of buildings){const d=dist(player.position,b.userData.doorWorld);if(d<bd){bd=d;best=b}}if(best)enterBuilding(best)}

function updateOnFoot(dt){
  if(!locked||paused||inInterior||currentVehicle)return;
  let x=0,z=0;if(keys.KeyW)z+=1;if(keys.KeyS)z-=1;if(keys.KeyA)x-=1;if(keys.KeyD)x+=1;
  if(x||z){const l=Math.hypot(x,z);x/=l;z/=l;const f=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));const r=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));const move=f.multiplyScalar(z).add(r.multiplyScalar(x));const sprint=keys.ShiftLeft||keys.ShiftRight;const sp=sprint?8.5:5.2;const nx=player.position.x+move.x*sp*dt,nz=player.position.z+move.z*sp*dt;if(!blocked(nx,nz,.68)){player.position.x=nx;player.position.z=nz}player.rotation.y=Math.atan2(move.x,move.z);walkTime+=dt*(sprint?12:8);player.userData.armL.rotation.x=Math.sin(walkTime)*.55;player.userData.armR.rotation.x=-Math.sin(walkTime)*.55}else{player.userData.armL.rotation.x*=.84;player.userData.armR.rotation.x*=.84}
  if(keys.Space&&onGround){jumpVelocity=6;onGround=false}jumpVelocity-=15*dt;player.position.y+=jumpVelocity*dt;if(player.position.y<=0){player.position.y=0;jumpVelocity=0;onGround=true}
  player.position.x=THREE.MathUtils.clamp(player.position.x,-116,116);player.position.z=THREE.MathUtils.clamp(player.position.z,-112,142)
}

function vehicleForward(car){
  // The vehicle mesh is modeled nose-first along local +X.
  // Three.js Y rotation transforms local +X to (cos(y), 0, -sin(y)).
  return new THREE.Vector3(Math.cos(car.rotation.y),0,-Math.sin(car.rotation.y)).normalize();
}
function updateVehicle(dt){
  if(!currentVehicle||!locked||paused)return;
  const car=currentVehicle;
  const throttle=keys.KeyW?1:keys.KeyS?-1:0;
  const boost=(keys.ShiftLeft||keys.ShiftRight)?1.35:1;
  const max=18*boost;
  const targetSpeed=throttle*max;
  car.userData.speed=THREE.MathUtils.lerp(car.userData.speed,targetSpeed,throttle?.09:.045);
  const steer=(keys.KeyA?-1:0)+(keys.KeyD?1:0);
  if(Math.abs(car.userData.speed)>.3){
    const steerRate=(1.15+Math.abs(car.userData.speed)/22)*dt*(car.userData.speed<0?-1:1);
    car.rotation.y+=steer*steerRate;
  }
  const forward=vehicleForward(car);
  const next=car.position.clone().addScaledVector(forward,car.userData.speed*dt);
  if(!vehicleBlocked(next.x,next.z,1.9,car)&&Math.abs(next.x)<118&&Math.abs(next.z)<116)car.position.copy(next);else car.userData.speed*=.25;
  car.rotation.z=THREE.MathUtils.lerp(car.rotation.z,-steer*.035,dt*7);
  speedEl.textContent=`${Math.round(Math.abs(car.userData.speed)*4.9)} KM/H`;
}
function updateTraffic(dt){
  for(const car of cars){if(car===currentVehicle||!car.userData.traffic||car.userData.dead)continue;const f=vehicleForward(car);const next=car.position.clone().addScaledVector(f,car.userData.speed*dt);if(!vehicleBlocked(next.x,next.z,1.85,car))car.position.copy(next);else car.userData.speed=0;if(car.position.x>124)car.position.x=-123;if(car.position.x<-124)car.position.x=123;if(car.position.z>148)car.position.z=-119;if(car.position.z<-120)car.position.z=147}
}
function spawnPolice(){const p=currentVehicle?currentVehicle.position:player.position,a=Math.random()*Math.PI*2,d=34+Math.random()*18;makeNPC(p.x+Math.cos(a)*d,p.z+Math.sin(a)*d,true);if(wanted>=2)makeCar(p.x+Math.cos(a)*(d+5),p.z+Math.sin(a)*(d+5),0x243b5c,a,false,true)}
function updateActors(dt){for(const a of [...actors.children]){const u=a.userData,p=currentVehicle?currentVehicle.position:player.position,d=dist(a.position,p);if(u.police){temp.subVectors(p,a.position).setY(0);if(temp.length()>7)a.position.addScaledVector(temp.normalize(),u.speed*dt);a.lookAt(p.x,a.position.y,p.z);if(wanted>0&&d<22&&performance.now()-u.shotAt>1600){u.shotAt=performance.now();damagePlayer(5+wanted)}}else{u.dir+=(Math.random()-.5)*dt*.7;const nx=a.position.x+Math.cos(u.dir)*u.speed*dt,nz=a.position.z+Math.sin(u.dir)*u.speed*dt;if(!blocked(nx,nz,.5)){a.position.x=nx;a.position.z=nz}else u.dir+=Math.PI*.6;if(Math.abs(a.position.x)>112||Math.abs(a.position.z)>118)u.dir+=Math.PI}}if(wanted>0){const nearby=actors.children.some(a=>a.userData.police&&dist(a.position,currentVehicle?currentVehicle.position:player.position)<38);wantedDecay=nearby?0:wantedDecay+dt;if(wantedDecay>12){setWanted(wanted-1);wantedDecay=0}if(actors.children.filter(a=>a.userData.police).length<Math.ceil(wanted/2)&&Math.random()<dt*.7)spawnPolice()}}

function updateMission(){if(!mission){missionText.textContent='NO ACTIVE MISSION • PRESS J';return}if(mission.type==='reach'&&dist(player.position,mission.target.position)<8)completeMission();missionText.textContent=mission.type==='reach'?`MISSION • REACH ${mission.target.userData.name} • $${mission.reward}`:`MISSION • ELIMINATE ${mission.progress}/${mission.goal} • $${mission.reward}`}
function updatePrompt(){if(currentVehicle)promptEl.textContent='E / F  EXIT VEHICLE';else if(inInterior)promptEl.textContent='E  EXIT BUILDING';else{const car=nearestCar();if(car){promptEl.textContent='E  ENTER VEHICLE';return}let best=null,bd=4.5;for(const b of buildings){const d=dist(player.position,b.userData.doorWorld);if(d<bd){bd=d;best=b}}promptEl.textContent=best?`E  ENTER ${best.userData.name}`:''}}
function drawMap(){if(!showMap)return;mapCtx.clearRect(0,0,220,220);mapCtx.fillStyle='rgba(8,11,16,.84)';mapCtx.fillRect(0,0,220,220);const s=.82,p=(x,z)=>[110+x*s,110+z*s];mapCtx.strokeStyle='rgba(255,255,255,.16)';mapCtx.lineWidth=7;for(const[x,z,w,d]of[[0,0,240,26],[0,55,240,26],[0,27,26,240],[55,27,26,240]]){const q=p(x,z);mapCtx.strokeRect(q[0]-w*s/2,q[1]-d*s/2,w*s,d*s)}for(const b of buildings){const q=p(b.position.x,b.position.z);mapCtx.fillStyle='#69737e';mapCtx.fillRect(q[0]-8,q[1]-8,16,16)}for(const c of cars.slice(0,40)){const q=p(c.position.x,c.position.z);mapCtx.fillStyle=c.userData.police?'#5e8dff':c===currentVehicle?'#f5c451':'#9aa2ad';mapCtx.fillRect(q[0]-2,q[1]-2,4,4)}const pos=currentVehicle?currentVehicle.position:player.position,q=p(pos.x,pos.z);mapCtx.fillStyle='#fff';mapCtx.beginPath();mapCtx.arc(q[0],q[1],5,0,Math.PI*2);mapCtx.fill()}
function updateCamera(dt){const focus=(currentVehicle||player).position.clone();focus.y=currentVehicle?1.3:1.35;const distance=currentVehicle?8.8:7;const height=currentVehicle?3:2.65+cameraPitch*2;target.set(Math.sin(cameraYaw)*distance,height,Math.cos(cameraYaw)*distance).add(focus);camera.position.lerp(target,Math.min(1,dt*9));camera.lookAt(focus)}
function updateWorld(dt){dayTime=(dayTime+dt*.02)%24;const night=dayTime<6||dayTime>19,sky=night?0x0d1525:0x8ba9c7;scene.background.setHex(sky);scene.fog.color.setHex(sky);const sun=scene.getObjectByName('sun');if(sun)sun.intensity=night?.17:.78}
function setupLights(){scene.add(new THREE.HemisphereLight(0xd7e8ff,0x34402e,1.12));const sun=new THREE.DirectionalLight(0xffe5bd,.8);sun.name='sun';sun.position.set(-70,100,-40);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;sun.shadow.camera.far=300;scene.add(sun)}
function saveGame(){localStorage.setItem('los-santos-save',JSON.stringify({health,armor,cash,wanted,weapon:currentWeapon,ammo:weaponAmmo,dayTime,player:{x:player.position.x,z:player.position.z}}));flash('GAME SAVED')}
function loadGame(){const raw=localStorage.getItem('los-santos-save');if(!raw)return flash('NO SAVE FOUND');try{const s=JSON.parse(raw);health=s.health??100;armor=s.armor??25;cash=s.cash??2500;setWanted(s.wanted??0);currentWeapon=s.weapon??0;if(Array.isArray(s.ammo)&&s.ammo.length===weaponAmmo.length)weaponAmmo.splice(0,weaponAmmo.length,...s.ammo);dayTime=s.dayTime??13;player.position.set(s.player?.x??0,0,s.player?.z??10);healthFill.style.width=health+'%';cashEl.textContent='$'+cash.toLocaleString();updateWeaponUI();flash('GAME LOADED')}catch{flash('SAVE DATA INVALID')}}
function startGame(){started=true;paused=false;menu.classList.add('hidden');pause.classList.add('hidden');renderer.domElement.requestPointerLock()}
function pointerLockChanged(){locked=document.pointerLockElement===renderer.domElement;if(!locked&&started){paused=true;pause.classList.remove('hidden')}}

player=makePlayer();makeCity();makeTraffic();makeNPCs();setupLights();setWanted(0);updateWeaponUI();cashEl.textContent='$'+cash.toLocaleString();healthFill.style.width='100%';missionText.textContent='NO ACTIVE MISSION • PRESS J';
$('play').addEventListener('click',startGame);$('resume').addEventListener('click',startGame);document.addEventListener('pointerlockchange',pointerLockChanged);
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyF'&&!e.repeat&&currentVehicle)exitCar();if(e.code==='KeyR'&&!e.repeat)reload();if(e.code==='Digit1'&&!e.repeat)switchWeapon(0);if(e.code==='Digit2'&&!e.repeat)switchWeapon(1);if(e.code==='Digit3'&&!e.repeat)switchWeapon(2);if(e.code==='KeyM'&&!e.repeat){showMap=!showMap;minimap.classList.toggle('hidden',!showMap)}if(e.code==='KeyJ'&&!e.repeat)startMission();if(e.code==='F5'&&!e.repeat){e.preventDefault();saveGame()}if(e.code==='F9'&&!e.repeat){e.preventDefault();loadGame()}if(e.code==='Space')e.preventDefault()});
window.addEventListener('keyup',e=>{keys[e.code]=false});window.addEventListener('mousedown',e=>{if(e.button===0)fire()});
window.addEventListener('mousemove',e=>{if(!locked||paused)return;cameraYaw-=e.movementX*.0025;cameraPitch=THREE.MathUtils.clamp(cameraPitch+e.movementY*.0018,-.45,.5)});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);fireCooldown=Math.max(0,fireCooldown-dt);if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){const w=weapons[currentWeapon],a=weaponAmmo[currentWeapon],n=Math.min(w.mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;updateWeaponUI();flash(`${w.name} RELOADED`)}}updateOnFoot(dt);updateVehicle(dt);updateTraffic(dt);updateActors(dt);updateMission();updateCamera(dt);updatePrompt();updateWorld(dt);drawMap();renderer.render(scene,camera)}animate();