/**
 *
 */
export type EntityUpdatedEvent = {
    updatedAncestors: Array<unknown>;
    updatedComponents: Record<string, unknown>;
};
