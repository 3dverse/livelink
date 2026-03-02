//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DAnchor,
    CameraController,
    useCameraEntity,
    AnchorOffset,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import { useState } from "react";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "f71c73a7-dbc3-488f-8fcc-fe11e98150b0";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    const [anchor, setAnchor] = useState<AnchorOffset>("left-top");

    const cornerAnchors = [
        "left-top",
        "left-bottom",
        "right-top",
        "right-bottom",
    ] satisfies Array<AnchorOffset>;

    const centerAnchors = [
        "center-top",
        "center-bottom",
        "left-center",
        "right-center",
    ] satisfies Array<AnchorOffset>;

    const anchors = [
        ...cornerAnchors,
        "center",
        ...centerAnchors,
    ] satisfies Array<AnchorOffset>;

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    {cornerAnchors.map(anchor => (
                        <DOM3DAnchor
                            key={anchor}
                            worldPosition={[3, 0, 0]}
                            offset={anchor}
                        >
                            <p className="bg-ground p-1 rounded-lg">
                                ⚓ {anchor}
                            </p>
                        </DOM3DAnchor>
                    ))}

                    {centerAnchors.map(anchor => (
                        <DOM3DAnchor
                            key={anchor}
                            worldPosition={[-3, 0, 0]}
                            offset={anchor}
                        >
                            <p className="bg-ground p-1 rounded-lg">
                                ⚓ {anchor}
                            </p>
                        </DOM3DAnchor>
                    ))}

                    <DOM3DAnchor worldPosition={[0, 0, 0]} offset={anchor}>
                        <p className="bg-ground px-2 py-1 rounded-lg">
                            ⚓ {anchor}
                        </p>
                        <fieldset className="bg-underground p-4 rounded-lg">
                            {anchors.map(a => (
                                <label
                                    className="flex items-center gap-2 cursor-pointer"
                                    key={a}
                                >
                                    <input
                                        key={a}
                                        type="radio"
                                        name="anchor"
                                        value={a}
                                        checked={a === anchor}
                                        onChange={() =>
                                            setAnchor(a as AnchorOffset)
                                        }
                                    />
                                    <p>{a}</p>
                                </label>
                            ))}
                        </fieldset>
                    </DOM3DAnchor>
                    <DOM3DAnchor worldPosition={[0, 0, 0]}>
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: "red" }}
                        ></div>
                    </DOM3DAnchor>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}
