//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { DefaultCamera, useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import { Client, Entity, Livelink, Viewport } from "@3dverse/livelink";

const isAvatarVisible = (projection: number[], viewport: Viewport) => {
    return (
        projection[0] >= 0 &&
        projection[0] <= viewport.width &&
        projection[1] >= 0 &&
        projection[1] <= viewport.height &&
        projection[2] > 0 &&
        projection[2] < 1
    );
};

const RADIUS_MIN = 20;
const RADIUS_MAX = 120;

const computeRadius = (zValue: number) => {
    const far = 1000;
    const near = 0.1;
    const radius = RADIUS_MIN * (far - near) * (1 - zValue) * 0.1;
    return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, radius));
};

//------------------------------------------------------------------------------
const Avatar = ({ client, instance }: { client: Client; instance: Livelink }) => {
    const clientCameraRef = useRef<Entity | null>(null);
    const requestRef = useRef<number>(0);
    const avatarRef = useRef<HTMLDivElement>(null);

    const viewport = instance.viewports[0];
    const camera = viewport?.camera as DefaultCamera;

    const animate = () => {
        const position = clientCameraRef.current?.local_transform?.position;
        if (position) {
            const projection = camera.project(position);
            avatarRef.current!.style.left = projection[0] + "px";
            avatarRef.current!.style.top = projection[1] + "px";
            avatarRef.current!.style.display = isAvatarVisible(projection, viewport) ? "block" : "none";
            avatarRef.current!.style.width = computeRadius(projection[2]) + "px";
            avatarRef.current!.style.height = computeRadius(projection[2]) + "px";
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const camera_rtid = client.camera_rtids[0];
        instance.scene.getEntity({ entity_rtid: camera_rtid }).then((entity: Entity | null) => {
            clientCameraRef.current = entity;
        });
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    return (
        <div
            ref={avatarRef}
            className="avatar w-10 rounded-full overflow-clip absolute"
            style={{
                transform: "translate(-50%, -50%)",
                display: "none",
            }}
        >
            <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
        </div>
    );
};

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<Client>>([]);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            await connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" });
        }
    };

    useEffect(() => {
        if (instance === null) {
            return;
        }

        instance.session.addEventListener("client-joined", () => setClients([...instance.session.clients]));
        instance.session.addEventListener("client-left", () => setClients([...instance.session.clients]));
        setClients([...instance.session.clients]);
    }, [instance, setClients]);

    return (
        <div className="relative h-full max-h-screen p-3">
            <Canvas canvasRef={canvasRef} />
            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
            <div className="absolute right-8 top-6">
                <div className="avatar-group flex -space-x-6 rtl:space-x-reverse ">
                    {clients.map(client => (
                        <div key={client.id} className="avatar w-10 rounded-full overflow-clip">
                            <img
                                title={client.id + " | " + client.camera_rtids.join(", ")}
                                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg"
                            />
                        </div>
                    ))}
                </div>
            </div>
            {instance ? (
                <>
                    {clients
                        .filter(client => client.id !== instance?.session.client_id)
                        .map(client => (
                            <Avatar key={client.id} client={client} instance={instance} />
                        ))}
                </>
            ) : null}
        </div>
    );
}
