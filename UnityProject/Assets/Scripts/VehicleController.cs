using UnityEngine;
using UnityEngine.InputSystem;

public class VehicleController : MonoBehaviour
{
    public bool PlayerVehicle;
    public float MotorTorque=1800f, BrakeTorque=3000f, MaxSteerAngle=32f, ParkSteerSpeed=22f;
    public WheelCollider FrontLeft,FrontRight,RearLeft,RearRight;
    public Transform FrontLeftVisual,FrontRightVisual,RearLeftVisual,RearRightVisual;
    public bool IsDriven {get;private set;}
    Rigidbody rb;
    Transform driver;
    ThirdPersonCamera cam;

    public void SetupWheels(Material tireMat){
        rb=GetComponent<Rigidbody>();
        CreateWheel("FL",new Vector3(-.82f,.28f,1.45f),true,out FrontLeft,out FrontLeftVisual);
        CreateWheel("FR",new Vector3(.82f,.28f,1.45f),true,out FrontRight,out FrontRightVisual);
        CreateWheel("RL",new Vector3(-.82f,.28f,-1.45f),false,out RearLeft,out RearLeftVisual);
        CreateWheel("RR",new Vector3(.82f,.28f,-1.45f),false,out RearRight,out RearRightVisual);
    }
    void CreateWheel(string n,Vector3 pos,bool steer,out WheelCollider wc,out Transform visual){
        var go=new GameObject(n);go.transform.SetParent(transform);go.transform.localPosition=pos;go.transform.localRotation=Quaternion.identity;
        wc=go.AddComponent<WheelCollider>();wc.radius=.34f;wc.mass=35;wc.suspensionDistance=.22f;wc.center=Vector3.down*.02f;wc.steerAngle=0;
        var spring=wc.suspensionSpring;spring.spring=28000;spring.damper=4500;spring.targetPosition=.5f;wc.suspensionSpring=spring;wc.forwardFriction=new WheelFrictionCurve{extremumSlip=.35f,extremumValue=1f,asymptoteSlip=.8f,asymptoteValue=.8f,stiffness=1.6f};wc.sidewaysFriction=new WheelFrictionCurve{extremumSlip=.2f,extremumValue=1f,asymptoteSlip=.5f,asymptoteValue=.75f,stiffness=2f};
        var mesh=GameObject.CreatePrimitive(PrimitiveType.Cylinder);mesh.name=n+"_Visual";mesh.transform.SetParent(go.transform);mesh.transform.localPosition=Vector3.zero;mesh.transform.localRotation=Quaternion.Euler(0,0,90);mesh.transform.localScale=new Vector3(.34f,.11f,.34f);Object.Destroy(mesh.GetComponent<Collider>());mesh.GetComponent<Renderer>().material=new Material(Shader.Find("Universal Render Pipeline/Lit")){color=new Color(.015f,.015f,.015f)};visual=mesh.transform;
    }
    void Update(){
        if(!PlayerVehicle||rb==null)return;
        if(!IsDriven){
            if(Keyboard.current?.eKey.wasPressedThisFrame==true&&NearPlayer())Enter();
            return;
        }
        if(Keyboard.current?.fKey.wasPressedThisFrame==true||Keyboard.current?.eKey.wasPressedThisFrame==true)Exit();
        float throttle=0; if(Keyboard.current?.wKey.isPressed==true)throttle+=1; if(Keyboard.current?.sKey.isPressed==true)throttle-=1;
        float steer=0; if(Keyboard.current?.aKey.isPressed==true)steer-=1; if(Keyboard.current?.dKey.isPressed==true)steer+=1;
        float speed=rb.linearVelocity.magnitude*3.6f;
        float steerAngle=steer*MaxSteerAngle*Mathf.Lerp(1f,.45f,Mathf.Clamp01(speed/80f));
        FrontLeft.steerAngle=steerAngle;FrontRight.steerAngle=steerAngle;
        float drive=throttle*MotorTorque;FrontLeft.motorTorque=drive;FrontRight.motorTorque=drive;RearLeft.motorTorque=drive;RearRight.motorTorque=drive;
        float brake=(throttle==0?BrakeTorque:0)+(throttle<0&&speed>3?BrakeTorque*.5f:0);FrontLeft.brakeTorque=brake;FrontRight.brakeTorque=brake;RearLeft.brakeTorque=brake;RearRight.brakeTorque=brake;
        if(Mathf.Abs(steer)>.01f&&speed<ParkSteerSpeed){
            float yaw=steer*1.2f*Time.deltaTime; transform.Rotate(0,yaw,0,Space.World); rb.angularVelocity=Vector3.zero;
        }
        UpdateVisual(FrontLeft,FrontLeftVisual);UpdateVisual(FrontRight,FrontRightVisual);UpdateVisual(RearLeft,RearLeftVisual);UpdateVisual(RearRight,RearRightVisual);
        GetComponentInChildren<Camera>();
    }
    bool NearPlayer(){var p=GameObject.FindGameObjectWithTag("Player");return p&&Vector3.Distance(p.transform.position,transform.position)<4f;}
    void Enter(){var p=GameObject.FindGameObjectWithTag("Player");if(!p)return;driver=p.transform;var cc=p.GetComponent<CharacterController>();if(cc)cc.enabled=false;p.SetActive(false);IsDriven=true;cam=Camera.main?Camera.main.GetComponent<ThirdPersonCamera>():null;if(cam)cam.SetTarget(transform);}
    void Exit(){if(!driver)return;driver.gameObject.SetActive(true);driver.position=transform.position-transform.right*2.2f;driver.rotation=transform.rotation;var cc=driver.GetComponent<CharacterController>();if(cc)cc.enabled=true;IsDriven=false;driver=null;cam=Camera.main?Camera.main.GetComponent<ThirdPersonCamera>():null;if(cam)cam.SetTarget(GameObject.FindGameObjectWithTag("Player").transform);}
    void UpdateVisual(WheelCollider wc,Transform visual){wc.GetWorldPose(out var p,out var q);visual.position=p;visual.rotation=q*Quaternion.Euler(0,0,90);}
}
