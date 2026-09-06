using UnityEngine;

public class BuildingInterior:MonoBehaviour{
 public string BuildingName="ENTERABLE BUILDING"; bool inside; GameObject room;
 public void Toggle(PlayerController player){if(!inside)Enter(player);else Exit(player);}
 void Enter(PlayerController p){inside=true; if(!room){room=new GameObject(BuildingName+" Interior");room.transform.position=transform.position+Vector3.up*.02f;var floor=GameObject.CreatePrimitive(PrimitiveType.Cube);floor.transform.SetParent(room.transform);floor.transform.localScale=new Vector3(16,.1f,16);floor.transform.localPosition=Vector3.zero;floor.GetComponent<Renderer>().material=new Material(Shader.Find("Universal Render Pipeline/Lit")){color=new Color(.22f,.22f,.24f)};for(int i=-1;i<=1;i++){var prop=GameObject.CreatePrimitive(PrimitiveType.Cube);prop.transform.SetParent(room.transform);prop.transform.localScale=new Vector3(2,1.2f,2);prop.transform.localPosition=new Vector3(i*4,.65f,1.5f);prop.GetComponent<Renderer>().material=new Material(Shader.Find("Universal Render Pipeline/Lit")){color=new Color(.35f,.15f,.1f)};}}
 room.SetActive(true);gameObject.SetActive(false);p.transform.position=room.transform.position+Vector3.back*3;}
 void Exit(PlayerController p){inside=false;gameObject.SetActive(true);if(room)room.SetActive(false);p.transform.position=transform.position+transform.forward*4;}
}
