//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Livelink as LivelinkInstance, Client, RTID } from "@3dverse/livelink";

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
            scene_id={scene_id}
            token={token}
            loader={<LoadingSpinner />}
            disconnectedModal={<DisconnectedModal />}
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
        <>
            <DOM3DOverlay>
                {clients.map(client => (
                    <Avatar3D key={client.id} client={client} instance={instance} />
                ))}
            </DOM3DOverlay>
            <AvatarList
                clients={clients}
                setPipCamera={cameraId => setPipCamera(cameraId !== pipCamera ? cameraId : null)}
            />
            {pipCamera !== null && <PiPViewport instance={instance} pipCamera={pipCamera} />}
        </>
    );
}

//------------------------------------------------------------------------------
const PiPViewport = ({ instance, pipCamera }: { instance: LivelinkInstance; pipCamera: RTID }) => {
    return (
        <Canvas
            className={`${sampleCanvasClassName} top-20 w-1/3 h-1/6 right-8 border border-tertiary rounded-lg shadow-2xl`}
        >
            <Viewport className="w-full h-full">
                <Camera finder={() => instance.scene.entity_registry.get({ entity_rtid: pipCamera })} />
            </Viewport>
        </Canvas>
    );
};
//------------------------------------------------------------------------------
const AvatarList = ({ clients, setPipCamera }: { clients: Array<Client>; setPipCamera: (cameraId: RTID) => void }) => {
    return (
        <div className="absolute right-8 top-6">
            <div className="avatar-group flex -space-x-6 rtl:space-x-reverse ">
                {clients.map(client => (
                    <button key={client.id} onClick={() => setPipCamera(client.camera_rtids[0])}>
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
            pixel_dimensions={[40, 40]}
            scale_factor={0.01}
            entity={instance.scene.entity_registry.get({ entity_rtid: client.camera_rtids[0] })}
        >
            <Avatar client={client} />
        </DOMEntity>
    );
};
