//------------------------------------------------------------------------------
import { useState, useEffect } from "react";
import { Livelink, SoftwareDecoder, WebCodecsDecoder } from "@3dverse/livelink";
import { WebXRHelper } from "./WebXRHelper";

//------------------------------------------------------------------------------
export default function WebXR({ mode }: { mode: XRSessionMode }) {
    const [xrSession, setXRSession] = useState<WebXRHelper | null>(null);
    const [instance, setInstance] = useState<Livelink | null>(null);
    const [message, setMessage] = useState<string>("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSessionSupported, setIsSessionSupported] = useState(false);

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
        const viewports = await webXRHelper.configureViewports(livelinkInstance);

        const webcodec = await WebCodecsDecoder.findSupportedCodec();
        await livelinkInstance.configureRemoteServer({ codec: webcodec || undefined });
        await livelinkInstance.installFrameConsumer({
            frame_consumer:
                webcodec !== null
                    ? new WebCodecsDecoder(livelinkInstance.default_decoded_frame_consumer)
                    : new SoftwareDecoder(livelinkInstance.default_decoded_frame_consumer),
        });

        await webXRHelper.createCameras(viewports);
        livelinkInstance.startStreaming();
        webXRHelper.start();
    }

    //--------------------------------------------------------------------------
    const toggleConnection = async () => {
        if (instance) {
            instance.disconnect();
            setInstance(null);
        }

        const webXRHelper = new WebXRHelper();
        await webXRHelper.initialize(mode);

        webXRHelper.session!.addEventListener("end", () => {
            setInstance(null);
            setXRSession(null);
        });

        setIsConnecting(true);

        const livelinkInstance = await Livelink.join_or_start({
            scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d",
            token: "public_p54ra95AMAnZdTel",
        });

        await configureClient(webXRHelper, livelinkInstance);

        setXRSession(webXRHelper);
        setInstance(livelinkInstance);
        setIsConnecting(false);
    };

    //--------------------------------------------------------------------------
    useEffect(() => {
        WebXRHelper.isSessionSupported(mode).then(supported => {
            if (!supported) {
                setMessage(`WebXR '${mode}' is not supported on this device.`);
            } else {
                setIsSessionSupported(true);
            }
        });
    }, [mode]);

    //--------------------------------------------------------------------------
    return (
        <div className="relative h-full max-h-screen p-3">
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <div className="flex items-center justify-center flex-col space-y-3">
                    <button
                        className={"button button-primary" + (!isSessionSupported || isConnecting ? " opacity-50" : "")}
                        onClick={toggleConnection}
                        disabled={isConnecting || !isSessionSupported}
                        style={isSessionSupported ? {} : { cursor: "not-allowed" }}
                    >
                        {isConnecting ? "Connecting..." : instance ? "Disconnect" : "Connect"}
                    </button>
                    {message && <p>{message}</p>}
                </div>
            </div>
        </div>
    );
}
