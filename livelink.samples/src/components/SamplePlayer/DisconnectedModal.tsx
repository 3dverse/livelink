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
                "absolute z-20 flex items-center justify-center w-full h-full backdrop-brightness-[25%] pointer-events-none"
            }
        >
            <div className="px-10 py-8 flex items-center justify-center flex-col gap-6 bg-ground rounded-xl pointer-events-auto">
                <p className="text-center">
                    You have been disconnected from the server.
                    <span className="block mt-1">
                        Reason: <span className="px-2 py-[2px] bg-warning-500 rounded-full capitalize">{error}</span>
                    </span>
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
