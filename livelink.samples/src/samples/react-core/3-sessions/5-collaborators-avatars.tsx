//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink as LivelinkInstance, Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    Camera,
    Canvas,
    Clients,
    ClientsContext,
    DefaultCamera,
    DOM3DOverlay,
    DOMEntity,
    Livelink,
    LivelinkContext,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import BoringAvatar from "boring-avatars";

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "545cb90f-a3e0-4531-9d98-0fc6d9131097";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Client Avatars",
    summary: "Shows other clients connected to the current session as avatars rendered on a DOM overlay.",
    element: (
        <Livelink
            sceneId={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            connectionLostPanel={<DisconnectedModal />}
        >
            <Clients>
                <Canvas className={sampleCanvasClassName}>
                    <Viewport className="w-full h-full">
                        <Camera class={DefaultCamera} name={"MyCamera"} />
                        <App />
                    </Viewport>
                </Canvas>
            </Clients>
        </Livelink>
    ),
};

//------------------------------------------------------------------------------
function App() {
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
const PiPViewport = ({ watchedClient }: { watchedClient: Client | null }) => {
    if (!watchedClient) {
        return null;
    }

    return (
        <Viewport className="absolute top-20 w-1/3 h-1/6 right-8 border border-tertiary rounded-lg shadow-2x">
            <Camera client={watchedClient} index={0} />
        </Viewport>
    );
};
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
            <div className="avatar-group flex -space-x-6 rtl:space-x-reverse ">
                {clients.map(client => (
                    <button key={client.id} onClick={() => setWatchedClient(client !== watchedClient ? client : null)}>
                        <Avatar client={client} />
                    </button>
                ))}
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
const Avatar = ({ client }: { client: Client }) => {
    return <BoringAvatar name={client.id} size={40} variant="beam" />;
};

//------------------------------------------------------------------------------
const Avatar3D = ({ client, instance }: { client: Client; instance: LivelinkInstance }) => {
    return (
        <DOMEntity
            key={client.id}
            pixelDimensions={[40, 40]}
            scaleFactor={0.01}
            entity={instance.scene.entity_registry.get({ entity_rtid: client.camera_rtids[0] })}
        >
            <Avatar client={client} />
        </DOMEntity>
    );
};
