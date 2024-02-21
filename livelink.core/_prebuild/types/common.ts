import { BIG_ENDIAN, LITTLE_ENDIAN } from "../constants";

/**
 *
 */
export type RTID = bigint;
/**
 *
 */
export function serialize_RTID({
  dataView,
  offset,
  rtid,
}: {
  dataView: DataView;
  offset: number;
  rtid: RTID;
}): number {
  //TODO: change me when we support 64bits RTIDs
  dataView.setUint32(offset, Number(rtid), LITTLE_ENDIAN);
  return 4;
}
/**
 *
 */
export function deserialize_RTID({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): RTID {
  return BigInt(dataView.getUint32(offset, LITTLE_ENDIAN));
}

/**
 *
 */
export type UUID = string;
/**
 *
 */
export function serialize_UUID({
  dataView,
  offset,
  uuid,
}: {
  dataView: DataView;
  offset: number;
  uuid: UUID;
}): number {
  //TODO
  return 16;
}

/**
 *
 */
const byteToHex: string[] = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}
export function deserialize_UUID({
  dataView,
  offset,
}: {
  dataView: DataView;
  offset: number;
}): UUID {
  const arr = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, 16);

  dataView.setUint32(
    offset + 0,
    dataView.getUint32(offset + 0, LITTLE_ENDIAN),
    BIG_ENDIAN
  );
  dataView.setUint16(
    offset + 4,
    dataView.getUint16(offset + 4, LITTLE_ENDIAN),
    BIG_ENDIAN
  );
  dataView.setUint16(
    offset + 6,
    dataView.getUint16(offset + 6, LITTLE_ENDIAN),
    BIG_ENDIAN
  );

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

export type Component = {};
export type Components = Map<string, Component>;

export type ClientInfo = {
  client_id: UUID;
  client_type: "user" | "guest";
  user_id: UUID;
  username: string;
};

export type SessionInfo = {
  session_id: UUID;
  scene_id: UUID;
  scene_name: string;
  folder_id: UUID;
  max_users: number;
  creator_user_id: UUID;
  created_at: Date;
  country_code: string;
  continent_code: string;
  clients: Array<ClientInfo>;
};
