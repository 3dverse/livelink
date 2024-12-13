import { useState } from "react";
import { CanvasActionBar } from "../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export function SamplePlayer({ children }: React.PropsWithChildren) {
    const [started, setStarted] = useState(false);

    return (
        <div className="w-full h-full flex gap-3 p-3 lg:pl-0 relative">
            {started && children}
            <CanvasActionBar isCentered={!started}>
                <button className="button button-primary" onClick={() => setStarted(!started)}>
                    {started ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </div>
    );
}
