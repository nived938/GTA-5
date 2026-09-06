using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    public float WalkSpeed = 5f;
    public float SprintSpeed = 8.5f;
    public float Gravity = -22f;
    public float JumpHeight = 1.5f;
    public Transform CameraRoot;
    CharacterController controller;
    Camera cam;
    float verticalVelocity;

    void Awake(){controller=GetComponent<CharacterController>();cam=Camera.main;if(!CameraRoot&&cam)CameraRoot=cam.transform;}

    void Update()
    {
        if(GetComponent<VehicleController>()?.IsDriven==true) return;
        Vector3 f=CameraRoot?CameraRoot.forward:transform.forward; f.y=0; f.Normalize();
        Vector3 r=CameraRoot?CameraRoot.right:transform.right; r.y=0; r.Normalize();
        Vector3 input=new Vector3(Input.GetAxisRaw("Horizontal"),0,Input.GetAxisRaw("Vertical"));
        input=Vector3.ClampMagnitude(input,1);
        Vector3 move=(f*input.z+r*input.x);
        float speed=Input.GetKey(KeyCode.LeftShift)?SprintSpeed:WalkSpeed;
        controller.Move(move*speed*Time.deltaTime);
        if(move.sqrMagnitude>.01f) transform.rotation=Quaternion.Slerp(transform.rotation,Quaternion.LookRotation(move),12f*Time.deltaTime);
        if(controller.isGrounded&&verticalVelocity<0) verticalVelocity=-2f;
        if(Input.GetKeyDown(KeyCode.Space)&&controller.isGrounded) verticalVelocity=Mathf.Sqrt(JumpHeight*-2f*Gravity);
        verticalVelocity+=Gravity*Time.deltaTime;
        controller.Move(Vector3.up*verticalVelocity*Time.deltaTime);
    }
}
