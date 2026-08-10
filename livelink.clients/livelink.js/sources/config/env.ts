// Same environment detection as the shared base, which declares the maybe-missing globals itself
// instead of relying on @types/node / DOM ambient types being in the program.
export * from "@livelink.base/config/env";
