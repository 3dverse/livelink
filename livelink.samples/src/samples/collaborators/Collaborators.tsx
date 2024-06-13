//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<string>>([]);

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

        instance.session.addEventListener("client-joined", () => setClients([...instance.session.client_ids]));
        instance.session.addEventListener("client-left", () => setClients([...instance.session.client_ids]));
        setClients([...instance.session.client_ids]);
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
                <div className="avatar-group -space-x-6 rtl:space-x-reverse ">
                    {clients.map(client_id => (
                        <div key={client_id} className="avatar w-10 rounded-full overflow-clip">
                            <img
                                title={client_id}
                                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
