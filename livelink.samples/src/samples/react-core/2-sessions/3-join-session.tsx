//------------------------------------------------------------------------------
import { Livelink, Canvas, Viewport, Camera, DefaultCamera, LivelinkContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";
import { useContext, useEffect, useState } from "react";
import { UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "d19ecb53-6488-48c1-a085-fab7de85b189";

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Join Session",
    summary: "Start by creating a session on one canvas then join it from another canvas.",
    useCustomLayout: true,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [sessionId, setSessionId] = useState<UUID | null>(null);

    return (
        <div className="w-full h-full flex relative pl-3">
            <SamplePlayer autoConnect={false} title={"Create Session"}>
                <Livelink
                    sceneId={scene_id}
                    token={token}
                    LoadingPanel={LoadingSpinner}
                    ConnectionErrorPanel={DisconnectedModal}
                >
                    <Canvas className={sampleCanvasClassName}>
                        <Viewport className="w-full h-full">
                            <Camera class={DefaultCamera} name="MyCamera" />
                            <SessionSniffer setSessionId={setSessionId} />
                        </Viewport>
                    </Canvas>
                </Livelink>
            </SamplePlayer>
            {sessionId ? (
                <SamplePlayer autoConnect={false} title={"Join Session"}>
                    <Livelink
                        sessionId={sessionId}
                        sessionOpenMode="join"
                        token={token}
                        LoadingPanel={LoadingSpinner}
                        ConnectionErrorPanel={DisconnectedModal}
                    >
                        <Canvas className={sampleCanvasClassName}>
                            <Viewport className="w-full h-full">
                                <Camera class={DefaultCamera} name="MyCamera" />
                            </Viewport>
                        </Canvas>
                    </Livelink>
                </SamplePlayer>
            ) : (
                <div className="w-full h-full flex-col content-center justify-center">
                    <h1 className="text-center font-medium">Start by creating a session</h1>
                </div>
            )}
        </div>
    );
}

//------------------------------------------------------------------------------
function SessionSniffer({ setSessionId }: { setSessionId: (sessionId: UUID | null) => void }) {
    const { instance } = useContext(LivelinkContext);
    useEffect(() => {
        setSessionId(instance?.session.session_id ?? null);
        return () => setSessionId(null);
    });
    return null;
}
