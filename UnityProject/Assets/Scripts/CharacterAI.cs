using UnityEngine;

public class CharacterAI:MonoBehaviour{
 public float Speed=1.4f; Vector3 target; float timer;
 void Start(){target=transform.position;timer=Random.Range(0,3f);}
 void Update(){timer-=Time.deltaTime;if(timer<=0){timer=Random.Range(2,5);target=transform.position+new Vector3(Random.Range(-10,10),0,Random.Range(-10,10));}Vector3 d=target-transform.position;d.y=0;if(d.sqrMagnitude>.5f){d.Normalize();transform.position+=d*Speed*Time.deltaTime;transform.forward=Vector3.Slerp(transform.forward,d,.08f);}}
}
