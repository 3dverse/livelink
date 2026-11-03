//------------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";
import { folder, useControls } from "leva";

//------------------------------------------------------------------------------
import type { Entity, Vec3 } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    DefaultCameraController,
    useCameraEntity,
    useEntity,
} from "@3dverse/livelink-react";
import {
    LoadingOverlay,
    EntityZones,
    type EntityZoneColors,
    type EntityZoneOptions,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, json } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "0bb2690b-7962-4c66-baa9-35f83e66e866";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
const TARGET_ENTITY_ID = "3650c1ad-23f9-4ed0-aaed-0244bb4ccaff" as const;

/**
 * The cube's bounding box, in its own frame: a meter wide, standing on its
 * origin. Whatever of the zone it stands in front of fades out.
 */
const cube_occluder: EntityZoneOptions["occluder"] = {
    min: [-0.5, 0, -0.5],
    max: [0.5, 1, 0.5],
};

/** High enough for the pad's dial to read. */
const camera_position: Vec3 = [2.1, 1.7, 2.1];
const camera_target: Vec3 = [0, 0.4, 0];

/** Counter-clockwise seen from above: the sweep on the pad turns with it. */
const turn_speed_deg_per_s = 30;

/**
 * Where the color pickers start from, once a color is picked: unset, the zone
 * takes design tokens. The glass is as opaque as its alpha.
 */
const picked_colors: EntityZoneColors = {
    glass: "#0b102099",
    edge: "#3ee6ff",
    sweep: "#ff3d81",
};

//------------------------------------------------------------------------------
export function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
            isTransient={true}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        position: camera_position,
        settings: { atmosphere: true, gradient: false },
    });
    const { entity: cube } = useEntity({ euid: TARGET_ENTITY_ID });

    const [isTurning, setIsTurning] = useState(true);

    // Every option of the zone, as in its stories. Leva returns the values of
    // its folders flat: `colors` and `show` are put back together below.
    const {
        visible,
        turnSpeedDegPerS,
        radiusM,
        curtainHeightM,
        occluder,
        occlusionSoftnessRad,
        turnDirection,
        glass,
        edge,
        sweep,
        showTicks,
        showDashedRing,
        showSweep,
        showCurtain,
    } = useControls({
        visible: true,
        turnSpeedDegPerS: {
            value: turn_speed_deg_per_s,
            min: -120,
            max: 120,
            step: 5,
        },
        radiusM: { value: 1.4, min: 0.6, max: 3, step: 0.1 },
        curtainHeightM: { value: 0.7, min: 0, max: 2, step: 0.05 },
        occluder: json({ value: cube_occluder, optional: true }),
        occlusionSoftnessRad: { value: 0.03, min: 0, max: 0.2, step: 0.005 },
        // Unset, it is taken from how the cube turns.
        turnDirection: {
            options: {
                "counter-clockwise": 1 as const,
                clockwise: -1 as const,
            },
            optional: true,
            disabled: true,
        },
        colors: folder({
            glass: {
                value: picked_colors.glass,
                optional: true,
                disabled: true,
            },
            edge: { value: picked_colors.edge, optional: true, disabled: true },
            sweep: {
                value: picked_colors.sweep,
                optional: true,
                disabled: true,
            },
        }),
        // Named apart from the colors: `sweep` is one of each.
        show: folder({
            showTicks: { value: true, label: "ticks" },
            showDashedRing: { value: true, label: "dashedRing" },
            showSweep: { value: true, label: "sweep" },
            showCurtain: { value: true, label: "curtain" },
        }),
    });

    useTurn(cube, isTurning ? turnSpeedDegPerS : 0);

    // An unset color is left out, for the zone to take its default: given as
    // undefined, it would take the place of the default.
    const colors = useMemo(
        () =>
            Object.fromEntries(
                Object.entries({ glass, edge, sweep }).filter(
                    ([, color]) => color !== undefined,
                ),
            ),
        [glass, edge, sweep],
    );
    const show = useMemo(
        () => ({
            ticks: showTicks,
            dashedRing: showDashedRing,
            sweep: showSweep,
            curtain: showCurtain,
        }),
        [showTicks, showDashedRing, showSweep, showCurtain],
    );

    // Memoized: a new array rebuilds every zone.
    const zones = useMemo<Array<EntityZoneOptions>>(
        () => [
            {
                entity: cube,
                radiusM,
                curtainHeightM,
                occluder,
                occlusionSoftnessRad,
                turnDirection,
                colors,
                show,
            },
        ],
        [
            cube,
            radiusM,
            curtainHeightM,
            occluder,
            occlusionSoftnessRad,
            turnDirection,
            colors,
            show,
        ],
    );

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController ref={lookAtCube} />
                {/* Shown or hidden, it fades and scales in or out. */}
                <EntityZones zones={zones} visible={visible} />
                <div className="absolute top-4 left-4 flex gap-2">
                    <button
                        className="button button-overlay"
                        aria-pressed={isTurning}
                        onClick={() => setIsTurning(previous => !previous)}
                    >
                        {isTurning ? "Pause rotation" : "Play rotation"}
                    </button>
                </div>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
/**
 * The orbital camera controller orbits around the origin by default: it is
 * aimed at the cube from above. Declared once so that the ref callback isn't
 * called again on every render.
 */
function lookAtCube(controller: DefaultCameraController | undefined | null) {
    controller?.setLookAt(...camera_position, ...camera_target, false);
}

//------------------------------------------------------------------------------
/**
 * Turns the entity about the vertical at `speedDegPerS`, counter-clockwise
 * seen from above when positive. Its heading is kept while it stands still, to
 * turn on from there.
 */
function useTurn(entity: Entity | null, speedDegPerS: number) {
    const headingDegRef = useRef(0);

    useEffect(() => {
        if (!entity || speedDegPerS === 0) {
            return;
        }
        let frameId = 0;
        let previousTime: number | null = null;
        const step = (time: number) => {
            if (previousTime !== null) {
                headingDegRef.current =
                    (headingDegRef.current +
                        (speedDegPerS * (time - previousTime)) / 1000) %
                    360;
                entity.local_transform = {
                    eulerOrientation: [0, headingDegRef.current, 0],
                };
            }
            previousTime = time;
            frameId = requestAnimationFrame(step);
        };
        frameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameId);
    }, [entity, speedDegPerS]);
}
