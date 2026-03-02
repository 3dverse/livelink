//------------------------------------------------------------------------------
import { createContext, useContext } from "react";

//------------------------------------------------------------------------------
import { DOM3DOverlayContainer } from "../overlays/DOM3DOverlayContainer";

/**
 * Context that provides an overlay.
 *
 * @category Contexts
 */
export const OverlayContext = createContext<DOM3DOverlayContainer | null>(null);

/**
 * Hook to access the DOM3DOverlayContainer from the context.
 *
 * @category Hooks
 */
export function useDOM3DOverlay(): DOM3DOverlayContainer | null {
    return useContext(OverlayContext);
}
