import { describe, expect, it } from "vitest";

import { connect, type IClientOptions } from "mqtt";

//------------------------------------------------------------------------------
/**
 * Pins the trait of the real `mqtt` module that `MqttTransport.start` copies its options for: the
 * object handed to `connect()` becomes the client's live options, and the generated `clientId` is
 * written into it. Should a version stop doing this, the copy becomes harmless; should this test
 * start failing for another reason, do not "simplify" the copy away — see the transport.
 *
 * `manualConnect` keeps the client from opening a socket, so there is nothing to end afterwards
 * (and `end()` on a client that never had a stream throws inside the module); port 1 is never
 * listened on regardless.
 */
describe("mqtt.connect", () => {
    it("writes the generated clientId into the options object it is given", () => {
        const options: IClientOptions = { host: "127.0.0.1", port: 1, manualConnect: true };
        expect(options.clientId).toBeUndefined();

        const client = connect(options);

        expect(typeof options.clientId).toBe("string");
        expect(client.options).toBe(options);
    });
});
