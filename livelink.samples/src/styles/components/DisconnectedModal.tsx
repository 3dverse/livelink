//------------------------------------------------------------------------------
import { useContext, useEffect } from "react";
import { SamplePlayerContext } from "../../components/Player";

//------------------------------------------------------------------------------
export function DisconnectedModal({ className = "" }: { className?: string }) {
    const { setConnectionState } = useContext(SamplePlayerContext);

    useEffect(() => {
        setConnectionState?.("connection-lost");
    }, []);

    return (
        <div
            className={`w-full h-full absolute z-10 flex items-center justify-center pointer-events-none ${className}`}
        >
            <div className="bg-ground p-4 flex items-center justify-center flex-col gap-4 pointer-events-auto">
                <div>You have been disconnected from the server.</div>
                {setConnectionState && (
                    <button
                        className="button button-primary"
                        onClick={() => {
                            setConnectionState("reconnect");
                        }}
                    >
                        Reconnect
                    </button>
                )}
            </div>
        </div>
    );
}
