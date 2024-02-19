import { RTID, UUID } from "../_prebuild/types";

export class Entity {
  /**
   *
   */
  euid?: { value: UUID; rtid: RTID };
  debug_name?: { value: string };

  /**
   *
   */
  getName(): string {
    return this.debug_name ? this.debug_name.value : "unnamed entity";
  }
}
