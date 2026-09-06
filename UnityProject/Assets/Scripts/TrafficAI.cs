using UnityEngine;

public class TrafficAI:MonoBehaviour{
 public float Speed=9f,TurnAvoidDistance=7f; Rigidbody rb; float baseY;
 void Awake(){rb=GetComponent<Rigidbody>();baseY=transform.position.y;}
 void FixedUpdate(){if(!rb)return;Vector3 origin=transform.position+Vector3.up*.5f;float v=Speed;if(Physics.SphereCast(origin,1.1f,transform.forward,out RaycastHit hit,TurnAvoidDistance)){if(hit.collider.GetComponentInParent<BuildingInterior>()||hit.collider.GetComponent<VehicleController>())v=0;}
 rb.linearVelocity=transform.forward*v+Vector3.up*rb.linearVelocity.y;}
}
