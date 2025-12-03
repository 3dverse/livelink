//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
const variant_launch_sdk_key = import.meta.env
    .VITE_WEBXR_VARIANT_LAUNCH_SDK_KEY;
const variant_launch_sdk_url = `https://launchar.app/sdk/v1?key=${variant_launch_sdk_key}&redirect=true`;

//------------------------------------------------------------------------------
export function App() {
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
    const domOverlayRef = useRef<HTMLElement>(null);

    //--------------------------------------------------------------------------
    // Important for dom overlay to be displayed by variant launch app clip:
    // https://launch.variant3d.com/docs/troubleshooting/dom-overlay
    const renderDomOverlay = () => {
        // Create xr dom-overlay root if not exists yet
        const domOverlayId = "xr-dom-overlay-root-variant-launch";
        let domOverlay = document.getElementById(domOverlayId);
        if (!domOverlay) {
            domOverlay = document.createElement("div");
            domOverlay.id = domOverlayId;
            document.body.appendChild(domOverlay);
        }

        // Set ref and clear previous content
        domOverlayRef.current = domOverlay;
        domOverlay.innerHTML = "";

        // Create a portal to the actual dom overlay content from the root
        return createPortal(
            <div
                id="xr-dom-overlay-root"
                style={{
                    zIndex: 11000,
                    position: "absolute",
                    top: "2rem",
                    left: "50%",
                    transform: "translateX(-50%)",
                }}
            >
                <button
                    className="button button-primary"
                    onClick={() => setXRMode(null)}
                >
                    Exit XR
                </button>
            </div>,
            domOverlay,
        );
    };

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
                    // Overscan with resolution scale throws an error on Variant Launch App Clip
                    // See `WebXRHelper.#configureOverscan` for more details.
                    overscanFovFactor={1}
                    enableOverscanSurfaceScale={false}
                    enableFakeAlpha={true}
                >
                    {renderDomOverlay()}
                </WebXR>
            ) : (
                <>
                    <AppLayout />

                    <div className="absolute bottom-[5vh] left-1/2 -translate-x-1/2">
                        <XRButton mode="immersive-ar" enterXR={setXRMode} />
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
            WebXRHelper.isSessionSupported(mode).then(async supported => {
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
        WebXRHelper.isSessionSupported(mode).then(async supported => {
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
