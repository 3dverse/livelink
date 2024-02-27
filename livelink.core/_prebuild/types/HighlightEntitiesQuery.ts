import { RTID, serialize_RTID } from "../../sources";

/**
 *
 */
export type HighlightEntitiesQuery = {
  entities: Array<RTID>;
  keep_old_selection: boolean;
};

/**
 *
 */
export function serialize_HighlightEntitiesQuery({
  dataView,
  offset,
  highlightEntitiesQuery,
}: {
  dataView: DataView;
  offset: number;
  highlightEntitiesQuery: HighlightEntitiesQuery;
}): number {
  dataView.setUint8(offset, highlightEntitiesQuery.keep_old_selection ? 1 : 0);
  offset += 1;
  for (const rtid of highlightEntitiesQuery.entities) {
    offset += serialize_RTID({ dataView, offset, rtid });
  }
  return 1 + highlightEntitiesQuery.entities.length;
}
