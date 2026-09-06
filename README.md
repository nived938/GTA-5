# Los Santos 3D Prototype

A lightweight browser-based open-world action prototype built with Three.js. It is inspired by modern open-world crime games while using original procedural geometry and code, without Rockstar assets.

## Major gameplay upgrade

- Third-person player character and follow camera
- WASD movement, sprinting and mouse camera control
- Drivable Sentinel-style cars
- Vehicle acceleration, braking, steering and speed HUD
- 30 moving traffic cars
- Vehicle enter/exit system
- Building collision boundaries
- Six enterable buildings with separate interiors
- NPC pedestrians and police pursuit
- Five-level wanted system with police spawning and pursuit
- Hitscan 9mm shooting, hit markers, ammo and reload
- Health and respawn system
- Cash rewards from combat
- Minimap showing roads, buildings, traffic and player position
- M toggles the minimap
- Day/night lighting cycle
- Dynamic HUD for location, wanted level, health, weapon and vehicle speed
- Main menu and pause screen
- Responsive renderer suitable for low-to-mid-range PCs

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Sprint / vehicle boost |
| Mouse | Third-person camera |
| Left Mouse | Fire on foot |
| R | Reload |
| E | Enter vehicle / building, or exit building |
| F | Exit vehicle |
| M | Toggle minimap |
| Esc | Pause |

## Design direction

The prototype focuses on the core readability of a large open-world action game: free traversal, recognizable districts, vehicles, combat, pedestrians, police pressure, enterable spaces, navigation and a persistent HUD. The project remains intentionally procedural so it can grow without depending on proprietary GTA V assets.

## Roadmap

1. Character animation and better third-person locomotion
2. More vehicle types, vehicle damage and traffic lane logic
3. Mission system with objectives and checkpoints
4. Weapon pickups and multiple weapon classes
5. More detailed interiors and district streaming
6. Police vehicles and road blocks
7. Save/load and player progression
8. Audio, particles and improved effects
9. WebGL quality presets and performance profiling

## Sources

- Rockstar Games, GTAV official product page: https://www.rockstargames.com/gta-v
- Three.js PointerLockControls: https://threejs.org/docs/pages/PointerLockControls.html
- Three.js Raycaster: https://threejs.org/docs/pages/Raycaster.html
- Three.js InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
