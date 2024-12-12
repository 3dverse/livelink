import { Canvas } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
export function StyledCanvas({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
    return <Canvas className={`max-h-screen bg-[#1e222e] rounded-xl ${className}`}>{children}</Canvas>;
}
