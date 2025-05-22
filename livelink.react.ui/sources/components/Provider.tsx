import React from "react";

//------------------------------------------------------------------------------
// 3dverse prefixed CSS variables
import "@3dverse/design-tokens/css/design-tokens.css";

//------------------------------------------------------------------------------
// Global styles
import "../styles/globals.css";

//------------------------------------------------------------------------------
interface ProviderProps {
    children: React.ReactNode;
}

//------------------------------------------------------------------------------
export const LivelinkReactUIProvider: React.FC<ProviderProps> = ({ children }) => {
    return children;
};
