//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    WebXRHelper,
    WebXR,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    title: "WebXR",
    summary: "WebXR immersive experience.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);

    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            {xrMode ? (
                <WebXR mode={xrMode}>
                    <div className="fixed top-4 left-4">
                        <button
                            className="button button-primary"
                            onClick={() => setXRMode(null)}
                        >
                            Exit XR
                        </button>
                    </div>
                </WebXR>
            ) : (
                <>
                    <AppLayout />

                    <div className="absolute w-full top-4 flex items-center justify-center gap-4">
                        <XRButton mode="immersive-ar" enterXR={setXRMode} />
                        <XRButton mode="immersive-vr" enterXR={setXRMode} />
                    </div>
                </>
            )}
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function XRButton({
    mode,
    enterXR,
}: {
    mode: XRSessionMode;
    enterXR: (mode: XRSessionMode) => void;
}) {
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [message, setMessage] = useState("");
    const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

    useEffect(() => {
        if (!window.isSecureContext) {
            setMessage("WebXR requires a secure context (https).");
            return;
        }

        WebXRHelper.isSessionSupported(mode).then(supported => {
            if (!supported) {
                setMessage(`WebXR '${mode}' is not supported on this device.`);
            } else {
                setIsSessionSupported(true);
            }
        });
    }, [mode]);

    return (
        <button
            className={
                "button button-primary" +
                (!isSessionSupported ? " opacity-50" : "")
            }
            onClick={() => enterXR(mode)}
            disabled={!isSessionSupported}
            style={isSessionSupported ? {} : { cursor: "not-allowed" }}
            title={message}
        >
            Enter {xrModeTitle}
        </button>
    );
}
