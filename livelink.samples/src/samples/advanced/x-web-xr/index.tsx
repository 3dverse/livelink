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
import { ScaleSelector } from "@/components/common/ScaleSelector";

//------------------------------------------------------------------------------
const scene_id = "11e2da67-4740-4546-951b-1d50df1dc55d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
    const [scale, setScale] = useState(1);

    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            {xrMode ? (
                <WebXR
                    mode={xrMode}
                    onSessionEnd={() => setXRMode(null)}
                    fakeAlpha={xrMode === "immersive-ar"}
                    overscan={true}
                    scale={scale}
                >
                    <div className="fixed top-3 flex flex-wrap items-center justify-center gap-3 mx-2">
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
                    <div className="absolute bottom-2 mx-2">
                        <ScaleSelector scale={scale} setScale={setScale} />
                    </div>
                </WebXR>
            ) : (
                <>
                    <AppLayout scale={scale} />

                    <div className="absolute bottom-[8vh] left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2">
                        <XRButton mode="immersive-ar" setXRMode={setXRMode} />
                        <XRButton mode="immersive-vr" setXRMode={setXRMode} />
                    </div>

                    <div className="absolute bottom-2 mx-2">
                        <ScaleSelector scale={scale} setScale={setScale} />
                    </div>
                </>
            )}
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout({ scale }: { scale: number }) {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className="w-full h-full" scale={scale}>
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
