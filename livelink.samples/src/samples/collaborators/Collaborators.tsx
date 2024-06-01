//------------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Canvas from "../../components/Canvas";
import { Button } from "react-daisyui";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";

//------------------------------------------------------------------------------
export default function Collaborators() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [clients, setClients] = useState<Array<string>>([]);

    const { instance, connect, disconnect } = useLivelinkInstance({
        canvas_refs: [canvasRef],
        token: "public_p54ra95AMAnZdTel",
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (canvasRef.current) {
            await connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
            });
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
        <>
            <div className="relative w-full h-full flex basis-full grow p-4">
                <Canvas canvasRef={canvasRef} />
                <div className="absolute right-6 top-6">
                    <div className="avatar-group -space-x-6 rtl:space-x-reverse">
                        {clients.map(client_id => (
                            <div key={client_id} className="avatar">
                                <div className="w-12">
                                    <img
                                        title={client_id}
                                        src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 pb-4">
                <Button shape="circle" variant="outline" onClick={toggleConnection}>
                    {instance ? "Disconnect" : "Connect"}
                </Button>
            </div>
        </>
    );
}
