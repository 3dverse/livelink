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
    useClients,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "0bb2690b-7962-4c66-baa9-35f83e66e866";

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Client List",
    summary: "Shows a list of clients connected to the current session.",
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
        <SamplePlayer title="Create Session">
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
            <div className="w-full h-full flex-col content-center justify-center">
                <h1 className="text-center font-medium">
                    Waiting for the main session to join
                </h1>
            </div>
        );
    }

    return (
        <SamplePlayer title="Join Session">
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
                <ClientList />
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

//------------------------------------------------------------------------------
function ClientList() {
    const { instance } = useContext(LivelinkContext);
    const { clients } = useClients();
    const prettifyUsername = (username: string) =>
        username.substring(username.lastIndexOf("_") + 1);

    const badgeClassName = "px-3 py-1 rounded-full text-3xs";

    return (
        <ul className="absolute right-2 bottom-2 flex flex-col-reverse gap-px">
            <li className={`${badgeClassName} bg-informative-800`}>
                {`Current Client = ${instance?.session.client_id}`}
            </li>
            {clients.map((client, i) => {
                return (
                    <li
                        key={client.id}
                        className={`${badgeClassName} bg-foreground`}
                    >
                        {`Client[${i}] = ${prettifyUsername(client.username)}`}
                    </li>
                );
            })}
        </ul>
    );
}
