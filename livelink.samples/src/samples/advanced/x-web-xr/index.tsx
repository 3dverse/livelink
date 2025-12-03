//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
} from "@3dverse/livelink-react";
import { WebXRHelper, WebXR } from "@3dverse/livelink-webxr";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "11e2da67-4740-4546-951b-1d50df1dc55d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            {xrMode ? (
                <WebXR mode={xrMode} onSessionEnd={() => setXRMode(null)}>
                    <div className="fixed top-4 left-4 flex items-center justify-center gap-4">
                        <button
                            className="button button-primary"
                            onClick={() => setXRMode(null)}
                        >
                            Exit XR
                        </button>
                        {xrMode !== "immersive-ar" && (
                            <XRButton
                                mode="immersive-ar"
                                text="Switch to"
                                setXRMode={setXRMode}
                            />
                        )}
                        {xrMode !== "immersive-vr" && (
                            <XRButton
                                mode="immersive-vr"
                                text="Switch to"
                                setXRMode={setXRMode}
                            />
                        )}
                    </div>
                </WebXR>
            ) : (
                <>
                    <AppLayout />

                    <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2 flex items-center justify-center gap-2">
                        <XRButton mode="immersive-ar" setXRMode={setXRMode} />
                        <XRButton mode="immersive-vr" setXRMode={setXRMode} />
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
    setXRMode,
    text = "Enter",
}: {
    mode: XRSessionMode;
    text?: string;
    setXRMode: (mode: XRSessionMode) => void;
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
            onClick={() => setXRMode(mode)}
            disabled={!isSessionSupported}
            style={isSessionSupported ? {} : { cursor: "not-allowed" }}
            title={message}
        >
            {text} {xrModeTitle}
        </button>
    );
}
