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
    const [latencyCompensation, setLatencyCompensation] = useState(true);
    const [overscan, setOverscan] = useState(true);

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
                    latencyCompensation={latencyCompensation}
                    overscan={overscan}
                    scale={scale}
                    onSessionEnd={() => setXRMode(null)}
                >
                    <div className="fixed top-3 flex flex-wrap items-center justify-center gap-3 mx-2">
                        <button
                            className="button button-primary"
                            onClick={() => setXRMode(null)}
                        >
                            Exit XR
                        </button>

                        <XRButton
                            mode={
                                xrMode === "immersive-ar"
                                    ? "immersive-vr"
                                    : "immersive-ar"
                            }
                            text="Switch to"
                            setXRMode={setXRMode}
                        />
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex flex-col sm:flex-row sm:justify-between items-center gap-2">
                        <div className="order-2 sm:order-1">
                            <ScaleSelector scale={scale} setScale={setScale} />
                        </div>
                        <div className="order-1 sm:order-2">
                            <XROptions
                                latencyCompensation={latencyCompensation}
                                setLatencyCompensation={setLatencyCompensation}
                                overscan={overscan}
                                setOverscan={setOverscan}
                            />
                        </div>
                    </div>
                </WebXR>
            ) : (
                <>
                    <AppLayout scale={scale} />

                    <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <XRButton
                                mode="immersive-ar"
                                setXRMode={setXRMode}
                            />
                            <XRButton
                                mode="immersive-vr"
                                setXRMode={setXRMode}
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 w-full">
                            <div className="order-2 sm:order-1">
                                <ScaleSelector
                                    scale={scale}
                                    setScale={setScale}
                                />
                            </div>
                            <div className="order-1 sm:order-2">
                                <XROptions
                                    latencyCompensation={latencyCompensation}
                                    setLatencyCompensation={
                                        setLatencyCompensation
                                    }
                                    overscan={overscan}
                                    setOverscan={setOverscan}
                                />
                            </div>
                        </div>
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

//------------------------------------------------------------------------------
function XROptions({
    latencyCompensation,
    setLatencyCompensation,
    overscan,
    setOverscan,
}: {
    latencyCompensation: boolean;
    setLatencyCompensation: (value: boolean) => void;
    overscan: boolean;
    setOverscan: (value: boolean) => void;
}) {
    const buttonClassName =
        "px-2 py-1 border-2 border-[#333] rounded-lg min-w-12 text-center";
    const selectedButtonClassName = "bg-white text-[#333] cursor-pointer";
    const unselectedButtonClassName = "bg-[#333] text-white cursor-pointer";
    const disabledButtonClassName =
        "bg-gray-500 text-gray-300 border-gray-500 cursor-not-allowed opacity-50";

    const isOverscanDisabled = !latencyCompensation;

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            <button
                onClick={() => setLatencyCompensation(!latencyCompensation)}
                className={`${buttonClassName} ${latencyCompensation ? selectedButtonClassName : unselectedButtonClassName}`}
            >
                Smooth Latency
            </button>
            <button
                onClick={() => !isOverscanDisabled && setOverscan(!overscan)}
                disabled={isOverscanDisabled}
                className={`${buttonClassName} ${
                    isOverscanDisabled
                        ? disabledButtonClassName
                        : overscan
                          ? selectedButtonClassName
                          : unselectedButtonClassName
                }`}
            >
                Overscan
            </button>
        </div>
    );
}
