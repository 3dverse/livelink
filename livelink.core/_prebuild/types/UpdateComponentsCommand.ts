import { UUID } from "../../sources";

/**
 *
 */
type ComponentType = string;

/**
 *
 */
export type UpdateEntitiesCommand = Record<UUID, Record<ComponentType, {}> | {}>;
