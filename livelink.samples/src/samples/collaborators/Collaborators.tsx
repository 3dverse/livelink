//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { useLivelinkInstance } from "@3dverse/livelink-react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import { Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<Client>>([]);

    const { instance, connect, disconnect } = useLivelinkInstance({ views: [{ canvas_ref: canvasRef }] });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            await connect({ scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7", token: "public_p54ra95AMAnZdTel" });
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
        </div>
    );
}
