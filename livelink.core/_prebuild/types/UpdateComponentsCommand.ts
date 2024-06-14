import { UUID } from "../../sources/types";
import { ComponentType } from "./components";

/**
 *
 */
export type UpdateEntitiesCommand = Record<UUID, Record<ComponentType, {}> | {}>;
