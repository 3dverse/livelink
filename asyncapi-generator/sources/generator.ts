import { Parser, fromFile } from "@asyncapi/parser";

export async function generate(specFilePath: string, options: {}) {
    console.log("GENERATING...");
    const parser = new Parser();
    const { document, diagnostics } = await fromFile(parser, specFilePath).parse();

    console.log("Diag", diagnostics);

    const operations = document.allOperations();
    for (const operation of operations) {
        if (operation.action() === "send") {
            for (const message of operation.messages()) {
                switch (message.contentType()) {
                    case "application/json":
                        console.log(`
            ${operation.id()}({ message }: { message: ${message.payload().type()} }): void {
              const payload = message.toJSON();
              const buffer = new ArrayBuffer(FTL_HEADER_SIZE);
              new DataView(buffer).setUint16(0, payload.length, LITTLE_ENDIAN);
              this._connection.send({ data: buffer });
              this._connection.send({ data: payload });
            }
            `);
                        break;

                    case "application/octet-stream":
                        console.log(`
            ${operation.id()}({ message }: { message: ${message.id()}): void {
              const payloadSize = 128;
              const buffer = new ArrayBuffer(FTL_HEADER_SIZE + payloadSize);
              this._writeMultiplexerHeader({
                buffer,
                channelId: ${operation.channels().at(0).extensions()[0].value()},
                size: payloadSize,
              });

              const writer = new DataView(buffer, FTL_HEADER_SIZE);
              message.toBinary(writer, message);

              this._connection.send({ data: buffer });
            }
            `);
                        break;
                }
            }
        }
    }
}
