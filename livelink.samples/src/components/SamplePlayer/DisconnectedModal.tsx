//------------------------------------------------------------------------------
import { useContext, useEffect } from "react";
import { SamplePlayerContext } from "./SamplePlayer";

//------------------------------------------------------------------------------
export function DisconnectedModal({ error }: { error: string }) {
    const { setConnectionState } = useContext(SamplePlayerContext);

    useEffect(() => {
        setConnectionState?.("connection-lost");
    }, []);

    return (
        <div
            className={
                "w-full h-full absolute z-20 flex items-center justify-center pointer-events-none backdrop-brightness-[25%]"
            }
        >
            <div className="bg-ground p-4 flex items-center justify-center flex-col gap-4 pointer-events-auto rounded-xl">
                <p>You have been disconnected from the server.</p>
                <p>
                    Reason: <span className="bg-warning-500 p-1 rounded-xl">{error}</span>
                </p>
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
