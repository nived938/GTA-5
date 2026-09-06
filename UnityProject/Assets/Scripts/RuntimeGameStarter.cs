using UnityEngine;

public static class RuntimeGameStarter
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void StartGame()
    {
        if (Object.FindFirstObjectByType<GameBootstrap>() != null)
            return;

        var root = new GameObject("LOS SANTOS GAME");
        Object.DontDestroyOnLoad(root);
        var bootstrap = root.AddComponent<GameBootstrap>();
        bootstrap.TrafficCount = 24;
        bootstrap.PedestrianCount = 20;
        bootstrap.GenerateOnStart = true;
    }
}