import type { UUID } from "../../../sources/types";

/**
 *
 */
type ClientSelection = {
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
    selectingClients: ClientSelection[];
    selectedDescendants: Record<string, ClientSelection[]>;
    isVisible: boolean;
    isRuntime: boolean;
    isExternal: boolean;
    isTransient: boolean;
    ancestors?: EditorEntity[];
};
