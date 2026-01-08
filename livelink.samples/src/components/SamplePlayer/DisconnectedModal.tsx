import { useContext, useEffect } from "react";
import { SamplePlayerContext } from "./SamplePlayer";

//------------------------------------------------------------------------------
export function DisconnectedModal({ error }: { error: string }) {
    const { setConnectionState } = useContext(SamplePlayerContext);

    useEffect(() => {
        setConnectionState?.("connection-lost");
    }, [setConnectionState]);

    //--------------------------------------------------------------------------
    return (
        <div
            className="absolute z-20 flex flex-col items-center justify-center gap-5 w-full h-full px-6 md:px-10 py-8 text-center text-balance backdrop-brightness-25 backdrop-blur-xl cursor-default"
            onClick={() => setConnectionState?.("reconnect")}
        >
            <p>
                You have been disconnected from the server.
                <span className="block mt-1 cursor-auto">
                    Reason: <span className="pl-1 py-[2px] text-informative rounded-full capitalize">{error}</span>
                </span>
            </p>
            {setConnectionState && <p className="text-2xs tracking-wide text-accent">Click anywhere to reconnect</p>}
        </div>
    );
}
