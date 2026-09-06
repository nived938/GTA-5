using UnityEngine;
using UnityEngine.InputSystem;

public class ThirdPersonCamera : MonoBehaviour
{
    public Transform Target;
    public float Distance=7f, Height=2.6f, Sensitivity=.12f, Smooth=12f;
    float yaw=0,pitch=12;
    void LateUpdate(){
        if(!Target)return;
        if(Mouse.current!=null&&Cursor.lockState==CursorLockMode.Locked){var d=Mouse.current.delta.ReadValue();yaw+=d.x*Sensitivity;pitch=Mathf.Clamp(pitch-d.y*Sensitivity,-15,55);}
        Vector3 offset=Quaternion.Euler(pitch,yaw,0)*new Vector3(0,0,-Distance);
        Vector3 desired=Target.position+Vector3.up*Height+offset;
        transform.position=Vector3.Lerp(transform.position,desired,1-Mathf.Exp(-Smooth*Time.deltaTime));
        transform.LookAt(Target.position+Vector3.up*(Target.CompareTag("Player")?1.25f:1.1f));
    }
    public void SetTarget(Transform t){Target=t;}
}
