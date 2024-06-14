import { RTID } from "../../sources/types";

/**
 *
 */
export interface IEntity {
    get rtid(): RTID | null;
}
