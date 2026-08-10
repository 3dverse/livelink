//==============================================================================
// Agent: this whole section is runtime-agnostic. It only depends on
// `@3dverse/livelink-agent` and could be lifted verbatim into a Node.js script.
//==============================================================================

import { Livelink } from "@3dverse/livelink-agent";
import type { ComponentsManifest, EntitiesDeletedEvent, Entity, Quat, Vec3 } from "@3dverse/livelink-agent";

//------------------------------------------------------------------------------
// Live-tunable settings of the orbiting choreography. Every field can be mutated
// in place on a running animation's `settings` object; edits take effect on the
// next frame, with no visual jump (see `animate`).
//------------------------------------------------------------------------------
export type OrbitingAnimationSettings = {
    // Base period of the closed Lissajous loop, in seconds. The whole swarm
    // repeats exactly every `loop_period_seconds` because each per-entity
    // frequency is an integer multiple of the base angular frequency.
    loop_period_seconds: number;
    orbit_radius: number;
    hover_height: number;
    hover_amplitude: number;
    // Loop tick rate. A live change is picked up by the self-rescheduling timer.
    frames_per_second: number;
    // Time-scale multiplier. 1 is nominal; bump it to make the swarm rush.
    speed: number;
};

export const DEFAULT_ORBITING_SETTINGS: OrbitingAnimationSettings = {
    loop_period_seconds: 16,
    orbit_radius: 2.5,
    hover_height: 1.5,
    hover_amplitude: 0.8,
    frames_per_second: 60,
    speed: 1,
};

//------------------------------------------------------------------------------
// Handle returned by `startOrbitingAnimation`. Mutate `settings` to retune the
// swarm live; call `stop` to end the loop.
//------------------------------------------------------------------------------
export type OrbitingAnimation = {
    settings: OrbitingAnimationSettings;
    // The entities still being animated. Shrinks as other clients delete them.
    readonly entities: ReadonlyArray<Entity>;
    stop: () => void;
};

//------------------------------------------------------------------------------
// The base angular frequency for the current loop period.
//------------------------------------------------------------------------------
function baseOmega(settings: OrbitingAnimationSettings): number {
    return (2 * Math.PI) / settings.loop_period_seconds;
}

//------------------------------------------------------------------------------
// Per-entity motion parameters and the live entity they drive.
//------------------------------------------------------------------------------
type MotionParams = {
    phase: number;
    harmonic_x: number;
    harmonic_y: number;
    harmonic_z: number;
};

type Motion = MotionParams & {
    entity: Entity;
};

// Mutable state advanced once per frame. We integrate over an accumulated base
// angle `phase_angle` rather than wall-clock time so that retuning `speed` or
// `loop_period_seconds` only changes the *rate* going forward — the angle stays
// continuous, so the swarm never snaps.
type AnimationState = {
    motions: Array<Motion>;
    phase_angle: number;
    last_frame_ms: number;
    timer: ReturnType<typeof setTimeout> | null;
};

//------------------------------------------------------------------------------
// Motion parameters for entity `i` of `count`. Integer harmonics keep every path
// closed (so it loops), while varying them per entity makes the swarm look
// pleasantly random.
//------------------------------------------------------------------------------
function makeMotionParams(i: number, count: number): MotionParams {
    return {
        // Spread the swarm evenly around the loop.
        phase: (i / count) * 2 * Math.PI,
        // Small, distinct integer harmonics -> varied yet closed curves.
        harmonic_x: 1 + (i % 3),
        harmonic_y: 1 + ((i + 1) % 2),
        harmonic_z: 1 + ((i + 2) % 3),
    };
}

