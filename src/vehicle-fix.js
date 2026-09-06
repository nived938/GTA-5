import * as THREE from 'three';

const keys = {};
const states = new WeakMap();
let lastFrame = performance.now();

window.addEventListener('keydown', event => { keys[event.code] = true; });
window.addEventListener('keyup', event => { keys[event.code] = false; });

function forwardOf(car) {
  return new THREE.Vector3(
    Math.cos(car.rotation.y),
    0,
    -Math.sin(car.rotation.y)
  );
}

function buildingBlocked(scene, x, z, radius = 1.9) {
  let hit = false;
  scene.traverse(object => {
    if (hit || !object.isGroup || !object.userData?.size || object.visible === false) return;
    const { w, d } = object.userData.size;
    const p = object.position;
    if (Math.abs(x - p.x) < w / 2 + radius && Math.abs(z - p.z) < d / 2 + radius) hit = true;
  });
  return hit;
}

function carBlocked(scene, x, z, self, radius = 1.9) {
  if (buildingBlocked(scene, x, z, radius)) return true;
  let hit = false;
  scene.traverse(object => {
    if (hit || !object.isGroup || object === self || !object.userData?.name) return;
    if (object.userData.name !== 'SENTINEL' && object.userData.name !== 'POLICE CRUISER') return;
    if (object.userData.dead) return;
    const dx = object.position.x - x;
    const dz = object.position.z - z;
    if (Math.hypot(dx, dz) < radius + 1.7) hit = true;
  });
  return hit;
}

function steerWheels(car, steering) {
  const angle = steering * 0.48;
  car.traverse(object => {
    if (object === car || !object.isMesh || !object.geometry?.type) return;
    if (object.geometry.type !== 'CylinderGeometry') return;
    if (Math.abs(object.position.x) < 1.1) return;
    object.rotation.x = Math.PI / 2;
    object.rotation.y = angle;
  });
}

const originalRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function vehicleControlledRender(scene, camera, ...rest) {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;

  scene.traverse(object => {
    if (!object.isGroup || !object.userData?.occupied) return;
    if (object.userData.name !== 'SENTINEL' && object.userData.name !== 'POLICE CRUISER') return;

    let state = states.get(object);
    if (!state) {
      state = {
        position: object.position.clone(),
        yaw: object.rotation.y
      };
      states.set(object, state);
    }

    // The main game loop has legacy vehicle movement. Reset to our last
    // authoritative position, then apply steering and throttle exactly once.
    object.position.copy(state.position);
    object.rotation.y = state.yaw;

    const left = keys.KeyA ? 1 : 0;
    const right = keys.KeyD ? 1 : 0;
    const steering = left - right;
    const speed = Number(object.userData.speed) || 0;

    // A = left, D = right. Steering works even at zero speed, with a
    // smaller rate when stopped, similar to low-speed steering response.
    if (steering !== 0) {
      const speedFactor = Math.min(Math.abs(speed) / 8, 1);
      const turnRate = 0.7 + speedFactor * 1.15;
      const direction = speed < -0.1 ? -1 : 1;
      state.yaw += steering * turnRate * dt * direction;
    }

    object.rotation.y = state.yaw;
    steerWheels(object, steering);

    const heading = forwardOf(object);
    const nextX = state.position.x + heading.x * speed * dt;
    const nextZ = state.position.z + heading.z * speed * dt;

    if (!carBlocked(scene, nextX, nextZ, object, 1.9) && Math.abs(nextX) < 118 && Math.abs(nextZ) < 116) {
      state.position.set(nextX, object.position.y, nextZ);
    } else {
      object.userData.speed *= 0.22;
    }

    object.position.copy(state.position);
    object.rotation.z = THREE.MathUtils.lerp(object.rotation.z, -steering * 0.035, dt * 7);
  });

  return originalRender.call(this, scene, camera, ...rest);
};
