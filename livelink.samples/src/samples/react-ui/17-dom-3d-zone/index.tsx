//------------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";

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
    type EntityZoneOptions,
    type EntityZonePart,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

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

const part_labels: Record<EntityZonePart, string> = {
    ticks: "Ticks",
    dashedRing: "Dashed ring",
    sweep: "Sweep",
    curtain: "Curtain",
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
    const [radiusM, setRadiusM] = useState(1.4);
    const [hasOccluder, setHasOccluder] = useState(true);
    const [show, setShow] = useState<Record<EntityZonePart, boolean>>({
        ticks: true,
        dashedRing: true,
        sweep: true,
        curtain: true,
    });

    useTurn(cube, isTurning ? turn_speed_deg_per_s : 0);

    // Memoized: a new array rebuilds every zone.
    const zones = useMemo<Array<EntityZoneOptions>>(
        () => [
            {
                entity: cube,
                radiusM,
                occluder: hasOccluder ? cube_occluder : undefined,
                show,
            },
        ],
        [cube, radiusM, hasOccluder, show],
    );

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController ref={lookAtCube} />
                <EntityZones zones={zones} />
                <div className="absolute top-4 left-4 flex gap-2">
                    <button
                        className="button button-overlay"
                        aria-pressed={isTurning}
                        onClick={() => setIsTurning(previous => !previous)}
                    >
                        {isTurning ? "Pause rotation" : "Play rotation"}
                    </button>
                </div>
                <div className="absolute right-3 bottom-3 w-72 rounded-md bg-black/70 p-3 text-white backdrop-blur-sm">
                    <h3 className="mb-2 text-sm font-semibold">Entity zone</h3>
                    <label className="mb-2 block text-xs">
                        <span className="mb-1 block">
                            Radius: {radiusM.toFixed(1)} m
                        </span>
                        <input
                            className="w-full"
                            type="range"
                            min={0.8}
                            max={2.5}
                            step={0.1}
                            value={radiusM}
                            onChange={event =>
                                setRadiusM(Number(event.target.value))
                            }
                        />
                    </label>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <Checkbox
                            label="Occluder"
                            checked={hasOccluder}
                            onChange={setHasOccluder}
                        />
                        {Object.entries(part_labels).map(([part, label]) => (
                            <Checkbox
                                key={part}
                                label={label}
                                checked={show[part as EntityZonePart]}
                                onChange={checked =>
                                    setShow(previous => ({
                                        ...previous,
                                        [part]: checked,
                                    }))
                                }
                            />
                        ))}
                    </div>
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
function Checkbox({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-2">
            <input
                type="checkbox"
                checked={checked}
                onChange={event => onChange(event.target.checked)}
            />
            {label}
        </label>
    );
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
