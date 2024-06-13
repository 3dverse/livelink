import { RTID } from "../../sources";

/**
 *
 */
export interface IEntity {
    get rtid(): RTID | null;
}
