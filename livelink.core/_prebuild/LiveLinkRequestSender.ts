import { LiveLinkConnection } from "./LivelLinkConnection";
import { Components } from "./types";

export class LiveLinkRequestSender {
  protected _livelink_connection: LiveLinkConnection = new LiveLinkConnection();

  createEntity({ components }: { components: any }) {
    console.log(JSON.stringify({ type: "spawn-entity", data: components }));
    this._livelink_connection!.send({
      data: JSON.stringify({ type: "spawn-entity", data: components }),
    });
  }

  attachComponents() {
    this._livelink_connection!.send({
      data: JSON.stringify({ type: "attach-components", data: {} }),
    });
  }
}
