import type { FrameData } from "./types";

/**
 *
 */
export interface GatewayEvents {
    "on-frame-received": CustomEvent<FrameData>;
}
