using UnityEngine;
using UnityEngine.InputSystem;

public class SaveSystem:MonoBehaviour{
 public static int Cash=2500; public static SaveSystem Instance; Transform player;
 void Awake(){Instance=this;player=GameObject.FindGameObjectWithTag("Player")?.transform;}
 void Update(){Keyboard k=Keyboard.current;if(k?.f5Key.wasPressedThisFrame==true)Save();if(k?.f9Key.wasPressedThisFrame==true)Load();}
 public void Save(){if(!player)player=GameObject.FindGameObjectWithTag("Player")?.transform;if(player){PlayerPrefs.SetFloat("px",player.position.x);PlayerPrefs.SetFloat("py",player.position.y);PlayerPrefs.SetFloat("pz",player.position.z);}PlayerPrefs.SetInt("cash",Cash);PlayerPrefs.Save();}
 public void Load(){if(!player)player=GameObject.FindGameObjectWithTag("Player")?.transform;if(player)player.position=new Vector3(PlayerPrefs.GetFloat("px",0),PlayerPrefs.GetFloat("py",1.1f),PlayerPrefs.GetFloat("pz",10));Cash=PlayerPrefs.GetInt("cash",2500);}
}
