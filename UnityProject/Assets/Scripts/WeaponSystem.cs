using UnityEngine;
using UnityEngine.InputSystem;

public class WeaponSystem:MonoBehaviour{
 [System.Serializable] public class Weapon{public string Name="9MM";public int Magazine=12,Reserve=120,Damage=35;public float Cooldown=.18f;}
 public Weapon[] Weapons={new Weapon(),new Weapon{Name="SMG",Magazine=30,Reserve=180,Damage=18,Cooldown=.08f},new Weapon{Name="SHOTGUN",Magazine=6,Reserve=48,Damage=70,Cooldown=.65f}};
 int index;int[] ammo;float cd,reload;Camera cam;
 void Start(){ammo=new int[Weapons.Length];for(int i=0;i<ammo.Length;i++)ammo[i]=Weapons[i].Magazine;cam=Camera.main;}
 void Update(){if(!gameObject.activeSelf)return;Keyboard k=Keyboard.current;if(k==null)return;if(k.digit1Key.wasPressedThisFrame)index=0;if(k.digit2Key.wasPressedThisFrame&&Weapons.Length>1)index=1;if(k.digit3Key.wasPressedThisFrame&&Weapons.Length>2)index=2;if(k.rKey.wasPressedThisFrame)StartReload();cd-=Time.deltaTime;if(reload>0){reload-=Time.deltaTime;if(reload<=0)ReloadNow();}if(Mouse.current?.leftButton.wasPressedThisFrame==true)Fire();}
 void StartReload(){if(reload>0||ammo[index]>=Weapons[index].Magazine||Weapons[index].Reserve<=0)return;reload=.8f;}
 void ReloadNow(){int n=Mathf.Min(Weapons[index].Magazine-ammo[index],Weapons[index].Reserve);ammo[index]+=n;Weapons[index].Reserve-=n;}
 void Fire(){if(cd>0||reload>0||ammo[index]<=0)return;ammo[index]--;cd=Weapons[index].Cooldown;if(!cam)cam=Camera.main;if(!cam)return;Ray ray=cam.ViewportPointToRay(new Vector3(.5f,.5f,0));if(Physics.Raycast(ray,out RaycastHit hit,100)){var hp=hit.collider.GetComponentInParent<Health>();if(hp)hp.Damage(Weapons[index].Damage);}}
 public string AmmoText()=>$"{Weapons[index].Name}  {ammo[index]} / {Weapons[index].Reserve}";
}
public class Health:MonoBehaviour{public int Value=100;public void Damage(int amount){Value-=amount;if(Value<=0)Destroy(gameObject);}}
