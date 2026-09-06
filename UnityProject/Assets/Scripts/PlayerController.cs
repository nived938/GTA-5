using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(CharacterController))]
public class PlayerController:MonoBehaviour{
 public float WalkSpeed=5, SprintSpeed=8.5f, Gravity=-22, JumpHeight=1.5f; CharacterController cc; Transform cam; float vy;
 void Awake(){cc=GetComponent<CharacterController>();}
 void Update(){Keyboard k=Keyboard.current;if(k==null||!gameObject.activeSelf)return;if(!cam&&Camera.main)cam=Camera.main.transform;Vector2 i=new Vector2((k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0));i=Vector2.ClampMagnitude(i,1);Vector3 f=cam?cam.forward:transform.forward,r=cam?cam.right:transform.right;f.y=0;r.y=0;f.Normalize();r.Normalize();Vector3 move=f*i.y+r*i.x;float sp=k.leftShiftKey.isPressed?SprintSpeed:WalkSpeed;cc.Move(move*sp*Time.deltaTime);if(move.sqrMagnitude>.01f)transform.rotation=Quaternion.Slerp(transform.rotation,Quaternion.LookRotation(move),12*Time.deltaTime);if(cc.isGrounded&&vy<0)vy=-2;if(k.spaceKey.wasPressedThisFrame&&cc.isGrounded)vy=Mathf.Sqrt(JumpHeight*-2*Gravity);vy+=Gravity*Time.deltaTime;cc.Move(Vector3.up*vy*Time.deltaTime);if(k.eKey.wasPressedThisFrame)TryBuilding();}
 void TryBuilding(){var bs=FindObjectsByType<BuildingInterior>(FindObjectsSortMode.None);BuildingInterior best=null;float d=4;foreach(var b in bs){float q=Vector3.Distance(transform.position,b.transform.position);if(q<d){d=q;best=b;}}if(best)best.Toggle(this);}
}
