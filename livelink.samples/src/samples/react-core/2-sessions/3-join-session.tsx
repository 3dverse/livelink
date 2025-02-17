//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "d19ecb53-6488-48c1-a085-fab7de85b189";

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Join Session",
    summary:
        "Start by creating a session on one canvas then join it from another canvas.",
    useCustomLayout: true,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [sessionId, setSessionId] = useState<UUID | null>(null);

    return (
        <div className="relative flex w-full h-full">
            <SessionCreator setSessionId={setSessionId} />
            <SessionJoiner sessionId={sessionId} />
        </div>
    );
}

//------------------------------------------------------------------------------
function SessionCreator({
    setSessionId,
}: {
    setSessionId: (sessionId: UUID | null) => void;
}) {
    return (
        <SamplePlayer autoConnect={false} title="Create Session">
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <SessionSniffer setSessionId={setSessionId} />
                <AppLayout />
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function SessionJoiner({ sessionId }: { sessionId: UUID | null }) {
    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full">
                <p className="text-center">Start by creating a session</p>
            </div>
        );
    }

    return (
        <SamplePlayer autoConnect={false} title="Join Session">
            <Livelink
                sessionId={sessionId}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <AppLayout />
            </Livelink>
        </SamplePlayer>
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
function SessionSniffer({
    setSessionId,
}: {
    setSessionId: (sessionId: UUID | null) => void;
}) {
    const { instance } = useContext(LivelinkContext);
    useEffect(() => {
        setSessionId(instance?.session.session_id ?? null);
        return () => setSessionId(null);
    });
    return null;
}
