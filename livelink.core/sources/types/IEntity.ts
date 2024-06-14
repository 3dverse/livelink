import { RTID } from ".";

/**
 *
 */
export interface IEntity {
    get rtid(): RTID | null;
}
