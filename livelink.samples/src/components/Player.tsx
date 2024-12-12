import { useState } from "react";
import { CanvasActionBar } from "../styles/components/CanvasActionBar";

//------------------------------------------------------------------------------
export function SamplePlayer({ children }: React.PropsWithChildren) {
    const [started, setStarted] = useState(false);

    return (
        <>
            {started && children}
            <CanvasActionBar isCentered={!started}>
                <button className="button button-primary" onClick={() => setStarted(!started)}>
                    {started ? "Disconnect" : "Connect"}
                </button>
            </CanvasActionBar>
        </>
    );
}
