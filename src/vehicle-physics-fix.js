import * as THREE from 'three';

const previous = new WeakMap();
const forward = new THREE.Vector3(1, 0, 0);
const delta = new THREE.Vector3();
const corrected = new THREE.Vector3();

const originalRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera, ...rest) {
  let vehicles = null;

  scene.traverse(object => {
    if (!vehicles && object.isGroup && object.children.some(child =>
      child.userData?.name === 'SENTINEL' || child.userData?.name === 'POLICE CRUISER'
    )) {
      vehicles = object;
    }
  });

  if (vehicles) {
    for (const car of vehicles.children) {
      if (!car.userData?.name) continue;

      const old = previous.get(car);
      const current = car.position.clone();

      if (old) {
        delta.subVectors(current, old);
        const distance = Math.hypot(delta.x, delta.z);

        // Ignore map-wrap teleports and other large repositioning events.
        if (distance > 0.00001 && distance < 3.0) {
          forward.set(1, 0, 0)
            .applyQuaternion(car.quaternion)
            .setY(0)
            .normalize();

          const sign = delta.dot(forward) >= 0 ? 1 : -1;
          corrected.copy(old).addScaledVector(forward, distance * sign);
          car.position.x = corrected.x;
          car.position.z = corrected.z;
        }
      }

      previous.set(car, car.position.clone());
    }
  }

  return originalRender.call(this, scene, camera, ...rest);
};
