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

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const variant_launch_sdk_key = import.meta.env.VITE_WEBXR_VARIANT_LAUNCH_SDK_KEY;
const variant_launch_sdk_url = `https://launchar.app/sdk/v1?key=${variant_launch_sdk_key}&redirect=true`;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    title: "WebXR on iOS (AR only)",
    summary: "WebXR AR immersive experience on iOS using launch.variant3d.com",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);

    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            {xrMode ? (
                <WebXR mode={xrMode}>
                    <div className="fixed top-4 left-4">
                        <button className="button button-primary" onClick={() => setXRMode(null)}>
                            Exit XR
                        </button>
                    </div>
                </WebXR>
            ) : (
                <>
                    <AppLayout />

                    <div className="absolute w-full top-4 flex items-center justify-center gap-4">
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
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function XRButton({ mode, enterXR }: { mode: XRSessionMode; enterXR: (mode: XRSessionMode) => void }) {
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [message, setMessage] = useState("");
    const modeTitle = mode.replace("immersive-", "").toUpperCase();

    //--------------------------------------------------------------------------
    // Dynamic script loading using the DOM
    function loadScript(url: string) {
        return new Promise<Event | void>((resolve, reject) => {
            let script: HTMLScriptElement | null = document.querySelector(`script[src="${url}"]`);
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
    function onVlaunchInitialized(event: Event) {
        const customEvent = event as CustomEvent;
        console.debug("vlaunch-initialized:", customEvent);

        if (customEvent.detail?.launchRequired) {
            // Load Variant Launch URL to reload the sample inside Variant
            // Launch iOS Clip App.
            const { VLaunch } = window as unknown as any;
            const url = window.location.href;
            window.location.href = VLaunch.getLaunchUrl(url);
            return;
        }
        WebXRHelper.isSessionSupported(mode).then(async supported => {
            setMessage(supported ? `Enter ${modeTitle}` : `${modeTitle} is not supported.`);
            setIsSessionSupported(supported);
        });
    }

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

            const { VLaunch } = window as unknown as any;
            if (VLaunch) {
                // Variant Launch SDK is already loaded and WebXR not supported.
                setMessage(`${modeTitle} is not supported.`);
                return;
            }

            if (!variant_launch_sdk_key) {
                // Missing Variant Launch SDK in .env file
                setMessage("Error: launch.variant3d.com SDK key is not defined");
                return;
            }

            // Load Variant Launch SDK
            loadScript(variant_launch_sdk_url)
                .then(() => {
                    const { VLaunch } = window as unknown as any;
                    if (!VLaunch) {
                        throw new Error("Failed to load launch.variant3d.com SDK, verify SDK key.");
                    }
                    window.addEventListener("vlaunch-initialized", onVlaunchInitialized, { once: true });
                })
                .catch(error => {
                    setMessage(error.toString());
                    throw error;
                });
        });

        return () => {
            window.removeEventListener("vlaunch-initialized", onVlaunchInitialized);
        };
    }, [mode]);

    return (
        <button
            className={"button button-primary" + (!isSessionSupported ? " opacity-50" : "")}
            onClick={() => enterXR(mode)}
            disabled={!isSessionSupported}
            style={isSessionSupported ? {} : { cursor: "not-allowed" }}
            title={message}
        >
            {message}
        </button>
    );
}
