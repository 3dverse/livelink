//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";
import BoringAvatar from "boring-avatars";

//------------------------------------------------------------------------------
import type { Client, Entity, UUID } from "@3dverse/livelink";
import {
    CameraController,
    Canvas,
    DOM3DOverlay,
    DOMEntity,
    Livelink,
    LivelinkContext,
    useCameraEntity,
    useClients,
    Viewport,
} from "@3dverse/livelink-react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import {
    DisconnectedModal,
    SamplePlayer,
} from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "0bb2690b-7962-4c66-baa9-35f83e66e866";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Client Avatars",
    summary:
        "Shows other clients connected to the current session as avatars rendered on a DOM overlay.",
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
        <SamplePlayer autoConnect={true} title="Create Session">
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
        <SamplePlayer autoConnect={true} title="Join Session">
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
                <Avatars />
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
function Avatars() {
    const { instance } = useContext(LivelinkContext);
    const { clients } = useClients();
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
                    <Avatar3D key={client.id} client={client} />
                ))}
            </DOM3DOverlay>
            <AvatarList
                clients={clients}
                watchedClient={watchedClient}
                setWatchedClient={setWatchedClient}
            />
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
            <div className="avatar-group flex gap-1 rtl:space-x-reverse">
                {clients.map(client => (
                    <button
                        key={client.id}
                        onClick={() =>
                            setWatchedClient(
                                client !== watchedClient ? client : null,
                            )
                        }
                        className={`
                            border-2 rounded-full
                            ${client === watchedClient ? " border-accent" : "border-transparent"}
                        `}
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
    if (!watchedClient) {
        return null;
    }

    return (
        <Canvas className="absolute top-20 w-1/3 h-1/6 right-8 border border-tertiary rounded-lg shadow-2x">
            <Viewport className="w-full h-full" client={watchedClient} />
        </Canvas>
    );
};

//------------------------------------------------------------------------------
const Avatar = ({ client }: { client: Client }) => {
    return (
        <div title={client.username}>
            <BoringAvatar name={client.id} size={40} variant="beam" />
        </div>
    );
};

//------------------------------------------------------------------------------
const Avatar3D = ({ client }: { client: Client }) => {
    const [clientCameraEntity, setClientCameraEntity] = useState<Entity | null>(
        null,
    );

    useEffect(() => {
        client
            .getCameraEntities()
            .then(cameraEntities => setClientCameraEntity(cameraEntities[0]));
    });

    if (!clientCameraEntity) {
        return null;
    }

    return (
        <DOMEntity
            key={client.id}
            scaleFactor={0.0025}
            entity={clientCameraEntity}
        >
            <Avatar client={client} />
        </DOMEntity>
    );
};
