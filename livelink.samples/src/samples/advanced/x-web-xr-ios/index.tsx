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
    LXRAppClipLauncher,
    LXRVariantLaunchLauncher,
    useXRLaunch,
    type LXRLauncher,
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
// iOS Safari exposes no WebXR at all, so the session has to run inside a native App Clip that
// injects a polyfill and re-opens this page. Prefer the 3dverse-hosted clip; fall back to Variant
// Launch's hosted one while ours is still in App Review. Off iOS both report "supported" and get
// out of the way, so this needs no platform branch of its own.
const app_clip_domain = import.meta.env.VITE_WEBXR_APP_CLIP_DOMAIN;
const variant_launch_sdk_key = import.meta.env
    .VITE_WEBXR_VARIANT_LAUNCH_SDK_KEY;

function createXRLauncher(): LXRLauncher | undefined {
    if (app_clip_domain) {
        return new LXRAppClipLauncher({ domain: app_clip_domain });
    }
    if (variant_launch_sdk_key) {
        return new LXRVariantLaunchLauncher({ sdkKey: variant_launch_sdk_key });
    }
    return undefined;
}

// Built once, at module scope: `useXRLaunch` re-resolves whenever the launcher identity changes,
// and re-resolving the Variant Launch one means re-running its SDK handshake.
const xr_launcher = createXRLauncher();

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
    // The dom-overlay root has to live outside the React tree for Variant Launch's clip to
    // composite it: https://launch.variant3d.com/docs/troubleshooting/dom-overlay
    // TODO: likely unnecessary under the self-hosted clip, which puts the camera behind a
    // transparent WKWebView and so composites the whole page already. Verify on device before
    // dropping it — see MIGRATION_wem-technology_ios-webxr.md, Phase 5.
    const renderDomOverlay = useCallback(
        (xrMode: XRSessionMode) => {
            // Create xr dom-overlay root if not exists yet
            if (!domOverlayRef.current) {
                domOverlayRef.current = document.createElement("div");
                domOverlayRef.current.id = "xr-dom-overlay-root-launcher";
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
    // Everything platform-specific lives in the launcher: entering the session here, or bouncing
    // through an App Clip on iOS and coming back, are the same button as far as this is concerned.
    const { canLaunch, message, launch } = useXRLaunch({
        mode,
        launcher: xr_launcher,
        onEnter: enterXR,
    });

    return (
        <button
            className={
                "button button-primary" + (!canLaunch ? " opacity-50" : "")
            }
            onClick={launch}
            disabled={!canLaunch}
            style={canLaunch ? {} : { cursor: "not-allowed" }}
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
