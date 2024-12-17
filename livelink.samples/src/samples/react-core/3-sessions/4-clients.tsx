//------------------------------------------------------------------------------
import { useContext } from "react";

//------------------------------------------------------------------------------
import { Livelink, Clients, Canvas, Viewport, ClientsContext, Camera, DefaultCamera } from "@3dverse/livelink-react";

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
    const { clients } = useContext(ClientsContext);
    return (
        <ul className="absolute right-0 bottom-0">
            {clients.map((client, i) => {
                return (
                    <li key={i} className="bg-foreground p-2 m-1 rounded-full text-3xs">
                        {`Client[${i}] = ${client.id}`}
                    </li>
                );
            })}
        </ul>
    );
}
