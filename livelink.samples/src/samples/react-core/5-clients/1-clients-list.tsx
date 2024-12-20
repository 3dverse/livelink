//------------------------------------------------------------------------------
import { useContext } from "react";

//------------------------------------------------------------------------------
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

//------------------------------------------------------------------------------
import { DisconnectedModal, LoadingSpinner, sampleCanvasClassName } from "../../../components/SamplePlayer";

//------------------------------------------------------------------------------
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;
const scene_id = "d19ecb53-6488-48c1-a085-fab7de85b189";

//------------------------------------------------------------------------------
export default {
    path: import.meta.url,
    title: "Client List",
    summary: "Shows a list of clients connected to the current session.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingSpinner}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <Clients>
                <AppLayout />
            </Clients>
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity();

    return (
        <Canvas className={sampleCanvasClassName}>
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <ClientList />
            </Viewport>
        </Canvas>
    );
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