//------------------------------------------------------------------------------
// A quaternion for a rotation of `yaw` radians about the Y (up) axis.
//------------------------------------------------------------------------------
function yawQuaternion(yaw: number): Quat {
    return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

//------------------------------------------------------------------------------
// The position of an entity on its closed path at accumulated base angle `theta`.
//------------------------------------------------------------------------------
function positionAt(motion: MotionParams, theta: number, settings: OrbitingAnimationSettings): Vec3 {
    const { phase, harmonic_x, harmonic_y, harmonic_z } = motion;
    return [
        settings.orbit_radius * Math.sin(harmonic_x * theta + phase),
        settings.hover_height + settings.hover_amplitude * Math.sin(harmonic_y * theta + phase),
        settings.orbit_radius * Math.cos(harmonic_z * theta + phase),
    ];
}

//------------------------------------------------------------------------------
// Advance every entity by one frame. The elapsed wall-clock time `dt` since the
// last frame is scaled by `speed` and the base angular frequency and folded into
// the accumulated angle, so the loop is framerate-independent.
//------------------------------------------------------------------------------
function animate(state: AnimationState, settings: OrbitingAnimationSettings): void {
    const now = performance.now();
    const dt = (now - state.last_frame_ms) / 1000;
    state.last_frame_ms = now;
    state.phase_angle += baseOmega(settings) * settings.speed * dt;

    const theta = state.phase_angle;
    for (const motion of state.motions) {
        motion.entity.updateComponent("local_transform", {
            position: positionAt(motion, theta, settings),
            // One full turn per loop period -> orientation also loops seamlessly.
            orientation: yawQuaternion(theta + motion.phase),
        });
    }
}

//------------------------------------------------------------------------------
export async function startOrbitingAnimation({
    livelink,
    objects,
    tags,
    settings: overrides,
}: {
    livelink: Livelink;
    objects: Array<{
        material_ref: string;
        mesh_ref: string;
    }>;
    // Tags applied to every spawned entity. Lets consumers recognize their own swarm among the
    // entities they receive from the session — e.g. when picking one with the mouse.
    tags?: Array<string>;
    settings?: Partial<OrbitingAnimationSettings>;
}): Promise<OrbitingAnimation> {
    const settings: OrbitingAnimationSettings = { ...DEFAULT_ORBITING_SETTINGS, ...overrides };

    const motions: Array<Motion> = [];
    const components_array: Array<ComponentsManifest> = [];
    const motion_params_array: Array<MotionParams> = [];
    for (let i = 0; i < objects.length; ++i) {
        const params = makeMotionParams(i, objects.length);
        motion_params_array.push(params);
        components_array.push({
            debug_name: { value: `Orbiter ${i}` },
            local_transform: {
                position: positionAt(params, 0, settings),
                scale: [0.6, 0.6, 0.6],
            },
            mesh_ref: { value: objects[i].mesh_ref },
            material_ref: { value: objects[i].material_ref },
            ...(tags ? { tags: { value: tags } } : {}),
        });
    }

    const entities = await livelink.scene.newEntities({
        components_array,
        options: {
            // For smooth animation, we don't want the server to
            // broadcast the entity's transform to other clients.
            auto_broadcast: false,
            delete_on_client_disconnection: true,
        },
    });
    entities.forEach((entity, i) => {
        console.log(`Spawning entity ${entity.id} (${entity.name})`);
        const params = motion_params_array[i];
        motions.push({ entity, ...params });
    });

    const state: AnimationState = {
        motions,
        phase_angle: 0,
        last_frame_ms: performance.now(),
        timer: null,
    };

    // Idempotent: stops the loop and detaches the listeners. Called both by the consumer and
    // automatically when the session disconnects.
    const stop = (): void => {
        if (state.timer !== null) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        livelink.session.removeEventListener("on-disconnected", onDisconnected);
        livelink.scene.removeEventListener("on-entities-deleted", onEntitiesDeleted);
    };

    // Self-stop when the session drops, so the loop never keeps mutating entities against a
    // disconnected session.
    const onDisconnected = (): void => {
        stop();
    };
    livelink.session.addEventListener("on-disconnected", onDisconnected);

    // Drop entities another client deleted. Animating a deleted entity would keep re-queuing it in
    // the scene's dirty list on every frame, forever. Note that this only catches *remote*
    // deletions: a client's own deletions raise no local event, so a consumer that deletes swarm
    // entities itself must stop the animation instead.
    const onEntitiesDeleted = (event: EntitiesDeletedEvent): void => {
        state.motions = state.motions.filter(motion => !event.includes(motion.entity));
    };
    livelink.scene.addEventListener("on-entities-deleted", onEntitiesDeleted);

    // Self-rescheduling tick rather than a fixed `setInterval`, so a live edit of
    // `settings.frames_per_second` takes effect on the very next frame.
    const tick = (): void => {
        animate(state, settings);
        state.timer = setTimeout(tick, 1000 / settings.frames_per_second);
    };
    state.timer = setTimeout(tick, 1000 / settings.frames_per_second);

    return {
        settings,
        get entities(): ReadonlyArray<Entity> {
            return state.motions.map(motion => motion.entity);
        },
        stop,
    };
}
