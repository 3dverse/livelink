//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink";
import {
    Livelink,
    Clients,
    Canvas,
    Viewport,
    ClientsContext,
    LivelinkContext,
    useCameraEntity,
    CameraController,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal, SamplePlayer } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "d19ecb53-6488-48c1-a085-fab7de85b189";

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    title: "Client List",
    summary: "Shows a list of clients connected to the current session.",
    useCustomLayout: true,
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    const [sessionId, setSessionId] = useState<UUID | null>(null);

    return (
        <div className="w-full h-full flex relative pl-3">
            <SessionCreator setSessionId={setSessionId} />
            <SessionJoiner sessionId={sessionId} />
        </div>
    );
}

//------------------------------------------------------------------------------
function SessionCreator({ setSessionId }: { setSessionId: (sessionId: UUID | null) => void }) {
    return (
        <SamplePlayer title={"Create Session"}>
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <SessionSniffer setSessionId={setSessionId} />
                <Clients>
                    <AppLayout />
                </Clients>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function SessionJoiner({ sessionId }: { sessionId: UUID | null }) {
    if (!sessionId) {
        return (
            <div className="w-full h-full flex-col content-center justify-center">
                <h1 className="text-center font-medium">Waiting for the main session to join</h1>
            </div>
        );
    }

    return (
        <SamplePlayer title={"Join Session"}>
            <Livelink
                sessionId={sessionId}
                sessionOpenMode="join"
                token={token}
                LoadingPanel={LoadingOverlay}
                ConnectionErrorPanel={DisconnectedModal}
            >
                <Clients>
                    <AppLayout />
                </Clients>
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
function SessionSniffer({ setSessionId }: { setSessionId: (sessionId: UUID | null) => void }) {
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
    const { clients } = useContext(ClientsContext);
    const prettifyUsername = (username: string) => username.substring(username.lastIndexOf("_") + 1);

    return (
        <ul className="absolute right-0 bottom-0 flex flex-col-reverse">
            <li className="bg-informative-800 p-2 m-1 rounded-full text-3xs">{`Current Client = ${instance?.session.client_id}`}</li>
            {clients.map((client, i) => {
                return (
                    <li key={client.id} className="bg-foreground p-2 m-1 rounded-full text-3xs">
                        {`Client[${i}] = ${prettifyUsername(client.username)}`}
                    </li>
                );
            })}
        </ul>
    );
}
