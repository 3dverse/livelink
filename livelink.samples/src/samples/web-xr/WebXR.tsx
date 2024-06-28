//------------------------------------------------------------------------------
import { useState, useEffect, useRef } from "react";
import { Livelink, SoftwareDecoder, WebCodecsDecoder } from "@3dverse/livelink";
import { WebXRHelper } from "./WebXRHelper";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export default function WebXR({ mode }: { mode: XRSessionMode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [xrSession, setXRSession] = useState<WebXRHelper | null>(null);
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [message, setMessage] = useState<string>("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSessionSupported, setIsSessionSupported] = useState(false);
    const [enableScale, setEnableScale] = useState(false);
    const [resolution, setResolution] = useState("");

    //--------------------------------------------------------------------------
    useEffect(() => {
        return () => {
            instance?.disconnect();
        };
    }, [instance]);

    useEffect(() => {
        return () => {
            xrSession?.release();
        };
    }, [xrSession]);

    //--------------------------------------------------------------------------
    async function configureClient(webXRHelper: WebXRHelper, livelinkInstance: Livelink) {
        const resolution = await webXRHelper.configureViewports(livelinkInstance, enableScale);

        const webcodec = await WebCodecsDecoder.findSupportedCodec();
        await livelinkInstance.configureRemoteServer({ codec: webcodec || undefined });
        await livelinkInstance.installFrameConsumer({
            frame_consumer:
                webcodec !== null
                    ? new WebCodecsDecoder(livelinkInstance.default_decoded_frame_consumer)
                    : new SoftwareDecoder(livelinkInstance.default_decoded_frame_consumer),
        });

        await webXRHelper.createCameras();
        livelinkInstance.startStreaming();
        webXRHelper.start();

        setResolution(resolution);
    }

    //--------------------------------------------------------------------------
    const toggleConnection = async () => {
        if (instance) {
            setXRSession(null);
            setInstance(null);
            return;
        }

        const webXRHelper = new WebXRHelper();
        let livelinkInstance: Livelink | null = null;

        try {
            setMessage("");
            await webXRHelper.initialize(mode, {
                optionalFeatures: ["dom-overlay"],
                domOverlay: { root: containerRef.current! },
            });

            webXRHelper.session!.addEventListener("end", () => {
                setInstance(null);
                setXRSession(null);

                setResolution("");
            });

            setIsConnecting(true);

            livelinkInstance = await Livelink.join_or_start({
                scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d",
                token: "public_p54ra95AMAnZdTel",
            });

            await configureClient(webXRHelper, livelinkInstance);

            setXRSession(webXRHelper);
            setInstance(livelinkInstance);
        } catch (error) {
            webXRHelper.release();
            livelinkInstance?.disconnect();
            setMessage(`Error: ${error instanceof Error ? error.message : error}`);
        } finally {
            setIsConnecting(false);
        }
    };

    //--------------------------------------------------------------------------
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

    const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

    //--------------------------------------------------------------------------
    return (
        <div className="relative h-full max-h-screen p-3" ref={containerRef}>
            <CanvasActionBar isCentered={!instance}>
                <div className="flex items-center justify-center flex-col space-y-3">
                    <button
                        className={"button button-primary" + (!isSessionSupported || isConnecting ? " opacity-50" : "")}
                        onClick={toggleConnection}
                        disabled={isConnecting || !isSessionSupported}
                        style={isSessionSupported ? {} : { cursor: "not-allowed" }}
                    >
                        {isConnecting ? "Connecting..." : instance ? `Exit ${xrModeTitle}` : `Enter ${xrModeTitle}`}
                    </button>

                    {resolution && <p>{resolution}</p>}

                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            disabled={isConnecting || instance !== null}
                            checked={enableScale}
                            onChange={() => setEnableScale(!enableScale)}
                        />
                        <label htmlFor="enableScale">Enable Scale</label>
                    </div>

                    {message && <p>{message}</p>}
                </div>
            </CanvasActionBar>
        </div>
    );
}
