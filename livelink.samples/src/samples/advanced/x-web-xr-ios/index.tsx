//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

//------------------------------------------------------------------------------
import {
    Livelink,
    Canvas,
    Viewport,
    DOM3DAnchor,
    DOM3DOverlay,
    CameraController,
    useCameraEntity,
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
const variant_launch_sdk_key = import.meta.env
    .VITE_WEBXR_VARIANT_LAUNCH_SDK_KEY;
const variant_launch_sdk_url = `https://launchar.app/sdk/v1?key=${variant_launch_sdk_key}&redirect=true`;

//------------------------------------------------------------------------------
export function App() {
    //--------------------------------------------------------------------------
    // Refs and states
    const domOverlayRef = useRef<HTMLElement>(null);
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
    const [scale, setScale] = useState(1);
    const [latencyCompensation, setLatencyCompensation] = useState(true);
    const [overscan, setOverscan] = useState(true);
    const [xrLivelink, setXrLivelink] = useState<XRLivelink | null>(null);

    //--------------------------------------------------------------------------
    // Cleanup dom overlay root on component unmount
    useEffect(() => {
        return () => {
            if (domOverlayRef.current && domOverlayRef.current.parentNode) {
                domOverlayRef.current.parentNode.removeChild(
                    domOverlayRef.current,
                );
                domOverlayRef.current = null;
            }
        };
    }, []);

    //--------------------------------------------------------------------------
    // Cleanup dom overlay root when exiting XR mode
    useEffect(() => {
        if (
            xrMode === null &&
            domOverlayRef.current &&
            domOverlayRef.current.parentNode
        ) {
            domOverlayRef.current.parentNode.removeChild(domOverlayRef.current);
            domOverlayRef.current = null;
        }
    }, [xrMode]);

    //--------------------------------------------------------------------------
    // Important for dom overlay to be displayed by variant launch app clip:
    // https://launch.variant3d.com/docs/troubleshooting/dom-overlay
    const renderDomOverlay = useCallback(
        (xrMode: XRSessionMode) => {
            // Create xr dom-overlay root if not exists yet
            if (!domOverlayRef.current) {
                domOverlayRef.current = document.createElement("div");
                domOverlayRef.current.id = "xr-dom-overlay-root-variant-launch";
                domOverlayRef.current.classList.add(
                    "h-full",
                    "w-full",
                    "fixed",
                    "top-0",
                    "left-0",
                );
                document.body.appendChild(domOverlayRef.current);
            }

            // Create a portal to the actual dom overlay content from the root
            return createPortal(
                <div
                    id="xr-dom-overlay-root"
                    style={{ zIndex: 11000 }}
                    className="fixed w-full h-full flex flex-col items-center gap-2"
                >
                    {/* 
                        joysticks must not be directly decendent of a flex container or the joystick nipple placement 
                        will be affected by the flex styles, causing them to be misplaced.
                    */}
                    <div className="absolute w-full h-full">
                        <WebXRVirtualJoysticks />
                    </div>

                    <div className="absolute place-self-center top-3 flex flex-wrap items-center justify-center gap-3 mx-2">
                        <button
                            className="button button-primary"
                            onClick={() => setXRMode(null)}
                        >
                            Exit AR
                        </button>
                    </div>

                    <div className="absolute p-2 bottom-0 flex flex-col sm:flex-row sm:justify-between items-center gap-2">
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
                </div>,
                domOverlayRef.current,
            );
        },
        [scale, xrLivelink, latencyCompensation, overscan],
    );

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
                    onSessionEnd={() => setXRMode(null)}
                    forceSingleView={true}
                    domOverlayRoot={domOverlayRef.current || undefined}
                    latencyCompensation={latencyCompensation}
                    overscan={overscan}
                    scale={scale}
                    renderViewport={(_viewport, index) => (
                        <DOM3DSample key={`overlay-${index}`} />
                    )}
                    originTransform={{
                        position: [0, 2, 5],
                        eulerOrientation: [0, 45, 0],
                    }}
                    ref={ref => setXrLivelink(ref?.livelinkXR ?? null)}
                >
                    {renderDomOverlay(xrMode)}
                </WebXR>
            ) : (
                <>
                    <AppLayout scale={scale} />

                    <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <XRButton mode="immersive-ar" enterXR={setXRMode} />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 w-full">
                            <div className="order-2 sm:order-1">
                                <ScaleSelector
                                    scale={scale}
                                    setScale={setScale}
                                />
                            </div>
                            {xrLivelink && (
                                <div className="order-1 sm:order-2">
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
                                </div>
                            )}
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
const DOM3DStaticElements = function DOM3DStaticElements() {
    return (
        <>
            <DOM3DAnchor worldPosition={[-0.2, 4, -1.5]}>
                <p className="bg-ground p-4 rounded-lg">
                    I'm a DOM 3D Element using regular DOM3DOverlay in WebXR.{" "}
                    <br />
                    Constant size regardless of camera position.
                </p>
            </DOM3DAnchor>
            <DOM3DAnchor worldPosition={[-0.1, 2, -0.5]} scaleFactor={0.0025}>
                <p className="bg-underground p-4 rounded-lg">
                    Size varies depending on the camera position.
                </p>
                <img
                    src="https://cdn.3dverse.com/assets/3dverse-wordmark.svg"
                    className="h-60"
                />
            </DOM3DAnchor>
        </>
    );
};

//------------------------------------------------------------------------------
function DOM3DMovingElement() {
    const [position, setPosition] = useState<Vec3>([-0.1, 2, -2]);

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
    enterXR,
}: {
    mode: XRSessionMode;
    enterXR: (mode: XRSessionMode) => void;
}) {
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [message, setMessage] = useState("");
    const modeTitle = mode.replace("immersive-", "").toUpperCase();

    //--------------------------------------------------------------------------
    // Dynamic script loading using the DOM
    function loadScript(url: string) {
        return new Promise<Event | void>((resolve, reject) => {
            let script: HTMLScriptElement | null = document.querySelector(
                `script[src="${url}"]`,
            );
            if (script) {
                resolve();
                return;
            }
            script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = event => resolve(event);
            script.onerror = event => reject(event);
            document.body.appendChild(script);
        });
    }

    //--------------------------------------------------------------------------
    // Variant launch sdk initialization event listener.
    const onVlaunchInitialized = useCallback(
        (event: Event) => {
            const customEvent = event as CustomEvent;
            console.debug("vlaunch-initialized:", customEvent);

            if (customEvent.detail?.launchRequired) {
                // Load Variant Launch URL to reload the sample inside Variant
                // Launch iOS Clip App.
                // @ts-excpect-error
                const { VLaunch } = window as unknown as {
                    VLaunch: { getLaunchUrl: (url: string) => string };
                };
                const url = new URL(window.location.href);
                window.location.href = VLaunch.getLaunchUrl(url.toString());
                return;
            }
            XRLivelink.isSessionSupported(mode).then(async supported => {
                setMessage(
                    supported
                        ? `Enter ${modeTitle}`
                        : `${modeTitle} is not supported.`,
                );
                setIsSessionSupported(supported);
            });
        },
        [mode, modeTitle],
    );

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!window.isSecureContext) {
            setMessage("WebXR requires a secure context (https).");
            return;
        }
        XRLivelink.isSessionSupported(mode).then(async supported => {
            if (supported) {
                // Not on an iOS device requiring Variant Launch SDK for WebXR,
                // Or variant Launch SDK is already loaded.
                setMessage(`Enter ${modeTitle}`);
                setIsSessionSupported(true);
                return;
            }

            const { VLaunch } = window as unknown as { VLaunch: object };
            if (VLaunch) {
                // Variant Launch SDK is already loaded and WebXR not supported.
                setMessage(`${modeTitle} is not supported.`);
                return;
            }

            if (!variant_launch_sdk_key) {
                // Missing Variant Launch SDK in .env file
                setMessage(
                    "Error: launch.variant3d.com SDK key is not defined",
                );
                return;
            }

            // Load Variant Launch SDK
            loadScript(variant_launch_sdk_url)
                .then(() => {
                    const { VLaunch } = window as unknown as {
                        VLaunch: object;
                    };
                    if (!VLaunch) {
                        // TODO: something is not clear here, there is a first call to `loadScript` where `VLaunch` is
                        // not defiend, but it's defined on a further call. This works but may be by chance.
                        return;
                        // throw new Error(
                        //     "Failed to load launch.variant3d.com SDK, verify SDK key.",
                        // );
                    }
                    window.addEventListener(
                        "vlaunch-initialized",
                        onVlaunchInitialized,
                        { once: true },
                    );
                })
                .catch(error => {
                    setMessage(error.toString());
                    throw error;
                });
        });

        return () => {
            window.removeEventListener(
                "vlaunch-initialized",
                onVlaunchInitialized,
            );
        };
    }, [mode, modeTitle, onVlaunchInitialized]);

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
            {message}
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
            <div className="flex flex-1 flex-col gap-2">
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
                <PerformancePanel className="p-1 mt-1 flex justify-center bg-[color-mix(in_srgb,var(--color-bg-foreground)_85%,transparent)] backdrop-blur-xl rounded-lg shadow-[0px_24px_40px_10px_color-mix(in_srgb,black_40%,transparent)]" />
            </div>
        </div>
    );
}
