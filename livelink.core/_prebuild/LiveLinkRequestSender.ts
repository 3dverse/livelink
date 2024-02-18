import { LiveLinkConnection } from "./LivelLinkConnection";

export class LiveLinkRequestSender {
  protected _livelink_connection: LiveLinkConnection = new LiveLinkConnection();

  createEntity({ components }: { components: any }) {
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
