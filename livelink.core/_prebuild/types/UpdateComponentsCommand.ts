import { UUID } from "../../sources";
import { ComponentType } from "./components";

/**
 *
 */
export type UpdateEntitiesCommand = Record<UUID, Record<ComponentType, {}> | {}>;
