import { UUID } from "../../sources/types";

/**
 *
 */
type Client = {
  clientUUID: UUID;
  directSelection?: boolean;
  color?: string;
  isExternal?: boolean;
};

/**
 *
 */
export type EditorEntity = {
  rtid: string;
  components: Record<string, {}>; //ComponentMap;
  children: string[];
  selectingClients: Client[];
  selectedDescendants: Record<string, Client[]>;
  isVisible: boolean;
  isRuntime: boolean;
  isExternal: boolean;
  isTransient: boolean;
  ancestors?: EditorEntity[];
};
