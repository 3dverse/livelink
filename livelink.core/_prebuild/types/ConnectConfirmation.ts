import { UUID } from "../../sources/types";

/**
 *
 */
export type SceneStats = {
  readonly triangleCount: number;
  readonly totalTriangleCount: number;
  readonly entityCount: number;
};

/**
 *
 */
export type AttributeDescriptor = {
  readonly type: string;
  readonly name: string;
  readonly mods: Array<"editor-only" | "engine-only" | "transient">;
};

/**
 *
 */
export type ComponentDescriptor = {
  readonly attributes: Array<AttributeDescriptor>;
  readonly binarySupport: boolean;
  readonly description: string;
  readonly dynamicSize: boolean;
  readonly hash: number;
  readonly mods: Array<"editor-only" | "engine-only" | "transient">;
  readonly name: string;
  readonly size: number;
};

/**
 *
 */
export type ConnectConfirmation = {
  readonly animationSequenceInstances: [];
  readonly canEdit: boolean;
  readonly clientColors: {};
  readonly clientRTID: {};
  readonly components: Record<string, ComponentDescriptor>;
  readonly isTransient: boolean;
  readonly rootNodes: {};
  readonly sceneUUID: UUID;
  readonly selectColor: string;
  readonly sessionUUID: UUID;
  readonly settingDescriptions: {};
  readonly settings: {};
  readonly stats: SceneStats;
  readonly undoRedo: { undo: {}; redo: {} };
  readonly userUUID: UUID;
  readonly workspaceUUID: UUID;
};
