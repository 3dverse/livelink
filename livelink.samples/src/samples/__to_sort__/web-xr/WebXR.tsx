//------------------------------------------------------------------------------
import { useRef } from "react";
import { useLivelinkXR } from "@3dverse/livelink-react";
import { ActionBar } from "../../../components/SamplePlayer/ActionBar";

//------------------------------------------------------------------------------
export default function WebXR({ mode }: { mode: XRSessionMode }) {
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        instance,
        isSessionSupported,
        isConnecting,
        message,
        resolutionScale,
        setResolutionScale,
        connect,
        disconnect,
    } = useLivelinkXR({ mode });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else {
            connect({
                scene_id: "e1250c0e-fa04-4af5-a5cb-cf29fd38b78d",
                token: "public_p54ra95AMAnZdTel",
                root_element: containerRef.current!,
            });
        }
    };

    const xrModeTitle = mode.endsWith("ar") ? "AR" : "VR";

    //--------------------------------------------------------------------------
    return (
        <div className="relative h-full max-h-screen p-3" ref={containerRef}>
            <ActionBar isCentered={!instance}>
                <div className="flex items-center justify-center flex-col space-y-3">
                    <button
                        className={"button button-primary" + (!isSessionSupported || isConnecting ? " opacity-50" : "")}
                        onClick={toggleConnection}
                        disabled={isConnecting || !isSessionSupported}
                        style={isSessionSupported ? {} : { cursor: "not-allowed" }}
                    >
                        {isConnecting ? "Connecting..." : instance ? `Exit ${xrModeTitle}` : `Enter ${xrModeTitle}`}
                    </button>

                    {instance && (
                        <div className="flex items-center justify-center flex-col space-y-3">
                            <p>Resolution Scale: {resolutionScale}</p>
                            <input
                                type="range"
                                min="0.1"
                                max="1.5"
                                step="0.05"
                                value={resolutionScale}
                                onChange={e => setResolutionScale(parseFloat(e.target.value))}
                            />
                        </div>
                    )}

                    {message && <p>{message}</p>}
                </div>
            </ActionBar>
        </div>
    );
}
