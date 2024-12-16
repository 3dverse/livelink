//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink as LivelinkInstance, Client, RTID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import {
    Canvas,
    Clients,
    ClientsContext,
    DOM3DOverlay,
    DOMEntity,
    Livelink,
    LivelinkContext,
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
export default function Collaborators() {
    return (
        <SamplePlayer>
            <Livelink
                scene_id={scene_id}
                token={token}
                loader={<LoadingSpinner />}
                disconnectedModal={<DisconnectedModal />}
            >
                <Clients>
                    <App />
                </Clients>
            </Livelink>
        </SamplePlayer>
    );
}

//------------------------------------------------------------------------------
function App() {
    const { instance } = useContext(LivelinkContext);
    const { clients } = useContext(ClientsContext);
    const [pipCamera, setPipCamera] = useState<RTID | null>(null);

    useEffect(() => {
        if (!clients.find(c => c.camera_rtids[0] === pipCamera)) {
            setPipCamera(null);
        }
    }, [clients, setPipCamera]);

    if (!instance) {
        return null;
    }

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport>
                <DOM3DOverlay>
                    {clients.map(client => (
                        <Avatar3D key={client.id} client={client} instance={instance} />
                    ))}
                </DOM3DOverlay>
                <div className="absolute right-8 top-6">
                    <div className="avatar-group flex -space-x-6 rtl:space-x-reverse ">
                        {clients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => {
                                    const camera_rtid = client.camera_rtids[0];
                                    setPipCamera(currentPip => (currentPip === camera_rtid ? null : camera_rtid));
                                }}
                            >
                                <Avatar client={client} />
                            </button>
                        ))}
                    </div>
                </div>
                {pipCamera !== null && (
                    <div className="absolute top-20 w-1/3 h-1/6 right-8 border border-tertiary rounded-lg shadow-2xl">
                        <Canvas className={sampleCanvasClassName}>
                            <Viewport
                                cameraType={() => instance.scene.entity_registry.get({ entity_rtid: pipCamera })}
                            />
                        </Canvas>
                    </div>
                )}
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
const Avatar = ({ client }: { client: Client }) => {
    return <BoringAvatar name={client.id} size={40} variant="beam" />;
};

//------------------------------------------------------------------------------
const Avatar3D = ({ client, instance }: { client: Client; instance: LivelinkInstance }) => {
    return (
        <DOMEntity
            key={client.id}
            pixel_dimensions={[40, 40]}
            scale_factor={0.01}
            entity={instance.scene.entity_registry.get({ entity_rtid: client.camera_rtids[0] })}
        >
            <Avatar client={client} />
        </DOMEntity>
    );
};
