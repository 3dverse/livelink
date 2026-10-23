//------------------------------------------------------------------------------
import type { DOM3DAngleProps } from ".";

//------------------------------------------------------------------------------
/**
 * Values of the optional props of `DOM3DAngle` when they aren't given, shared with its stories. In their own
 * module: the module of the component only exports it, for React Fast Refresh.
 * @internal
 */
export const DOM3D_ANGLE_DEFAULTS = {
    referenceDirection: [0, 1, 0],
    size: 0.22,
    scaleRange: [-90, 90],
    scaleFadeDeg: 70,
    showScaleValues: true,
    showAngleValue: true,
    uncertaintyDeg: 0,
    showNeedle: true,
} satisfies Partial<DOM3DAngleProps>;
