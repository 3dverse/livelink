//------------------------------------------------------------------------------
import { useRef, useState } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { WebXRHelper, WebXRCamera } from "./WebXRHelper";

//------------------------------------------------------------------------------
export default function WebXR({ mode }: { mode: XRSessionMode }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [xrSession, setXRSession] = useState<WebXRHelper | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({
        views: [
            {
                canvas_ref: canvasRef,
                camera: WebXRCamera,
                canvas_context_type: "webgl",
                canvas_context_attributes: { xrCompatible: true },
            },
        ],
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
            xrSession!.release();
        } else if (canvasRef.current) {
            const isXrModeSupported = await WebXRHelper.isSessionSupported(mode);
            if (!isXrModeSupported) {
                setMessage(`WebXR "${mode}" not supported`);
                return;
            }

            // Requesting XR session
            const webXRHelper = new WebXRHelper(mode);
            const r = await connect({
                scene_id: "603fbf03-9863-481e-91a7-c5dc3fd1b93b",
                token: "public_k8l803pCjkX7i58Y",
            });

            if (r === null || r.cameras[0] === null) {
                return;
            }

            const camera = r.cameras[0];
            await webXRHelper.initialize(camera.viewport!);
            setXRSession(webXRHelper);
        }
    };

    return (
        <div className="relative h-full max-h-screen p-3">
            <Canvas canvasRef={canvasRef} />
            <div
                className={`absolute ${instance ? "top-6 left-6" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
            >
                <div className="flex items-center justify-center flex-col space-y-3">
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                    {message && <p>{message}</p>}
                </div>
            </div>
        </div>
    );
}
