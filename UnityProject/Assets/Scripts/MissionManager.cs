using UnityEngine;
using UnityEngine.InputSystem;

public class MissionManager:MonoBehaviour{
 public int Reward=750; public string Current="NONE"; bool active; Vector3 target;
 void Update(){if(Keyboard.current?.jKey.wasPressedThisFrame==true&&!active)StartMission();if(active&&Vector3.Distance(GetPlayer().transform.position,target)<5){active=false;Current="COMPLETE";SaveSystem.Cash+=Reward;}}
 void StartMission(){active=true;Current="REACH DESTINATION";target=new Vector3(Random.Range(-90,90),1,Random.Range(-90,120));}
 GameObject GetPlayer()=>GameObject.FindGameObjectWithTag("Player");
}
