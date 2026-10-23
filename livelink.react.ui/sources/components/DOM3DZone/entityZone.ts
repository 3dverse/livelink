//------------------------------------------------------------------------------
// A zone round an entity, after Mitek's control zone pad: a disc of glass on the floor round it, ringed
// in light and ticked like a dial, and a curtain of light rising off its rim, going wherever the entity
// goes. A sweep over the pad points the way the entity faces, turning as it turns, a dashed ring with
// it: the zone says where the entity is headed, from wherever it is seen. See `EntityZoneOptions` for
// what can be changed of it.
//
// three.js, in world meters. Drawn over the stream, which hands it no depth: the entity cannot hide
// what of the zone is behind it. Its bounding box, when it is given one, stands in for it, turning with
// it: every point of the zone the box stands in front of fades out, softly about the box's outline
// rather than cut along it — the far side of the curtain and the pad, and the pad under the entity.
// See `OCCLUSION_GLSL`.
//------------------------------------------------------------------------------
import {
    BackSide,
    Color,
    CylinderGeometry,
    FrontSide,
    Group,
    Matrix4,
    Mesh,
    PlaneGeometry,
    Quaternion,
    ShaderMaterial,
    type Side,
    Vector3,
} from "three";
import type { Entity } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { EntityZoneColors, ResolvedEntityZoneOptions } from "./entityZoneOptions";

//------------------------------------------------------------------------------
/** Segments round the curtain: enough that its rim reads round up close. */
const CURTAIN_SEGMENTS = 96;

/** Under this much turn between two frames, the entity is taken as going straight: the trail stays as it was. */
const MIN_TURN_RAD = 1e-4;

const UNIT_SCALE = new Vector3(1, 1, 1);

//------------------------------------------------------------------------------
/** What the zone's materials share to fade where the entity stands in front of them: see `OCCLUSION_GLSL`. */
type OcclusionUniforms = {
    /** From the world into the box's frame — the entity's, as it is turned now. */
    uBoxFromWorld: { value: Matrix4 };
    uBoxCenter: { value: Vector3 };
    uBoxHalfSize: { value: Vector3 };
    uSoftnessRad: { value: number };
};

//------------------------------------------------------------------------------
export class EntityZone {
    //--------------------------------------------------------------------------
    readonly root = new Group();
    readonly #entity: Entity;
    readonly #pad: Mesh<PlaneGeometry, ShaderMaterial>;
    /** The curtain's far half, drawn before the pad, and its near half, after: one cylinder, seen from either side. */
    readonly #farCurtain: Mesh<CylinderGeometry, ShaderMaterial>;
    readonly #nearCurtain: Mesh<CylinderGeometry, ShaderMaterial>;
    /** Shared by reference by every material: set once a frame, read by all. */
    readonly #occlusion: OcclusionUniforms;
    readonly #orientation = new Quaternion();
    readonly #facing = new Vector3();
    /** Whether the trail's way is taken from how the entity turns, rather than given. */
    readonly #isTurnInferred: boolean;
    #turnDirection: 1 | -1;
    #lastHeading: number | null = null;
    #clockS = 0;
    #lastFrameMs = 0;

