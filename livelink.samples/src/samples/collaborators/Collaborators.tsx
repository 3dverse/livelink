//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import { Camera, Client, Entity, Livelink, RTID, RenderingSurface, Viewport } from "@3dverse/livelink";

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

    const animate = () => {
        const position = clientCameraRef.current?.local_transform?.position;
        if (position) {
            const { screen_position } = viewport.projectWorldToScreen({ world_position: position });
            avatarRef.current!.style.left = screen_position[0] + "px";
            avatarRef.current!.style.top = screen_position[1] + "px";
            avatarRef.current!.style.display = isAvatarVisible(screen_position, viewport) ? "block" : "none";
            avatarRef.current!.style.width = computeRadius(screen_position[2]) + "px";
            avatarRef.current!.style.height = computeRadius(screen_position[2]) + "px";
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
            <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" />
        </div>
    );
};

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<Client>>([]);
    const [pipCamera, setPipCamera] = useState<RTID | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
            setPipCamera(null);
        } else if (canvasRef.current) {
            await connect({ scene_id: "e7d69f14-d18e-446b-8df3-cbd24e10fa92", token: "public_p54ra95AMAnZdTel" });
        }
    };

    useEffect(() => {
        if (instance === null) {
            return;
        }

        instance.session.addEventListener("client-joined", () =>
            setClients([...instance.session.clients.filter(c => c.id !== instance?.session.client_id)]),
        );
        instance.session.addEventListener("client-left", () =>
            setClients([...instance.session.clients.filter(c => c.id !== instance?.session.client_id)]),
        );
        setClients([...instance.session.clients]);
    }, [instance, setClients]);

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
            <Canvas canvasRef={canvasRef} />
            <CanvasActionBar isCentered={!instance}>
                <button className="button button-primary" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
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
                            <div className="avatar w-10 rounded-full overflow-clip">
                                <img
                                    title={client.id + " | " + client.camera_rtids.join(", ")}
                                    src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            {instance ? (
                <>
                    {clients.map(client => (
                        <Avatar key={client.id} client={client} instance={instance} />
                    ))}
                </>
            ) : null}
            {pipCamera ? (
                <div className="absolute top-3/4 left-8 bottom-8 right-8 border border-tertiary rounded-lg shadow-2xl">
                    <Canvas canvasRef={canvasRef2} />
                </div>
            ) : null}
        </div>
    );
}
