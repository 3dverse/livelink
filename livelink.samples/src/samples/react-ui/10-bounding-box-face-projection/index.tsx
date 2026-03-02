//------------------------------------------------------------------------------
import { useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useEntity,
    DOM3DOverlay,
} from "@3dverse/livelink-react";
import {
    LoadingOverlay,
    type Face,
    BoundingBoxFaceProjection,
} from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import { CameraControllerPresets } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const scene_id = "d163b008-92f7-4b29-a583-2d931f644a4d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

const FACES: Face[] = ["front", "back", "left", "right", "top", "bottom"];
const INFO_PANEL_BASE_CLASS =
    "h-full w-full border p-4 shadow-xl backdrop-blur-md";

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
    const [face, setFace] = useState<Face>("front");
    const [invert, setInvert] = useState(false);
    const [scale, setScale] = useState(250);

    const { cameraEntity } = useCameraEntity();

    const { entity } = useEntity(
        {
            euid: "c59217fe-309f-4d8b-b3b5-cd3018a52270",
        },
        ["local_transform", "local_aabb"],
    );

    return (
        <Canvas className="w-full h-full">
            <Viewport
                cameraEntity={cameraEntity}
                className="relative w-full h-full"
            >
                <CameraController preset={CameraControllerPresets.fly} />

                <ControlPanel
                    face={face}
                    invert={invert}
                    scale={scale}
                    setFace={setFace}
                    setInvert={setInvert}
                    setScale={setScale}
                />

                <DOM3DOverlay className="text-[0.5rem]">
                    <BoundingBoxFaceProjection
                        entity={entity}
                        face={face}
                        scale={scale}
                        invert={invert}
                    >
                        <div
                            className="w-full h-full border-6 border-dashed p-1 text-black/50"
                            style={{ fontSize: `${scale}%` }}
                        >
                            face: {face.toUpperCase()}
                            <br />
                            scale: {scale}%
                            <div className="absolute top-1/2 left-1/2 bg-red-500 w-[100px] h-[100px] translate-x-[-50%] translate-y-[-50%] text-lg">
                                <div className="absolute -translate-y-full w-full text-center">
                                    w:100px
                                </div>
                                <div className="absolute translate-x-full w-full h-full flex content-center items-end text-center [writing-mode:vertical-rl] [direction: ltr]">
                                    h:100px
                                </div>
                            </div>
                        </div>
                    </BoundingBoxFaceProjection>
                    <BoundingBoxFaceProjection
                        entity={entity}
                        face={face}
                        scale={scale}
                        invert={invert}
                    >
                        <div
                            className={`${INFO_PANEL_BASE_CLASS} -translate-x-full border-sky-200/30 bg-linear-to-br from-slate-900/80 via-slate-800/70 to-sky-900/60 text-slate-100`}
                            style={{ fontSize: `${scale}%` }}
                        >
                            <p className="mb-2 font-semibold tracking-wide text-sky-100">
                                Face Projection
                            </p>
                            <p className="mb-2 leading-relaxed text-slate-200">
                                This is a projected 3d overlay on the{" "}
                                <b className="text-sky-300">{face}</b> face of
                                the entity's bounding box.
                            </p>
                            <p className="leading-relaxed text-slate-300">
                                Use the controls at the bottom-right to change
                                the face, invert the projection, and adjust the
                                scale.
                            </p>
                        </div>
                    </BoundingBoxFaceProjection>

                    <BoundingBoxFaceProjection
                        entity={entity}
                        face={face}
                        scale={scale}
                        invert={invert}
                    >
                        <div
                            className={`${INFO_PANEL_BASE_CLASS} translate-x-full border-indigo-200/40 bg-linear-to-br from-indigo-500/70 via-fuchsia-500/55 to-blue-500/60 text-white`}
                            style={{ fontSize: `${scale}%` }}
                        >
                            <p className="mb-2 font-semibold tracking-wide text-indigo-100">
                                Styling Flexibility
                            </p>
                            <p className="leading-relaxed text-indigo-50">
                                You can use CSS properties to offset, style, and
                                animate the projected overlay as needed.
                            </p>
                        </div>
                    </BoundingBoxFaceProjection>

                    <BoundingBoxFaceProjection
                        entity={entity}
                        face={face}
                        scale={scale}
                        invert={invert}
                    >
                        <div
                            className={`${INFO_PANEL_BASE_CLASS} -translate-y-full border-amber-200/50 bg-linear-to-br from-amber-300/85 via-orange-300/80 to-yellow-300/75 text-slate-900`}
                            style={{ fontSize: `${scale}%` }}
                        >
                            <p className="mb-2 font-semibold tracking-wide text-amber-950">
                                Browser Note
                            </p>
                            <p className="leading-relaxed text-slate-800">
                                Due to some bugs in the CSS perspective
                                transformation in certain browsers, you may see
                                distortion or blurriness when the projected face
                                is viewed at a steep angle with corners behind
                                the camera. Adjusting the scale or viewing angle
                                may help mitigate this issue.
                            </p>
                        </div>
                    </BoundingBoxFaceProjection>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function ControlPanel({
    face,
    invert,
    scale,
    setFace,
    setInvert,
    setScale,
}: {
    face: Face;
    invert: boolean;
    scale: number;
    setFace: (face: Face) => void;
    setInvert: (invert: boolean) => void;
    setScale: (scale: number) => void;
}) {
    return (
        <div className="absolute right-3 bottom-3 w-72 rounded-md bg-black/70 p-3 text-white backdrop-blur-sm z-1">
            <h3 className="mb-2 text-sm font-semibold">
                BoundingBoxFaceProjection
            </h3>

            <label className="mb-2 block text-xs">
                <span className="mb-1 block">Face</span>
                <select
                    className="w-full rounded bg-white/10 px-2 py-1 text-sm outline-none ring-1 ring-white/20"
                    value={face}
                    onChange={event => setFace(event.target.value as Face)}
                >
                    {FACES.map(faceOption => (
                        <option
                            key={faceOption}
                            value={faceOption}
                            className="text-black"
                        >
                            {faceOption}
                        </option>
                    ))}
                </select>
            </label>

            <label className="mb-2 flex items-center gap-2 text-xs">
                <input
                    type="checkbox"
                    checked={invert}
                    onChange={event => setInvert(event.target.checked)}
                />
                Invert
            </label>

            <label className="mb-2 block text-xs">
                <span className="mb-1 block">Scale: {scale}</span>
                <input
                    className="w-full"
                    type="range"
                    min={10}
                    max={1000}
                    step={10}
                    value={scale}
                    onChange={event => setScale(Number(event.target.value))}
                />
            </label>
        </div>
    );
}
