//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import BoringAvatar from "boring-avatars";
import { Camera, Client, Livelink, RTID, RenderingSurface, Viewport } from "@3dverse/livelink";
import { useLivelinkInstance, DOM3DOverlay, DOMEntity } from "@3dverse/livelink-react";

import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
const Avatar = ({ client }: { client: Client }) => {
    return <BoringAvatar name={client.id} size={40} variant="beam" />;
};

//------------------------------------------------------------------------------
const Avatar3D = ({ client, instance }: { client: Client; instance: Livelink }) => {
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

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<Client>>([]);
    const [pipCamera, setPipCamera] = useState<RTID | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({
        views: [{ canvas_ref: canvasRef }],
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
            setPipCamera(null);
        } else if (canvasRef.current) {
            await connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" });
        }
    };

    useEffect(() => {
        if (!instance) {
            return;
        }

        const addClient = async (client: Client) => {
            const camera_rtid = client.camera_rtids[0];
            const camera = await instance.scene.getEntity({ entity_rtid: camera_rtid });
            if (!camera) {
                console.error("Camera not found for client", client);
                return;
            }
        };

        const onClientJoined = async (event: Event) => {
            const client = (event as CustomEvent).detail as Client;
            await addClient(client);
            setClients(instance.session.clients.filter(c => c.id !== instance.session.client_id));
        };

        const onClientLeft = () => {
            setClients([...instance.session.clients.filter(c => c.id !== instance.session.client_id)]);
        };

        instance.session.addEventListener("client-joined", onClientJoined);
        instance.session.addEventListener("client-left", onClientLeft);

        const clients = instance.session.clients.filter(c => c.id !== instance.session.client_id);
        for (const client of clients) {
            addClient(client);
        }

        setClients(clients);
        setClients(instance.session.clients.filter(c => c.id !== instance.session.client_id));

        return () => {
            instance.session.removeEventListener("client-joined", onClientJoined);
            instance.session.removeEventListener("client-left", onClientLeft);
        };
    }, [instance]);

    useEffect(() => {
        if (!instance) return;
        const camera_rtids = clients.map(c => c.camera_rtids).flat();
        if (pipCamera && !camera_rtids.includes(pipCamera)) {
            setPipCamera(null);
        }
        if (pipCamera && camera_rtids.includes(pipCamera)) {
            instance.scene.getEntity({ entity_rtid: pipCamera }).then(entity => {
                if (entity && canvasRef2.current) {
                    const camera = entity as Camera;
                    const viewport = new Viewport(
                        instance,
                        new RenderingSurface({ canvas_element: canvasRef2.current, context_type: "2d" }),
                    );
                    viewport.camera = camera;
                    instance.addViewports({ viewports: [viewport] });
                }
            });
        }
        if (!pipCamera && instance.viewports[1]) {
            instance.removeViewport({ viewport: instance.viewports[1] });
        }
    }, [instance, pipCamera, clients]);

    return (
        <div className="relative h-full max-h-screen p-3 lg:pl-0">
            <Canvas canvasRef={canvasRef}>
                <DOM3DOverlay instance={instance}>
                    {instance &&
                        clients.map(client => <Avatar3D key={client.id} client={client} instance={instance} />)}
                </DOM3DOverlay>

                <CanvasActionBar isCentered={!instance}>
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                </CanvasActionBar>
            </Canvas>
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
            {pipCamera ? (
                <div className="absolute top-3/4 left-8 bottom-8 right-8 border border-tertiary rounded-lg shadow-2xl">
                    <Canvas canvasRef={canvasRef2} />
                </div>
            ) : null}
        </div>
    );
}
