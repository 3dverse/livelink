import { UUID } from "./types/common";

/**
 * A client is the representation of a singular user in a session.
 * The same user can have multiple clients in a single session.
 */
export class Client {
  constructor(private readonly _uuid: UUID) {}

  get uuid() {
    return this._uuid;
  }
}