    //--------------------------------------------------------------------------
    constructor(options: ResolvedEntityZoneOptions, colors: EntityZoneColors) {
        //----------------------------------------------------------------------
        const { radiusM, curtainHeightM, occluder, show } = options;
        this.#entity = options.entity;
        this.#isTurnInferred = options.turnDirection === undefined;
        this.#turnDirection = options.turnDirection ?? 1;
        this.#occlusion = createOcclusionUniforms(options);

        //----------------------------------------------------------------------
        this.#pad = new Mesh(
            new PlaneGeometry(2 * radiusM, 2 * radiusM),
            createPadMaterial(this.#occlusion, occluder !== undefined),
        );
        this.#pad.rotation.x = -Math.PI / 2;
        this.#pad.position.y = 0.002;
        const pad = this.#pad.material.uniforms;
        pad.uRadius.value = radiusM;
        pad.uShowTicks.value = Number(show.ticks);
        pad.uShowDashedRing.value = Number(show.dashedRing);
        pad.uShowSweep.value = Number(show.sweep);
        this.#pad.renderOrder = 1;

        //----------------------------------------------------------------------
        const curtain = new CylinderGeometry(radiusM, radiusM, curtainHeightM, CURTAIN_SEGMENTS, 1, true);
        this.#farCurtain = new Mesh(curtain, createCurtainMaterial(BackSide, this.#occlusion, occluder !== undefined));
        this.#nearCurtain = new Mesh(
            curtain,
            createCurtainMaterial(FrontSide, this.#occlusion, occluder !== undefined),
        );
        for (const [mesh, renderOrder] of [
            [this.#farCurtain, 0],
            [this.#nearCurtain, 2],
        ] as const) {
            mesh.position.y = curtainHeightM / 2;
            mesh.renderOrder = renderOrder;
            mesh.visible = show.curtain && curtainHeightM > 0;
        }

        this.root.add(this.#farCurtain, this.#pad, this.#nearCurtain);
        this.setColors(colors);
    }

    //--------------------------------------------------------------------------
    /** Colours three.js reads: resolved, see `resolveZoneColors`. */
    setColors(colors: EntityZoneColors): void {
        const pad = this.#pad.material.uniforms;
        pad.uGlass.value.setStyle(colors.glass);
        pad.uEdge.value.setStyle(colors.edge);
        pad.uSweep.value.setStyle(colors.sweep);
        for (const curtain of [this.#farCurtain, this.#nearCurtain]) {
            curtain.material.uniforms.uColor.value.setStyle(colors.edge);
        }
    }

    //--------------------------------------------------------------------------
    dispose(): void {
        // The curtain's halves share their geometry.
        for (const mesh of [this.#pad, this.#farCurtain]) {
            mesh.geometry.dispose();
        }
        for (const mesh of [this.#pad, this.#farCurtain, this.#nearCurtain]) {
            mesh.material.dispose();
        }
        this.root.removeFromParent();
    }

    //--------------------------------------------------------------------------
    // Frame
    //--------------------------------------------------------------------------

    /** Moves the zone on to now, at the entity's feet as it stands now, for the frame about to be drawn. */
    update(): void {
        //----------------------------------------------------------------------
        const nowMs = performance.now();
        const dt = this.#lastFrameMs > 0 ? Math.min((nowMs - this.#lastFrameMs) / 1000, 0.1) : 0;
        this.#lastFrameMs = nowMs;
        this.#clockS += dt;

        //----------------------------------------------------------------------
        // In the world, which its parent may turn or move. The zone itself stays upright and unturned,
        // its pad's sweep turning instead: only the box turns with the entity, however it is turned.
        const { position, orientation } = this.#entity.global_transform;
        this.root.position.fromArray(position);
        this.#orientation.fromArray(orientation);
        this.#occlusion.uBoxFromWorld.value.compose(this.root.position, this.#orientation, UNIT_SCALE).invert();

        // The heading of its own +Z about world Y: 0 along world +Z, growing as +Z turns towards +X —
        // counter-clockwise, seen from above.
        const facing = this.#facing.set(0, 0, 1).applyQuaternion(this.#orientation);
        const heading = Math.atan2(facing.x, facing.z);
        if (this.#isTurnInferred && this.#lastHeading !== null) {
            const turn = Math.atan2(Math.sin(heading - this.#lastHeading), Math.cos(heading - this.#lastHeading));
            if (Math.abs(turn) > MIN_TURN_RAD) {
                this.#turnDirection = turn > 0 ? 1 : -1;
            }
        }
        this.#lastHeading = heading;

        //----------------------------------------------------------------------
        const pad = this.#pad.material.uniforms;
        pad.uTime.value = this.#clockS;
        pad.uYaw.value = heading;
        pad.uDirection.value = this.#turnDirection;
        for (const curtain of [this.#farCurtain, this.#nearCurtain]) {
            curtain.material.uniforms.uTime.value = this.#clockS;
        }
    }
}

//------------------------------------------------------------------------------
// Materials
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
function createOcclusionUniforms({ occluder, occlusionSoftnessRad }: ResolvedEntityZoneOptions): OcclusionUniforms {
    const center = new Vector3();
    const halfSize = new Vector3();
    if (occluder) {
        const { min, max } = occluder;
        center.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
        halfSize.set((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2);
    }
    return {
        uBoxFromWorld: { value: new Matrix4() },
        uBoxCenter: { value: center },
        uBoxHalfSize: { value: halfSize },
        uSoftnessRad: { value: occlusionSoftnessRad },
    };
}

/**
 * `occluderVisibility(world)`: how much of the zone's point at `world` the entity leaves showing, 0
 * to 1. Called only with `USE_OCCLUDER` defined: a zone without an occluder is drawn whole.
 *
 * Marched from the point towards the eye, the nearest the line of sight comes to the entity's box, as
 * an angle seen from the eye — negative where it goes through the box — faded over `uSoftnessRad`
 * centred on the box's outline. Sphere-traced: each step as long as the box is far, so none steps over
 * it, and the steps lengthen as the line leaves it — or, through it, as the line goes deeper. Past half
 * the softness into the box, the point is gone.
 */
const OCCLUSION_GLSL = /* glsl */ `
    uniform mat4 uBoxFromWorld;
    uniform vec3 uBoxCenter;
    uniform vec3 uBoxHalfSize;
    uniform float uSoftnessRad;

    float boxGap(vec3 point) {
        vec3 outside = abs(point - uBoxCenter) - uBoxHalfSize;
        return length(max(outside, 0.0)) + min(max(outside.x, max(outside.y, outside.z)), 0.0);
    }

    float occluderVisibility(vec3 world) {
        vec3 origin = (uBoxFromWorld * vec4(world, 1.0)).xyz;
        vec3 toEye = (uBoxFromWorld * vec4(cameraPosition, 1.0)).xyz - origin;
        float eyeDistance = length(toEye);
        vec3 direction = toEye / max(eyeDistance, 1e-4);
        float nearest = 1.0;
        float t = 0.0;
        for (int i = 0; i < 32; i++) {
            float gap = boxGap(origin + direction * t);
            nearest = min(nearest, gap / (uSoftnessRad * max(eyeDistance - t, 1e-3)));
            t += max(abs(gap), 0.01);
            if (nearest < -0.5 || t >= eyeDistance) {
                break;
            }
        }
        return smoothstep(-0.5, 0.5, nearest);
    }
`;

/** `alpha` faded where the entity stands in front of the point at `vWorld`, with an occluder only. */
const APPLY_OCCLUSION_GLSL = /* glsl */ `
    #ifdef USE_OCCLUDER
        // Marched only where there is something to hide.
        if (alpha < 0.002) {
            discard;
        }
        alpha *= occluderVisibility(vWorld);
    #endif
`;

//------------------------------------------------------------------------------
/**
 * The pad: a disc of glass, clear in the middle where the entity stands, ringed in light and ticked
 * like a dial. A dashed ring and a sweep turn on it with the entity: the sweep's edge along the entity's
 * own +Z, its trail fading behind it the way the entity turns.
 */
function createPadMaterial(occlusion: OcclusionUniforms, hasOccluder: boolean): ShaderMaterial {
    return new ShaderMaterial({
        defines: hasOccluder ? { USE_OCCLUDER: "" } : {},
        uniforms: {
            ...occlusion,
            uRadius: { value: 1 },
            uGlass: { value: new Color() },
            uEdge: { value: new Color() },
            uSweep: { value: new Color() },
            uYaw: { value: 0 },
            uDirection: { value: 1 },
            uTime: { value: 0 },
            uShowTicks: { value: 1 },
            uShowDashedRing: { value: 1 },
            uShowSweep: { value: 1 },
        },
        vertexShader: /* glsl */ `
            varying vec2 vPosition;
            varying vec3 vWorld;
            void main() {
                // Laid flat, the plane's +Y runs along world -Z: flipped, this is the world's X and Z.
                vPosition = vec2(position.x, -position.y);
                vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uRadius;
            uniform vec3 uGlass;
            uniform vec3 uEdge;
            uniform vec3 uSweep;
            uniform float uYaw;
            uniform float uDirection;
            uniform float uTime;
            uniform float uShowTicks;
            uniform float uShowDashedRing;
            uniform float uShowSweep;
            varying vec2 vPosition;
            varying vec3 vWorld;
            ${OCCLUSION_GLSL}

            const float TAU = 6.28318530718;
            const float PI = 3.14159265359;

            float ring(float r, float at, float halfWidth, float aa) {
                return 1.0 - smoothstep(halfWidth, halfWidth + aa, abs(r - at));
            }

            void main() {
                float r = length(vPosition) / uRadius;
                float aa = max(fwidth(r) * 1.5, 1e-5);
                if (r > 1.0 + aa) {
                    discard;
                }
                // As the entity's heading is: 0 along world +Z, growing as +Z turns towards +X.
                float angle = atan(vPosition.x, vPosition.y);
                float turn = angle / TAU + 0.5;
                // A pixel, in radians — from the position rather than the angle, which jumps behind the pad.
                float angleAa = 1.5 * length(fwidth(vPosition)) / max(length(vPosition), 1e-4);

                float disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
                float fill = 0.2 * smoothstep(0.3, 1.0, r) * disc;
                float rim = ring(r, 0.985, 0.006, aa);
                float foot = ring(r, 0.42, 0.004, aa);

                float tickIndex = turn * 72.0;
                float tickAa = angleAa * 72.0 / TAU;
                float tickLine = 1.0 - smoothstep(0.05, 0.05 + tickAa, abs(fract(tickIndex + 0.5) - 0.5));
                float isLong = 1.0 - step(0.5, mod(floor(tickIndex + 0.5), 6.0));
                float tick = tickLine * step(mix(0.88, 0.84, isLong), r) * step(r, 0.93) * uShowTicks;

                float dash = step(0.5, fract((angle - uYaw) / TAU * 24.0));
                float dashed = ring(r, 0.7, 0.006, aa) * dash * uShowDashedRing;

                // How far the sweep's edge is ahead, -π to π: past 0, behind it, the way the entity turns.
                float behind = mod(uDirection * (uYaw - angle) + PI, TAU) - PI;
                float band = smoothstep(0.42, 0.48, r) * (1.0 - smoothstep(0.9, 0.94, r)) * uShowSweep;
                float trail = exp(-max(behind, 0.0) * 2.5) * smoothstep(-angleAa, angleAa, behind) * band;
                float edgeLine = (1.0 - smoothstep(angleAa, 2.0 * angleAa, abs(behind))) * band;

                vec3 color = uGlass;
                float alpha = fill;
                color = mix(color, uEdge, clamp(rim + tick + dashed + foot, 0.0, 1.0));
                alpha += rim * 0.85 + tick * 0.45 + dashed * 0.5 + foot * 0.35;
                color = mix(color, uSweep, clamp(trail + edgeLine, 0.0, 1.0));
                alpha += trail * 0.35 + edgeLine * 0.8;
                ${APPLY_OCCLUSION_GLSL}

                gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        depthWrite: false,
    });
}

//------------------------------------------------------------------------------
/** The light rising off the pad's rim: brightest at the floor, gone at the top, scan lines drifting up it. */
function createCurtainMaterial(side: Side, occlusion: OcclusionUniforms, hasOccluder: boolean): ShaderMaterial {
    return new ShaderMaterial({
        defines: hasOccluder ? { USE_OCCLUDER: "" } : {},
        uniforms: {
            ...occlusion,
            uColor: { value: new Color() },
            uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            varying vec3 vWorld;
            void main() {
                vUv = uv;
                vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vWorld;
            ${OCCLUSION_GLSL}

            void main() {
                float rise = pow(1.0 - vUv.y, 1.8);
                float scan = 0.7 + 0.3 * step(0.5, fract(vUv.y * 14.0 - uTime * 0.5));
                float foot = 1.0 - smoothstep(0.0, 0.05, vUv.y);
                float alpha = 0.18 * rise * scan + 0.2 * foot;
                ${APPLY_OCCLUSION_GLSL}
                gl_FragColor = vec4(uColor, alpha);
                #include <colorspace_fragment>
            }
        `,
        side,
        transparent: true,
        depthWrite: false,
    });
}
