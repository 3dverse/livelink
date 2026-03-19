//------------------------------------------------------------------------------
import { createContext } from "react";

//------------------------------------------------------------------------------
import { XRLivelink } from "../XRLivelink";

//------------------------------------------------------------------------------
/**
 * Context providing WebXR utilities.
 *
 * @category Contexts
 */
export const WebXRContext = createContext<{
    xrLivelink: XRLivelink | null;
}>({
    xrLivelink: null,
});
