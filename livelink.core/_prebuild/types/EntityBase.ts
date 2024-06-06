/**
 * DO NOT EDIT THIS FILE MANUALLY.
 * This file has been generated automatically from ftl-schemas
 */
import type * as Components from "./components";
import { EditorEntity, RTID, UUID } from "../types";

/**
 *
 */
export class EntityBase extends EventTarget {
    /**
     *
     */
    private euid: Components.Euid | null = null;

    /**
     * Animation controller with reference to an animation graph and an animation set. Enables skeletal animation on its skinned mesh descendents whose skeleton is compatible with the animations in the animation set.
     */
    animation_controller?: Components.AnimationController;

    /**
     * Links entity to bone in skeleton.
     */
    bone?: Components.Bone;

    /**
     * Box geometry.
     */
    box_geometry?: Components.BoxGeometry;

    /**
     * Virtual camera.
     */
    camera?: Components.Camera;

    /**
     * Capsule geometry.
     */
    capsule_geometry?: Components.CapsuleGeometry;

    /**
     * Character controller used for movement constrained by collisions without having to deal with a rigid body. A character controller is kinematic, and so is not affected by forces. It uses its own tweaked collision algorithm to give a good feeling while controlling the character.
     */
    character_controller?: Components.CharacterController;

    /**
     * Reference to a collision geometry.
     */
    collision_geometry_ref?: Components.CollisionGeometryRef;

    /**
     * A physics constraint that can be configured along 6 degrees of freedom. In its default state it behaves as a fixed constraint - that is, it rigidly fixes the constraint frames of its two entities. However, individual degrees of freedom may be unlocked to permit any combination of rotation around the x-, y- and z- axes, and translation along these axes.
     */
    constraint?: Components.Constraint;

    /**
     * Culling geometry. Add this component in addition to another geometry component (e.g. box geometry, sphere geometry, etc.) to enable culling geometry.
     */
    culling_geometry?: Components.CullingGeometry;

    /**
     * Cylinder geometry.
     */
    cylinder_geometry?: Components.CylinderGeometry;

    /**
     * Name of the entity.
     */
    debug_name?: Components.DebugName;

    /**
     * Decal Projector.
     */
    decal_projector?: Components.DecalProjector;

    /**
     * The environment of a scene. Used to give a scene a skybox.
     */
    environment?: Components.Environment;

    /**
     * Base component of all the other joint components (revolute_joint, etc.). By itself it will lock the orientations and distances of the constrainer and constrainee.
     */
    joint?: Components.Joint;

    /**
     * Lineage of the entity through linkers.
     */
    lineage?: Components.Lineage;

    /**
     * Local Axis Aligned Bounding Box of the entity.
     */
    local_aabb?: Components.LocalAabb;

    /**
     * Local transform of the entity.
     */
    local_transform?: Components.LocalTransform;

    /**
     * References a shader and specifies input values if needed.
     */
    material?: Components.Material;

    /**
     * Reference to a material.
     */
    material_ref?: Components.MaterialRef;

    /**
     * Reference to a mesh.
     */
    mesh_ref?: Components.MeshRef;

    /**
     * A lens that applies an orthographic projection.
     */
    orthographic_lens?: Components.OrthographicLens;

    /**
     * Overrides a given entity in a sub scene.
     */
    overrider?: Components.Overrider;

    /**
     * A lens that applies a perspective projection.
     */
    perspective_lens?: Components.PerspectiveLens;

    /**
     * Physics material which represents a set of physical surface properties.
     */
    physics_material?: Components.PhysicsMaterial;

    /**
     * Plane geometry.
     */
    plane_geometry?: Components.PlaneGeometry;

    /**
     * Reference to a point cloud.
     */
    point_cloud_ref?: Components.PointCloudRef;

    /**
     * A light with color and intensity. A point light by default, add a spot light component to add a cutoff. Can be parameterized to simulate the atmosphere sun.
     */
    point_light?: Components.PointLight;

    /**
     * Omni directional reflection probe parameters, used for local cubemap reflection generation.
     */
    reflection_probe?: Components.ReflectionProbe;

    /**
     * Revolute joint which keeps the origins and x-axes of the frames together, and allows free rotation around this common axis.
     */
    revolute_joint?: Components.RevoluteJoint;

    /**
     * Rigid body parameters.
     */
    rigid_body?: Components.RigidBody;

    /**
     * Reference to a scene.
     */
    scene_ref?: Components.SceneRef;

    /**
     * References a script and specifies input values if needed.
     */
    script_element?: Components.ScriptElement;

    /**
     * References multiple scripts.
     */
    script_map?: Components.ScriptMap;

    /**
     * Enables a light to cast shadows.
     */
    shadow_caster?: Components.ShadowCaster;

    /**
     * Reference to a skeleton.
     */
    skeleton_ref?: Components.SkeletonRef;

    /**
     * Reference to a sound.
     */
    sound_ref?: Components.SoundRef;

    /**
     * Sphere geometry.
     */
    sphere_geometry?: Components.SphereGeometry;

    /**
     * Adds a cutoff to a point light to simulate a spot light.
     */
    spot_light?: Components.SpotLight;

    /**
     * A lens that applies an off-center perspective projection.
     */
    stereoscopic_lens?: Components.StereoscopicLens;

    /**
     * Tags used to filter entities.
     */
    tags?: Components.Tags;

    /**
     * Vehicle Controller parameters.
     */
    vehicle_controller?: Components.VehicleController;

    /**
     * Filtering properties applied to the volume.
     */
    volume_filter?: Components.VolumeFilter;

    /**
     * Reference to a material to use with a volume.
     */
    volume_material_ref?: Components.VolumeMaterialRef;

    /**
     * Reference to a volume made of voxels.
     */
    volume_ref?: Components.VolumeRef;

    /**
     *
     */
    get rtid(): RTID | null {
        return this.euid?.rtid ?? null;
    }
    /**
     *
     */
    get id(): UUID | null {
        return this.euid?.value ?? null;
    }
    /**
     *
     */
    get name(): string {
        return this.debug_name?.value ?? "<unnamed>";
    }

    /**
     *
     */
    isInstantiated(): boolean {
        return this.euid !== null;
    }

    /**
     *
     */
    protected _parse({ editor_entity }: { editor_entity: EditorEntity }) {
        const components = editor_entity.components;
        if (!components.euid) {
            throw new Error("Trying to parse an entity without EUID");
        }

        this.euid = {
            value: (components.euid as { value: UUID }).value,
            rtid: BigInt(editor_entity.rtid),
        };

        delete components.euid;

        for (const component_type in components) {
            this[component_type] = components[component_type];
        }

        // Remove any undefined component
        for (const k of Object.keys(this)) {
            if (this[k] === undefined) {
                delete this[k];
            }
        }
    }
}
