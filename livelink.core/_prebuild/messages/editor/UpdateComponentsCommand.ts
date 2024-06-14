import type { UUID } from "../../../sources/types";
import type { ComponentType } from "../../types/components";

/**
 *
 */
export type UpdateEntitiesCommand = Record<UUID, Record<ComponentType, {}> | {}>;
