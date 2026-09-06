import * as THREE from 'three';

// Keeps vehicle movement aligned with the visible front of the car.
// The car mesh is built with its nose on local +X, so +X rotated by
// the car quaternion is the authoritative forward direction.
const previous = new WeakMap();
const scratchForward = new THREE.Vector3(1, 0, 0);
const scratchDelta = new THREE.Vector3();
const scratchCorrected = new THREE.Vector3();

const originalRender = THREE.WebGLRenderer.prototype.render;

THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera, ...rest) {
  const vehicleRoot = scene.getObjectByProperty('type', 'Group');

  // Find the game's vehicle group by the presence of vehicle userData.
  let vehicles = null;
  scene.traverse(object => {
    if (!vehicles && object.isGroup && object.children.some(child => child.userData?.name === 'SENTINEL' || child.userData?.name === 'POLICE CRUISER')) {
      vehicles = object;
    }
  });

  if (vehicles) {
    for (const car of vehicles.children) {
      if (!car.userData?.name) continue;

      const old = previous.get(car);
      const current = car.position.clone();
      const angle = car.rotation.y;

      if (old) {
        scratchDelta.subVectors(current, old);
        const distance = Math.hypot(scratchDelta.x, scratchDelta.z);

        if (distance > 0.00001) {
          scratchForward.set(1, 0, 0).applyQuaternion(car.quaternion).setY(0).normalize();
          const sign = scratchDelta.dot(scratchForward) >= 0 ? 1 : -1;
          scratchCorrected.copy(old).addScaledVector(scratchForward, distance * sign);
          car.position.x = scratchCorrected.x;
          car.position.z = scratchCorrected.z;
        }
      }

      previous.set(car, car.position.clone());
    }
  }

  return originalRender.call(this, scene, camera, ...rest);
};
