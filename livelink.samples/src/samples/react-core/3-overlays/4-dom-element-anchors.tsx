//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DElement,
    CameraController,
    useCameraEntity,
    Anchor,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";
import { useState } from "react";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "f71c73a7-dbc3-488f-8fcc-fe11e98150b0";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "DOM 3D Element Anchors",
    summary:
        "A viewport with a DOM 3D overlay to display DOM elements located in the 3D world with different anchors.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
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

    const [anchor, setAnchor] = useState<Anchor>("left-top");

    const cornerAnchors = [
        "left-top",
        "left-bottom",
        "right-top",
        "right-bottom",
    ] satisfies Array<Anchor>;

    const centerAnchors = [
        "center-top",
        "center-bottom",
        "left-center",
        "right-center",
    ] satisfies Array<Anchor>;

    const anchors = [
        ...cornerAnchors,
        "center",
        ...centerAnchors,
    ] satisfies Array<Anchor>;

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <DOM3DOverlay>
                    {cornerAnchors.map(anchor => (
                        <DOM3DElement worldPosition={[3, 0, 0]} anchor={anchor}>
                            <p className="bg-ground p-1 rounded-lg">
                                ⚓ {anchor}
                            </p>
                        </DOM3DElement>
                    ))}

                    {centerAnchors.map(anchor => (
                        <DOM3DElement
                            worldPosition={[-3, 0, 0]}
                            anchor={anchor}
                        >
                            <p className="bg-ground p-1 rounded-lg">
                                ⚓ {anchor}
                            </p>
                        </DOM3DElement>
                    ))}

                    <DOM3DElement worldPosition={[0, 0, 0]} anchor={anchor}>
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
                                        onChange={() => setAnchor(a as Anchor)}
                                    />
                                    <p>{a}</p>
                                </label>
                            ))}
                        </fieldset>
                    </DOM3DElement>
                    <DOM3DElement worldPosition={[0, 0, 0]}>
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: "red" }}
                        ></div>
                    </DOM3DElement>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}
