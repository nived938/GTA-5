using UnityEngine;

public static class RuntimeGameStarter
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void StartGame()
    {
        var bootstrap = Object.FindFirstObjectByType<GameBootstrap>();
        if (bootstrap != null)
        {
            bootstrap.GenerateOnStart = false;
            bootstrap.BuildGame();
            return;
        }

        var root = new GameObject("LOS SANTOS GAME");
        Object.DontDestroyOnLoad(root);
        bootstrap = root.AddComponent<GameBootstrap>();
        bootstrap.TrafficCount = 24;
        bootstrap.PedestrianCount = 20;
        bootstrap.GenerateOnStart = false;
        bootstrap.BuildGame();
    }
}