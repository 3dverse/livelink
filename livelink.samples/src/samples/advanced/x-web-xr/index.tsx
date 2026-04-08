//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DOverlay,
    DOM3DAnchor,
    CameraController,
    useCameraEntity,
    DOM3DDiv,
} from "@3dverse/livelink-react";
import {
    XRLivelink,
    WebXR,
    WebXRVirtualJoysticks,
    LXRScaleUp,
    LXRScaleDown,
} from "@3dverse/livelink-webxr";
import { LoadingOverlay, PerformancePanel } from "@3dverse/livelink-react-ui";
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "@/components/SamplePlayer";
import { ScaleSelector } from "@/components/common/ScaleSelector";

//------------------------------------------------------------------------------
const scene_id = "11e2da67-4740-4546-951b-1d50df1dc55d";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export function App() {
    //--------------------------------------------------------------------------
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
    const [scale, setScale] = useState(1);
    const [latencyCompensation, setLatencyCompensation] = useState(true);
    const [overscan, setOverscan] = useState(true);
    const [xrLivelink, setXrLivelink] = useState<XRLivelink | null>(null);

    //--------------------------------------------------------------------------
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
                    renderViewport={(_viewport, index) => (
                        <DOM3DSample key={`overlay-${index}`} />
                    )}
                    originTransform={{
                        position: [0, 2, 5],
                        eulerOrientation: [0, 45, 0],
                    }}
                    ref={ref => setXrLivelink(ref?.livelinkXR ?? null)}
                >
                    <WebXRVirtualJoysticks />
                    <div className="fixed place-self-center top-3 flex flex-wrap items-center justify-center gap-3 mx-2">
                        <button
                            className="button button-primary"
                            onClick={() => setXRMode(null)}
                        >
                            Exit {xrMode === "immersive-ar" ? "AR" : "VR"}
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
                    <div className="absolute place-self-center p-2 bottom-0 flex flex-col sm:flex-row sm:justify-between items-center gap-2">
                        <div className="order-2 sm:order-1">
                            <ScaleSelector scale={scale} setScale={setScale} />
                        </div>
                        <div className="order-1 sm:order-2 sm:w-auto w-full">
                            {xrLivelink && (
                                <XROptions
                                    showScalingOptions={
                                        xrMode === "immersive-ar"
                                    }
                                    latencyCompensation={latencyCompensation}
                                    setLatencyCompensation={
                                        setLatencyCompensation
                                    }
                                    overscan={overscan}
                                    setOverscan={setOverscan}
                                    xrLivelink={xrLivelink}
                                />
                            )}
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
                                {xrLivelink && (
                                    <XROptions
                                        showScalingOptions={
                                            xrMode === "immersive-ar"
                                        }
                                        latencyCompensation={
                                            latencyCompensation
                                        }
                                        setLatencyCompensation={
                                            setLatencyCompensation
                                        }
                                        overscan={overscan}
                                        setOverscan={setOverscan}
                                        xrLivelink={xrLivelink}
                                    />
                                )}
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
                <DOM3DOverlay>
                    <DOM3DSample />
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function DOM3DSample() {
    return (
        <DOM3DOverlay>
            <DOM3DStaticElements />
            <DOM3DMovingElement />
        </DOM3DOverlay>
    );
}

//------------------------------------------------------------------------------
function DOM3DStaticElements() {
    return (
        <>
            {!location.hash.includes("/standalone/") && (
                <DOM3DAnchor worldPosition={[2, 1, -0.5]} scaleFactor={0.005}>
                    <p className="bg-underground p-4 rounded-lg max-w-xs">
                        If you are using the WebXR emulator in your dev tools,
                        we highly recommend switching to use the headless page
                        of this demo
                        <br />
                        See{" "}
                        <a href="/#/standalone/web-xr" className="underline">
                            here
                        </a>{" "}
                    </p>
                </DOM3DAnchor>
            )}

            <DOM3DDiv
                worldQuad={{
                    bl: [-2, 0, 0],
                    tl: [-2, 2, 0],
                    tr: [0, 2, 0],
                    br: [0, 0, 0],
                }}
            >
                <div className="bg-ground p-4 rounded-lg flex flex-col items-center gap-4">
                    <img
                        src="https://cdn.3dverse.com/assets/3dverse-wordmark.svg"
                        className="h-20"
                    />
                    <p className=" text-center">
                        I'm a DOM3DDiv, which allows me to be rendered as a flat
                        surface in 3D space.
                    </p>
                </div>
            </DOM3DDiv>
        </>
    );
}

//------------------------------------------------------------------------------
function DOM3DMovingElement() {
    const [position, setPosition] = useState<Vec3>([-0.1, 1, -2]);

    useEffect(() => {
        const interval = setInterval(
            () =>
                setPosition(prev => [
                    prev[0],
                    prev[1],
                    Math.sin(Date.now() / 1000),
                ]),
            1000 / 60,
        );

        return () => clearInterval(interval);
    }, []);

    return (
        <DOM3DAnchor worldPosition={position} scaleFactor={0.0025}>
            <p className="bg-underground p-4 rounded-lg">
                Moving at [{position[0].toFixed(2)},{position[1].toFixed(2)},{" "}
                {position[2].toFixed(2)}].
                <br />
                This works seamlessly with regular DOM3DOverlay!
            </p>
        </DOM3DAnchor>
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

        XRLivelink.isSessionSupported(mode).then(supported => {
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
    showScalingOptions,
    latencyCompensation,
    setLatencyCompensation,
    overscan,
    setOverscan,
    xrLivelink,
}: {
    showScalingOptions: boolean;
    latencyCompensation: boolean;
    setLatencyCompensation: (value: boolean) => void;
    overscan: boolean;
    setOverscan: (value: boolean) => void;
    xrLivelink: XRLivelink;
}) {
    const [worldScale, setWorldScale] = useState(xrLivelink.camera_rig.scale);

    const buttonClassName =
        "px-2 py-1 border-2 border-[#333] rounded-lg min-w-12 text-center";
    const selectedButtonClassName = "bg-white text-[#333] cursor-pointer";
    const unselectedButtonClassName = "bg-[#333] text-white cursor-pointer";
    const disabledButtonClassName =
        "bg-gray-500 text-gray-300 border-gray-500 cursor-not-allowed opacity-50";

    const isOverscanDisabled = !latencyCompensation;

    return (
        <div className="flex flex-row gap-2 justify-center">
            <div className="flex flex-col gap-2 flex-1">
                {showScalingOptions && (
                    <div className="flex flex-row flex-wrap gap-2 justify-center">
                        <button
                            onClick={() =>
                                setWorldScale(
                                    LXRScaleUp(xrLivelink.camera_rig, {
                                        compensate_anchor_position: true,
                                    }),
                                )
                            }
                            className={`${buttonClassName} bg-white text-[#333] cursor-pointer`}
                        >
                            +
                        </button>
                        <span
                            className={`${buttonClassName} bg-[#333] text-white min-w-16 select-none`}
                        >
                            x{+worldScale.toFixed(3)}
                        </span>
                        <button
                            onClick={() =>
                                setWorldScale(
                                    LXRScaleDown(xrLivelink.camera_rig, {
                                        compensate_anchor_position: true,
                                    }),
                                )
                            }
                            className={`${buttonClassName} bg-white text-[#333] cursor-pointer`}
                        >
                            -
                        </button>
                    </div>
                )}
                <button
                    onClick={() => setLatencyCompensation(!latencyCompensation)}
                    className={`${buttonClassName} ${latencyCompensation ? selectedButtonClassName : unselectedButtonClassName}`}
                >
                    Smooth Latency
                </button>
                <button
                    onClick={() =>
                        !isOverscanDisabled && setOverscan(!overscan)
                    }
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
            <div className="flex">
                <PerformancePanel className="p-1 mt-1 bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)] backdrop-blur-xl rounded-lg shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]" />
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
