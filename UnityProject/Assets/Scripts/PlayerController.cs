using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    public float WalkSpeed = 5f;
    public float SprintSpeed = 8.5f;
    public float Gravity = -22f;
    public float JumpHeight = 1.5f;

    CharacterController controller;
    Transform cameraTransform;
    float verticalVelocity;

    void Awake()
    {
        controller = GetComponent<CharacterController>();
    }

    void Update()
    {
        Keyboard keyboard = Keyboard.current;
        if (keyboard == null || !gameObject.activeSelf) return;

        if (!cameraTransform && Camera.main)
            cameraTransform = Camera.main.transform;

        Vector2 input = new Vector2(
            (keyboard.dKey.isPressed ? 1f : 0f) - (keyboard.aKey.isPressed ? 1f : 0f),
            (keyboard.wKey.isPressed ? 1f : 0f) - (keyboard.sKey.isPressed ? 1f : 0f));
        input = Vector2.ClampMagnitude(input, 1f);

        Vector3 forward = cameraTransform ? cameraTransform.forward : transform.forward;
        Vector3 right = cameraTransform ? cameraTransform.right : transform.right;
        forward.y = 0f;
        right.y = 0f;
        forward.Normalize();
        right.Normalize();

        Vector3 move = forward * input.y + right * input.x;
        float speed = keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed ? SprintSpeed : WalkSpeed;
        controller.Move(move * speed * Time.deltaTime);

        if (move.sqrMagnitude > .01f)
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(move), 12f * Time.deltaTime);

        if (controller.isGrounded && verticalVelocity < 0f)
            verticalVelocity = -2f;

        if (keyboard.spaceKey.wasPressedThisFrame && controller.isGrounded)
            verticalVelocity = Mathf.Sqrt(JumpHeight * -2f * Gravity);

        verticalVelocity += Gravity * Time.deltaTime;
        controller.Move(Vector3.up * verticalVelocity * Time.deltaTime);

        if (keyboard.eKey.wasPressedThisFrame)
            TryBuilding();
    }

    void TryBuilding()
    {
        var buildings = FindObjectsByType<BuildingInterior>(FindObjectsSortMode.None);
        BuildingInterior closest = null;
        float distance = 4f;

        foreach (var building in buildings)
        {
            if (!building.gameObject.activeInHierarchy) continue;
            float d = Vector3.Distance(transform.position, building.transform.position);
            if (d < distance)
            {
                distance = d;
                closest = building;
            }
        }

        if (closest)
            closest.Toggle(this);
    }
}
