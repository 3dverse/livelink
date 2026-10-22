//------------------------------------------------------------------------------
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Entity, Vec3 } from "@3dverse/livelink";
import {
    CameraController,
    Canvas,
    DefaultCameraController,
    useCameraEntity,
    useEntity,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { EntityZones, type EntityZoneOptions } from ".";
import { ENTITY_ZONE_DEFAULTS } from "./entityZoneOptions";
import { Button } from "../../components-common/Button";
import { COMPANION_CUBE_SCENE_ID } from "../../../.storybook/sceneIds";

//------------------------------------------------------------------------------
/** The companion cube, standing at the origin of the scene. */
const TARGET_ENTITY_ID = "3650c1ad-23f9-4ed0-aaed-0244bb4ccaff" as const;

/** The cube's bounding box, in its own frame: a meter wide, standing on its origin. */
const CUBE_OCCLUDER: EntityZoneOptions["occluder"] = { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] };

/** Sees the pad from high enough for its dial to read, and the cube in front of the curtain's far side. */
const CAMERA_POSITION: Vec3 = [2.1, 1.7, 2.1];
const CAMERA_TARGET: Vec3 = [0, 0.4, 0];

//------------------------------------------------------------------------------
/** The options of one zone, round the cube, and how fast the cube turns for the sweep to follow it. */
type DOM3DZoneStoryArgs = Omit<EntityZoneOptions, "entity"> & {
    /** How fast the cube turns about the vertical while the rotation plays: counter-clockwise seen from above when positive. */
    turnSpeedDegPerS: number;
};

//------------------------------------------------------------------------------
const meta = {
    title: "Components/DOM 3D Zone",
    id: "components-dom3d-zone",
    parameters: {
        layout: "fullscreen",
        livelinkSceneId: COMPANION_CUBE_SCENE_ID,
    },
    args: {
        // The defaults of the component, for the controls to start from them.
        ...ENTITY_ZONE_DEFAULTS,
        radiusM: 1.4,
        occluder: CUBE_OCCLUDER,
        turnSpeedDegPerS: 30,
    },
    argTypes: {
        radiusM: { control: { type: "range", min: 0.6, max: 3, step: 0.1 } },
        curtainHeightM: { control: { type: "range", min: 0, max: 2, step: 0.05 } },
        occluder: { control: "object" },
        occlusionSoftnessRad: { control: { type: "range", min: 0, max: 0.2, step: 0.005 } },
        turnDirection: {
            options: [1, -1],
            control: { type: "inline-radio", labels: { 1: "Counter-clockwise", [-1]: "Clockwise" } },
        },
        colors: { control: "object" },
        show: { control: "object" },
        turnSpeedDegPerS: { control: { type: "range", min: -120, max: 120, step: 5 } },
    },
} satisfies Meta<DOM3DZoneStoryArgs>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<DOM3DZoneStoryArgs>;

//------------------------------------------------------------------------------
/**
 * A zone round the cube: a pad of glass on the floor, ringed and ticked like a dial, and a curtain of light rising
 * off its rim. The cube turns, and the sweep on the pad turns with it, its edge along the cube's +Z, its trail behind.
 *
 * The cube's bounding box is given as `occluder`: the far side of the curtain, and the pad under the cube, fade out
 * behind it. The colors are design tokens: switch the theme in the toolbar, the zone is recolored.
 */
export const _Component: Story = {
    render: args => <DOM3DZoneDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * Without `turnDirection`, the way the sweep's trail runs is taken from how the cube turns: turning clockwise, the
 * trail flips to follow it. Pause, then play the rotation backwards from the controls, and it flips again.
 */
export const Clockwise: Story = {
    args: { turnSpeedDegPerS: -30 },
    render: args => <DOM3DZoneDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * Without `occluder`, the stream gives the zone no depth: it is drawn whole, over the cube too.
 */
export const WithoutOccluder: Story = {
    args: { occluder: undefined },
    render: args => <DOM3DZoneDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * With `show`, parts of the zone are left out: here the ticks, the dashed ring and the curtain, leaving the pad's
 * rim and the sweep.
 */
export const Minimal: Story = {
    args: { show: { ticks: false, dashedRing: false, curtain: false } },
    render: args => <DOM3DZoneDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * `colors` takes any CSS color, a design token's `var()` included. A taller curtain, in other colors.
 */
export const CustomColors: Story = {
    args: {
        curtainHeightM: 1.2,
        colors: { glass: "#0b1020", edge: "#3ee6ff", sweep: "#ff3d81" },
    },
    render: args => <DOM3DZoneDemo {...args} />,
};

//------------------------------------------------------------------------------
/**
 * The cube of the scene with a zone round it, the zone's options given as `args`, turning while the rotation plays.
 */
function DOM3DZoneDemo({ turnSpeedDegPerS, ...options }: DOM3DZoneStoryArgs): React.JSX.Element {
    const { radiusM, curtainHeightM, occluder, occlusionSoftnessRad, turnDirection, colors, show } = options;
    const [isTurning, setIsTurning] = useState(true);
    const { cameraEntity } = useCameraEntity({
        position: CAMERA_POSITION,
        settings: { atmosphere: true, gradient: false },
    });
    const { isPending, entity } = useEntity({ euid: TARGET_ENTITY_ID });
    useTurn(entity, isTurning ? turnSpeedDegPerS : 0);

    // Memoized: a new array rebuilds every zone.
    const zones = useMemo<EntityZoneOptions[]>(
        () => [{ entity, radiusM, curtainHeightM, occluder, occlusionSoftnessRad, turnDirection, colors, show }],
        [entity, radiusM, curtainHeightM, occluder, occlusionSoftnessRad, turnDirection, colors, show],
    );

    if (!isPending && !entity) {
        console.error("There's no entity with the configured euid in the scene");
    }

    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController ref={lookAtTarget} />
                <EntityZones zones={zones} />
                <div style={{ position: "absolute", top: "1rem", left: "1rem" }}>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-pressed={isTurning}
                        onClick={() => setIsTurning(value => !value)}
                        style={{ backgroundColor: "var(--3dverse-color-bg-overground)" }}
                    >
                        {isTurning ? "Pause rotation" : "Play rotation"}
                    </Button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/**
 * The orbital camera controller orbits around the origin by default: it is aimed at the cube from above. Declared
 * once so that the ref callback isn't called again on every render.
 */
function lookAtTarget(controller: DefaultCameraController | undefined | null): void {
    controller?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false);
}

//------------------------------------------------------------------------------
/**
 * Turns `entity` about the vertical at `speedDegPerS`, counter-clockwise seen from above when positive. Its heading
 * is kept while it stands still, to turn on from there.
 */
function useTurn(entity: Entity | null, speedDegPerS: number): void {
    const headingDegRef = useRef(0);

    useEffect(() => {
        if (!entity || speedDegPerS === 0) {
            return;
        }
        let frameId = 0;
        let previousTime: number | null = null;
        const step = (time: number): void => {
            if (previousTime !== null) {
                headingDegRef.current = (headingDegRef.current + (speedDegPerS * (time - previousTime)) / 1000) % 360;
                entity.local_transform = { eulerOrientation: [0, headingDegRef.current, 0] };
            }
            previousTime = time;
            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
        return (): void => cancelAnimationFrame(frameId);
    }, [entity, speedDegPerS]);
}
