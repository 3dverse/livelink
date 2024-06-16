import { BIG_ENDIAN, LITTLE_ENDIAN } from "./constants";

/**
 *
 */
export type UUID = string;

/**
 *
 */
export const UUID_BYTE_SIZE = 16 as const;

/**
 *
 */
export function serialize_UUID({
    data_view,
    offset,
    uuid,
}: {
    data_view: DataView;
    offset: number;
    uuid: UUID;
}): number {
    const hexToByte = (hexOctet: string) => parseInt(hexOctet, 16);
    const hexStringToBytes = (hexString: string) =>
        new DataView(
            new Uint8Array(
                hexString
                    .replace(/[^0-9a-f]/gi, "")
                    .match(/[0-9a-f]{1,2}/gi)
                    ?.map(hexToByte) ?? [],
            ).buffer,
        );

    const b = hexStringToBytes(uuid);
    data_view.setUint32(offset + 0, b.getUint32(0, BIG_ENDIAN), LITTLE_ENDIAN);
    data_view.setUint16(offset + 4, b.getUint16(4, BIG_ENDIAN), LITTLE_ENDIAN);
    data_view.setUint16(offset + 6, b.getUint16(6, BIG_ENDIAN), LITTLE_ENDIAN);
    for (let i = 8; i < 16; ++i) {
        data_view.setUint8(offset + i, b.getUint8(i));
    }

    return UUID_BYTE_SIZE;
}

/**
 *
 */
const byteToHex: string[] = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}

/**
 *
 */
export function deserialize_UUID({ data_view, offset }: { data_view: DataView; offset: number }): UUID {
    const arr = new Uint8Array(data_view.buffer, data_view.byteOffset + offset, 16);

    data_view.setUint32(offset + 0, data_view.getUint32(offset + 0, LITTLE_ENDIAN), BIG_ENDIAN);
    data_view.setUint16(offset + 4, data_view.getUint16(offset + 4, LITTLE_ENDIAN), BIG_ENDIAN);
    data_view.setUint16(offset + 6, data_view.getUint16(offset + 6, LITTLE_ENDIAN), BIG_ENDIAN);

    return (
        byteToHex[arr[0]] +
        byteToHex[arr[1]] +
        byteToHex[arr[2]] +
        byteToHex[arr[3]] +
        "-" +
        byteToHex[arr[4]] +
        byteToHex[arr[5]] +
        "-" +
        byteToHex[arr[6]] +
        byteToHex[arr[7]] +
        "-" +
        byteToHex[arr[8]] +
        byteToHex[arr[9]] +
        "-" +
        byteToHex[arr[10]] +
        byteToHex[arr[11]] +
        byteToHex[arr[12]] +
        byteToHex[arr[13]] +
        byteToHex[arr[14]] +
        byteToHex[arr[15]]
    );
}
