/**
 * DO NOT EDIT THIS FILE MANUALLY.
 * This file has been generated automatically from its AsyncAPI spec file.
 * See : https://gitlab.com/3dverse/platform/libs/js/asyncapi-server-generator
 */

import { EditorMessageHandler } from "./EditorMessageHandler";
import { EditorEntity, ConnectConfirmation } from "./types";

/**
 * Holds the connection to the LiveLink Broadcast & Persistence server.
 */
export class EditorConnection {
  /**
   * Socket connected to the LiveLink Broadcast & Persistence server.
   */
  private _socket: WebSocket | null = null;

  /**
   * Controller responsible of handling the responses to queries.
   */
  private _handler: EditorMessageHandler | null = null;

  /**
   * Opens a connection to the LiveLink server.
   */
  async connect({
    livelink_url,
    handler,
  }: {
    livelink_url: string;
    handler: EditorMessageHandler;
  }): Promise<void> {
    this._handler = handler;

    return new Promise((resolve, reject) => {
      this._socket = new WebSocket(livelink_url);
      this._socket.binaryType = "arraybuffer";

      this._socket.onopen = (event: Event) => {
        this._onSocketOpened(event);
        resolve();
      };

      this._socket.onclose = (close_event: CloseEvent) =>
        this._onSocketClosed(close_event);

      this._socket.onerror = (event: Event) => {
        this._onSocketError(event);
        reject();
      };

      this._socket.onmessage = (message: MessageEvent<string>) =>
        this._onMessageReceived({ message });
    });
  }

  /**
   *
   */
  send({ data }: { data: ArrayBufferLike | string }): void {
    this._socket!.send(data);
  }

  /**
   *
   */
  disconnect() {
    this._socket?.close();
  }

  /**
   *
   */
  private _onSocketOpened(_event: Event) {
    console.debug("Connected to the 3dverse LiveLink broker");
  }

  /**
   *
   */
  private _onSocketClosed(_close_event: CloseEvent) {
    console.debug("Disconnected from the 3dverse LiveLink broker");
  }

  /**
   *
   */
  private _onSocketError(_event: Event) {}

  /**
   *
   * @param message
   */
  private _onMessageReceived({
    message,
  }: {
    message: MessageEvent<string>;
  }): void {
    const payload = JSON.parse(message.data) as { type: string; data: {} };
    const handler = this._handler!;

    console.log(`RECEIVED [${payload.type}]`, payload.data);

    switch (payload.type) {
      case "connect-confirmation":
        handler.onConnectConfirmation({
          connect_confirmation: payload.data as ConnectConfirmation,
        });
        break;

      case "retrieve-children":
        handler.onRetrieveChildren(payload.data);
        break;

      case "find-entities-with-components":
        handler.onFindEntitiesWithComponents(payload.data);
        break;

      case "resolve-ancestors":
        handler.onResolveAncestors(payload.data);
        break;

      case "find-entities-by-names":
        handler.onFindEntitiesByNames(payload.data);
        break;

      case "get-entities-by-euid":
        handler.onFindEntitiesByEUID(payload.data as Array<EditorEntity>);
        break;

      case "filter-entities":
        handler.onFilterEntities(payload.data);
        break;

      case "export-entity-to-scene":
        handler.onExportEntityToScene(payload.data);
        break;

      case "next-undo-redo":
        handler.onNextUndoRedo(payload.data);
        break;

      case "client-color":
        handler.onClientColor(payload.data);
        break;

      case "scene-stats-update":
        handler.onSceneStatsUpdate(payload.data);
        break;

      case "error":
        handler.onServerError(payload.data);
        break;

      // ACTIONS?
      case "entities-created":
        handler.on_entities_created(payload.data as Array<EditorEntity>);
        break;

      default:
        handler.onUnhandledMessage(payload.type, payload.data);
        break;
    }
  }
}
