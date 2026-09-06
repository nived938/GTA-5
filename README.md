# Los Santos 3D Prototype

A lightweight browser-based open-world action prototype built with Three.js. It is inspired by the design language of modern open-world crime games, but uses original procedural geometry and code rather than Rockstar assets.

## Included now

- 3D open-world city prototype
- First-person mouse look with Pointer Lock
- WASD movement and sprinting
- Hitscan 9mm shooting with ammo and reload
- NPC pedestrians
- Police NPCs and a 0 to 5 star wanted system
- Health, cash and combat HUD
- Six enterable buildings with separate interior spaces
- Procedural roads, sidewalks, street lights, trees and parked cars
- Main menu and pause screen
- Day/night lighting cycle
- Responsive rendering

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Mouse | Look |
| Left Mouse | Fire |
| R | Reload |
| E | Enter / exit building |
| Esc | Pause |

## Design research notes

The prototype focuses on the gameplay pillars that make GTA V readable as an open-world action game: an immediately explorable city, mission-style traversal, combat, vehicles, pedestrians, police pressure, enterable spaces and a strong HUD. Rockstar describes GTAV as an open world covering Los Santos and Blaine County, with story missions, online activities and a broad range of environments. Current GTAV materials also emphasize improved visuals, faster loading and 3D audio on newer versions.

The implementation deliberately starts with procedural primitives so the repository stays small and legally clean. Three.js PointerLockControls is used for first-person game controls, Raycaster handles hitscan shooting, and the architecture can later move repeated scenery to InstancedMesh for better performance.

## Roadmap

1. Third-person player option and character animation
2. Drivable vehicles with traffic AI
3. Better collision and navigation meshes
4. Mission framework with objectives and checkpoints
5. Weapon pickups and multiple weapons
6. More interiors and streamed districts
7. Minimap and waypoint navigation
8. Save/load system
9. Audio, particles and screen effects
10. Optional WebGL quality presets for low-end PCs

## Sources

- Rockstar Games, GTAV official product page: https://www.rockstargames.com/gta-v
- Rockstar Games, GTAV PC system requirements: https://support.rockstargames.com/articles/lMQXeP2Z1mN3g9oZiBZFR/grand-theft-auto-v-pc-system-requirements
- Three.js PointerLockControls: https://threejs.org/docs/pages/PointerLockControls.html
- Three.js Raycaster: https://threejs.org/docs/pages/Raycaster.html
- Three.js InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
