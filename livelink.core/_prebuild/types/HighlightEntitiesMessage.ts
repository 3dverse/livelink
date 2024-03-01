import { RTID, serialize_RTID } from "../../sources";

/**
 *
 */
export type HighlightEntitiesMessage = {
  entities: Array<RTID>;
  keep_old_selection: boolean;
};

/**
 *
 */
export function serialize_HighlightEntitiesMessage({
  dataView,
  offset,
  highlightEntitiesMessage,
}: {
  dataView: DataView;
  offset: number;
  highlightEntitiesMessage: HighlightEntitiesMessage;
}): number {
  dataView.setUint8(
    offset,
    highlightEntitiesMessage.keep_old_selection ? 1 : 0
  );
  offset += 1;
  for (const rtid of highlightEntitiesMessage.entities) {
    offset += serialize_RTID({ dataView, offset, rtid });
  }
  return 1 + highlightEntitiesMessage.entities.length;
}
