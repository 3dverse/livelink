import { ReactNode } from "react";

//------------------------------------------------------------------------------
export const CanvasActionBar = ({ isCentered, children }: { isCentered?: boolean; children: ReactNode }) => {
    return (
        <output
            className={`absolute flex gap-1 ${isCentered ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "top-6 left-6"}`}
        >
            {children}
        </output>
    );
};
