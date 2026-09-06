#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class LosSantosSceneGenerator
{
    static LosSantosSceneGenerator()
    {
        EditorApplication.delayCall += TryGenerateActiveScene;
    }

    [MenuItem("Los Santos/Generate Playable Scene")]
    public static void GeneratePlayableScene()
    {
        var scene = SceneManager.GetActiveScene();
        if (scene.path.EndsWith("Assets/Scenes/LosSantos.unity") == false)
        {
            Debug.Log("Open Assets/Scenes/LosSantos.unity first.");
            return;
        }
        Generate(scene);
    }

    static void TryGenerateActiveScene()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode)
            return;

        var scene = SceneManager.GetActiveScene();
        if (!scene.IsValid() || !scene.path.EndsWith("Assets/Scenes/LosSantos.unity"))
            return;

        if (Object.FindFirstObjectByType<GameBootstrap>() == null)
            Generate(scene);
    }

    static void Generate(Scene scene)
    {
        if (Object.FindFirstObjectByType<GameBootstrap>() != null)
            return;

        var root = new GameObject("LOS SANTOS GAME");
        SceneManager.MoveGameObjectToScene(root, scene);

        var bootstrap = root.AddComponent<GameBootstrap>();
        bootstrap.TrafficCount = 24;
        bootstrap.PedestrianCount = 20;
        bootstrap.GenerateOnStart = false;
        bootstrap.BuildGame();

        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene);
        Selection.activeGameObject = root;
        Debug.Log("Los Santos playable scene generated. Select LOS SANTOS GAME to edit the bootstrap settings.");
    }
}
#endif
