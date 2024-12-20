//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink as LivelinkInstance, Client, Entity, UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    CameraController,
    Canvas,
    Clients,
    ClientsContext,
    DOM3DOverlay,
    DOMEntity,
    Livelink,
    LivelinkContext,
    useCameraEntity,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import BoringAvatar from "boring-avatars";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    LoadingSpinner,
    sampleCanvasClassName,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "545cb90f-a3e0-4531-9d98-0fc6d9131097";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Client Avatars",
    summary: "Shows other clients connected to the current session as avatars rendered on a DOM overlay.",
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
        <SamplePlayer autoConnect={false} title={"Create Session"}>
            <Livelink
                sceneId={scene_id}
                token={token}
                LoadingPanel={LoadingSpinner}
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
        <SamplePlayer autoConnect={false} title={"Join Session"}>
            <Livelink
                sessionId={sessionId}
                sessionOpenMode="join"
                token={token}
                LoadingPanel={LoadingSpinner}
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
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <Avatars />
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
function Avatars() {
    const { instance } = useContext(LivelinkContext);
    const { clients } = useContext(ClientsContext);
    const [watchedClient, setWatchedClient] = useState<Client | null>(null);

    useEffect(() => {
        if (watchedClient && !clients.includes(watchedClient)) {
            setWatchedClient(null);
        }
    }, [clients]);

    if (!instance) {
        return null;
    }

    return (
        <>
            <DOM3DOverlay>
                {clients.map(client => (
                    <Avatar3D key={client.id} client={client} instance={instance} />
                ))}
            </DOM3DOverlay>
            <AvatarList clients={clients} watchedClient={watchedClient} setWatchedClient={setWatchedClient} />
            <PiPViewport watchedClient={watchedClient} />
        </>
    );
}

//------------------------------------------------------------------------------
const AvatarList = ({
    clients,
    watchedClient,
    setWatchedClient,
}: {
    clients: Array<Client>;
    watchedClient: Client | null;
    setWatchedClient: (client: Client | null) => void;
}) => {
    return (
        <div className="absolute right-40 top-4">
            <div className="avatar-group flex gap-1 rtl:space-x-reverse ">
                {clients.map(client => (
                    <button
                        key={client.id}
                        title={client.username}
                        onClick={() => setWatchedClient(client !== watchedClient ? client : null)}
                    >
                        <Avatar client={client} />
                    </button>
                ))}
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
const PiPViewport = ({ watchedClient }: { watchedClient: Client | null }) => {
    //TEMPTEMPTEMPTEMP
    const { instance } = useContext(LivelinkContext);
    const [clientCameraEntity, setClientCameraEntity] = useState<Entity | null>(null);
    useEffect(() => {
        if (instance && watchedClient) {
            instance.scene.getEntity({ entity_rtid: watchedClient.camera_rtids[0] }).then(setClientCameraEntity);
        }
    });
    //TEMPTEMPTEMPTEMP

    if (!watchedClient) {
        return null;
    }

    return (
        <Viewport
            cameraEntity={clientCameraEntity}
            className="absolute top-20 w-1/3 h-1/6 right-8 border border-tertiary rounded-lg shadow-2x"
        />
    );
};

//------------------------------------------------------------------------------
const Avatar = ({ client }: { client: Client }) => {
    return <BoringAvatar name={client.id} size={40} variant="beam" />;
};

//------------------------------------------------------------------------------
const Avatar3D = ({ instance, client }: { instance: LivelinkInstance; client: Client }) => {
    //TEMPTEMPTEMPTEMP
    const [clientCameraEntity, setClientCameraEntity] = useState<Entity | null>(null);
    useEffect(() => {
        instance.scene.getEntity({ entity_rtid: client.camera_rtids[0] }).then(setClientCameraEntity);
    });
    if (!clientCameraEntity) {
        return null;
    }
    //TEMPTEMPTEMPTEMP

    return (
        <DOMEntity key={client.id} scaleFactor={0.0025} entity={clientCameraEntity}>
            <Avatar client={client} />
        </DOMEntity>
    );
};
