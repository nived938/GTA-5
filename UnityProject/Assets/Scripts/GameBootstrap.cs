using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class GameBootstrap : MonoBehaviour
{
    public Material roadMaterial, buildingMaterial, glassMaterial, grassMaterial, carMaterial, skinMaterial;
    public int TrafficCount = 24, PedestrianCount = 20;
    public bool GenerateOnStart = true;
    Transform world;
    readonly List<GameObject> buildings = new();

    void Start()
    {
        if (GenerateOnStart) BuildGame();
    }

    public void BuildGame()
    {
        if (world != null || GameObject.Find("LosSantosWorld") != null) return;
        world = new GameObject("LosSantosWorld").transform;
        CreateMaterials();
        CreateLighting();
        CreateGroundAndRoads();
        CreateBuildings();
        CreatePlayer();
        CreateTraffic();
        CreatePedestrians();
        CreateUI();
        if (GameObject.FindFirstObjectByType<MissionManager>() == null)
            new GameObject("MissionManager").AddComponent<MissionManager>();
        if (GameObject.FindFirstObjectByType<SaveSystem>() == null)
            new GameObject("SaveSystem").AddComponent<SaveSystem>();
    }

    Material MakeMat(Color c, float smooth = .75f, float metal = 0)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (!shader) shader = Shader.Find("Standard");
        var m = new Material(shader);
        m.color = c;
        if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
        if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metal);
        return m;
    }

    void CreateMaterials()
    {
        roadMaterial ??= MakeMat(new Color(.08f, .09f, .11f));
        buildingMaterial ??= MakeMat(new Color(.42f, .40f, .38f));
        glassMaterial ??= MakeMat(new Color(.08f, .28f, .34f), .25f, .2f);
        grassMaterial ??= MakeMat(new Color(.18f, .28f, .17f));
        carMaterial ??= MakeMat(new Color(.35f, .12f, .08f), .55f, .2f);
        skinMaterial ??= MakeMat(new Color(.64f, .42f, .30f));
    }

    void CreateLighting()
    {
        var sun = new GameObject("Sun").AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.1f;
        sun.transform.rotation = Quaternion.Euler(45, -35, 0);

        var sky = new GameObject("Ambient").AddComponent<Light>();
        sky.type = LightType.Point;
        sky.intensity = .35f;
        sky.range = 100;
        sky.transform.position = Vector3.up * 20f;
    }

    void CreateGroundAndRoads()
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
        g.name = "Ground";
        g.transform.SetParent(world);
        g.transform.position = new Vector3(0, -.15f, 30);
        g.transform.localScale = new Vector3(240, .2f, 240);
        g.GetComponent<Renderer>().material = grassMaterial;
        Road("Road_EastWest_0", new Vector3(0, 0, 0), new Vector3(240, .08f, 24));
        Road("Road_EastWest_1", new Vector3(0, 0, 55), new Vector3(240, .08f, 24));
        Road("Road_NorthSouth_0", new Vector3(0, 0, 27), new Vector3(24, .08f, 240));
        Road("Road_NorthSouth_1", new Vector3(55, 0, 27), new Vector3(24, .08f, 240));
    }

    void Road(string n, Vector3 p, Vector3 s)
    {
        var r = GameObject.CreatePrimitive(PrimitiveType.Cube);
        r.name = n;
        r.transform.SetParent(world);
        r.transform.position = p;
        r.transform.localScale = s;
        r.GetComponent<Renderer>().material = roadMaterial;
    }

    void CreateBuildings()
    {
        var ps = new[]
        {
            new Vector3(-45, 0, -42), new Vector3(28, 0, -42), new Vector3(87, 0, -42),
            new Vector3(-45, 0, 28), new Vector3(28, 0, 28), new Vector3(87, 0, 28),
            new Vector3(-87, 0, 90), new Vector3(45, 0, 95)
        };
        for (int i = 0; i < ps.Length; i++)
            CreateBuilding($"Building_{i + 1:00}", ps[i], new Vector3(20, 10 + i % 3 * 5, 20));
    }

    void CreateBuilding(string n, Vector3 p, Vector3 size)
    {
        var b = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b.name = n;
        b.transform.SetParent(world);
        b.transform.position = p + Vector3.up * size.y * .5f;
        b.transform.localScale = size;
        b.GetComponent<Renderer>().material = buildingMaterial;
        buildings.Add(b);

        var bi = b.AddComponent<BuildingInterior>();
        bi.BuildingName = n.ToUpper();

        var door = GameObject.CreatePrimitive(PrimitiveType.Cube);
        door.name = "Entrance";
        door.transform.SetParent(b.transform);
        door.transform.localPosition = new Vector3(0, -size.y * .5f + .9f, size.z * .5f + .08f);
        door.transform.localScale = new Vector3(2.2f, 2.8f, .2f);
        door.GetComponent<Renderer>().material = glassMaterial;
        Object.Destroy(door.GetComponent<BoxCollider>());
    }

    void CreatePlayer()
    {
        var p = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        p.name = "Player";
        p.tag = "Player";
        p.transform.SetParent(world);
        p.transform.position = new Vector3(0, 1.1f, 10);
        var cc = p.AddComponent<CharacterController>();
        cc.height = 2.2f;
        cc.radius = .42f;
        Object.Destroy(p.GetComponent<CapsuleCollider>());
        p.AddComponent<PlayerController>();
        p.AddComponent<WeaponSystem>();

        var cam = new GameObject("PlayerCamera");
        cam.tag = "MainCamera";
        var camera = cam.AddComponent<Camera>();
        camera.fieldOfView = 68;
        camera.nearClipPlane = .05f;
        camera.farClipPlane = 500f;
        cam.AddComponent<AudioListener>();
        var follow = cam.AddComponent<ThirdPersonCamera>();
        follow.Target = p.transform;
        cam.transform.position = p.transform.position + new Vector3(0, 2.5f, -7);
    }

    void CreateTraffic()
    {
        for (int i = 0; i < TrafficCount; i++)
        {
            bool h = i % 2 == 0;
            float t = -100 + Random.value * 200;
            Vector3 pos = h
                ? new Vector3(t, .5f, i % 4 < 2 ? -5.5f : 6f)
                : new Vector3(i % 4 < 2 ? -5.5f : 6f, .5f, t);
            float yaw = h ? (i % 4 < 2 ? 90 : -90) : (i % 4 < 2 ? 0 : 180);
            CreateCar($"TrafficCar_{i:00}", pos, yaw, true);
        }
    }

    void CreateCar(string n, Vector3 p, float yaw, bool ai)
    {
        var car = new GameObject(n);
        car.transform.SetParent(world);
        car.transform.position = p;
        car.transform.rotation = Quaternion.Euler(0, yaw, 0);
        var rb = car.AddComponent<Rigidbody>();
        rb.mass = 1500;
        rb.linearDamping = .25f;
        rb.angularDamping = 3f;
        rb.interpolation = RigidbodyInterpolation.Interpolate;

        var body = car.AddComponent<BoxCollider>();
        body.size = new Vector3(2, 1, 4);
        body.center = new Vector3(0, .35f, 0);

        var mesh = GameObject.CreatePrimitive(PrimitiveType.Cube);
        mesh.name = "Body";
        mesh.transform.SetParent(car.transform);
        mesh.transform.localPosition = new Vector3(0, .65f, 0);
        mesh.transform.localScale = new Vector3(2, 1, 4);
        mesh.GetComponent<Renderer>().material = carMaterial;
        Object.Destroy(mesh.GetComponent<BoxCollider>());

        var vc = car.AddComponent<VehicleController>();
        vc.PlayerVehicle = !ai;
        vc.SetupWheels();
        if (ai) car.AddComponent<TrafficAI>();
    }

    void CreatePedestrians()
    {
        for (int i = 0; i < PedestrianCount; i++)
        {
            var npc = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            npc.name = $"Pedestrian_{i:00}";
            npc.transform.SetParent(world);
            npc.transform.position = new Vector3(Random.Range(-105, 105), 1, Random.Range(-100, 130));
            Object.Destroy(npc.GetComponent<CapsuleCollider>());
            npc.AddComponent<CharacterAI>();
        }
    }

    void CreateUI()
    {
        var existing = GameObject.Find("HUD");
        if (existing) return;

        var canvas = new GameObject("HUD").AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.gameObject.AddComponent<CanvasScaler>();
        canvas.gameObject.AddComponent<GraphicRaycaster>();

        var txt = new GameObject("Hint").AddComponent<Text>();
        txt.transform.SetParent(canvas.transform, false);
        txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        txt.fontSize = 18;
        txt.color = Color.white;
        txt.alignment = TextAnchor.LowerLeft;
        txt.text = "WASD Move | Mouse Camera | LMB Shoot | E Enter | F Exit | 1/2/3 Weapons | Space Jump | J Mission | F5/F9 Save/Load";
        var rt = txt.rectTransform;
        rt.anchorMin = new Vector2(0, 0);
        rt.anchorMax = new Vector2(1, .1f);
        rt.offsetMin = new Vector2(20, 10);
        rt.offsetMax = new Vector2(-20, 0);
    }
}
