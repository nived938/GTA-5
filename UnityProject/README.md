# Los Santos Unity Project

Unity 6.4 project for the GTA-inspired open-world prototype. The project uses original procedural geometry and C# systems, not Rockstar assets.

## Version

Unity 6000.4.0f1, Unity 6.4.

Unity's official release archive lists 6000.4.0f1 as a Unity 6.4 editor release. See: https://unity.com/releases/editor/whats-new/6000.4.0f1

## Open

1. Clone the repository.
2. Open the `UnityProject` folder in Unity Hub.
3. Select Unity 6000.4.0f1.
4. Open `Assets/Scenes/LosSantos.unity`.
5. Press Play.

## Systems included

- Procedural 3D city and roads
- Third-person player controller
- Camera look and follow
- CharacterController movement and jump
- Drivable cars using Rigidbody and WheelCollider
- Front-wheel steering visuals and suspension
- Steering while stopped for parking-style rotation
- Enter and exit vehicles with E/F
- Traffic cars
- Pedestrian AI
- Shooting and weapon switching
- Enterable buildings with generated interiors
- Mission manager
- Local save/load with F5/F9
- Runtime HUD

## Controls

WASD, move / drive
Shift, sprint
Mouse, camera
Left Mouse, fire
1/2/3, switch weapon
R, reload
E, interact / enter vehicle / enter building
F, exit vehicle
Space, jump
J, start mission
F5, save
F9, load

## Main editable scripts

`Assets/Scripts/GameBootstrap.cs` generates the city and runtime scene.
`Assets/Scripts/PlayerController.cs` controls player locomotion.
`Assets/Scripts/VehicleController.cs` controls WheelCollider driving and steering.
`Assets/Scripts/TrafficAI.cs` controls traffic.
`Assets/Scripts/CharacterAI.cs` controls pedestrians.
`Assets/Scripts/WeaponSystem.cs` controls shooting.
`Assets/Scripts/BuildingInterior.cs` controls enterable interiors.
`Assets/Scripts/MissionManager.cs` controls missions.
`Assets/Scripts/SaveSystem.cs` controls local save/load.
