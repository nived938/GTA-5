# Los Santos Unity Project

Unity 6.4 project for the GTA-inspired open-world prototype. It uses original procedural geometry and C# systems, not Rockstar assets.

## Tested target

Unity 6000.4.2f1, Unity 6.4. Unity officially released 6000.4.2f1 on April 9, 2026. https://unity.com/releases/editor/whats-new/6000.4.2f1

## Open the project

1. Clone the repository.
2. Open the `UnityProject` folder in Unity Hub.
3. Use Unity `6000.4.2f1`.
4. Open `Assets/Scenes/LosSantos.unity`.
5. Unity automatically generates the editable city in the scene.
6. If the scene is still empty, use `Los Santos > Generate Playable Scene` from the Unity top menu.
7. Press Play.

The scene generator saves the generated player, camera, cars, buildings, pedestrians, lights, HUD and managers directly into the scene, so they are visible and editable in the Hierarchy before Play Mode.

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
- Runtime fallback bootstrap for empty scenes

## Controls

WASD, move / drive
Shift, sprint / boost
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

`Assets/Scripts/GameBootstrap.cs` generates and owns the city scene.
`Assets/Scripts/PlayerController.cs` controls player locomotion.
`Assets/Scripts/VehicleController.cs` controls WheelCollider driving, steering, suspension and wheel visuals.
`Assets/Scripts/TrafficAI.cs` controls traffic.
`Assets/Scripts/CharacterAI.cs` controls pedestrians.
`Assets/Scripts/WeaponSystem.cs` controls shooting.
`Assets/Scripts/BuildingInterior.cs` controls enterable interiors.
`Assets/Scripts/MissionManager.cs` controls missions.
`Assets/Scripts/SaveSystem.cs` controls local save/load.
`Assets/Editor/LosSantosSceneGenerator.cs` creates the persistent editable scene in the Unity Editor.
`Assets/Scripts/RuntimeGameStarter.cs` is a fallback that builds the game automatically when Play Mode starts.

## Vehicles

The car root uses a normal Unity Rigidbody and four WheelColliders. Unity documents WheelCollider as part of the Vehicles module and provides `motorTorque`, `brakeTorque`, `steerAngle` and `GetWorldPose` for vehicle behavior and wheel visuals. https://docs.unity3d.com/kr/6000.0/ScriptReference/WheelCollider.html
