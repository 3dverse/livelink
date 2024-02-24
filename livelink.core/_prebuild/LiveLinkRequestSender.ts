import { LiveLinkConnection } from "./LiveLinkConnection";

/**
 * This follows the LiveLink protocol specifications for the broker messages.
 */
export class LiveLinkRequestSender {
  /**
   *
   */
  constructor(private _conn: LiveLinkConnection) {}

  /**
   *
   */
  spawnEntity({ components }: { components: any }) {
    this._conn!.send({
      data: JSON.stringify(
        { type: "spawn-entity", data: components },
        (key, value) => (typeof value === "bigint" ? value.toString() : value)
      ),
    });
  }

  /**
   *
   */
  attachComponents() {
    this._conn!.send({
      data: JSON.stringify({ type: "attach-components", data: {} }),
    });
  }
}
