import type { RawFrameMetaData, Mat4, Quat, UUID, Vec3 } from "@3dverse/livelink.core";
import { FrameCameraTransform } from "./FrameCameraTransform";
import { EntityRegistry } from "../../scene/EntityRegistry";
import { Viewport } from "../Viewport";

/**
 * @category Streaming
 */
export type FrameMetaData = {
    /**
     * Timestamp of the frame
     */
    renderer_timestamp: number;

    /**
     * Number of the frame, incremented for each frame
     */
    frame_counter: number;

    /**
     * @internal
     * Camera transforms of each client viewport in the frame
     */
    current_client_camera_entities: Array<FrameCameraTransform & { viewport: Viewport }>;

    /**
     * @internal
     * Camera transforms of each other client viewport in the frame
     */
    other_clients_camera_entities: Array<FrameCameraTransform>;
};

/**
 * @internal
 */
export function convertRawFrameMetaDataToFrameMetaData({
    raw_frame_meta_data,
    client_id,
    entity_registry,
    viewports,
}: {
    raw_frame_meta_data: RawFrameMetaData;
    client_id: UUID;
    entity_registry: EntityRegistry;
    viewports: Array<Viewport>;
}): FrameMetaData {
    const meta_data: FrameMetaData = {
        renderer_timestamp: raw_frame_meta_data.renderer_timestamp,
        frame_counter: raw_frame_meta_data.frame_counter,
        current_client_camera_entities: [],
        other_clients_camera_entities: [],
    };

    const other_clients = raw_frame_meta_data.clients.filter(client => client.client_id !== client_id);

    const current_client = raw_frame_meta_data.clients.find(client => client.client_id === client_id);
    for (const viewport_meta_data of current_client?.viewports || []) {
        const camera_entity = entity_registry.get({ entity_rtid: viewport_meta_data.camera_rtid });
        if (!camera_entity) {
            continue;
        }

        const viewport = viewports.find(v => v.camera_projection?.camera_entity.rtid === camera_entity.rtid);
        if (!viewport) {
            continue;
        }

        const cameraMetadata: FrameCameraTransform & { viewport: Viewport } = {
            camera_entity,
            viewport,
            world_from_view_matrix: viewport_meta_data.ws_from_ls,
            world_position: getWorldPosition(viewport_meta_data.ws_from_ls),
            world_orientation: getWorldQuaternion(viewport_meta_data.ws_from_ls),
        };
        meta_data.current_client_camera_entities.push(cameraMetadata);
    }

    for (const client_meta_data of other_clients) {
        for (const viewport_meta_data of client_meta_data.viewports) {
            const camera_entity = entity_registry.get({ entity_rtid: viewport_meta_data.camera_rtid });
            if (!camera_entity) {
                continue;
            }

            //TODO: This is a temporary solution, we need to find a better way to identify cameras
            //      that are controlled by the current client.
            // Skip cameras which also belong to current client
            if (meta_data.current_client_camera_entities.some(c => c.camera_entity.rtid === camera_entity.rtid)) {
                continue;
            }

            const cameraMetadata: FrameCameraTransform = {
                camera_entity,
                world_from_view_matrix: viewport_meta_data.ws_from_ls,
                world_position: getWorldPosition(viewport_meta_data.ws_from_ls),
                world_orientation: getWorldQuaternion(viewport_meta_data.ws_from_ls),
            };
            meta_data.other_clients_camera_entities.push(cameraMetadata);
        }
    }

    return meta_data;
}

/**
 *
 */
function getWorldPosition(worldMatrix: Mat4): Vec3 {
    return [worldMatrix[12], worldMatrix[13], worldMatrix[14]];
}

/**
 *
 */
function getWorldQuaternion(worldMatrix: Mat4): Quat {
    const quaternion = [0, 0, 0, 0];
    const m11 = worldMatrix[0];
    const m12 = worldMatrix[1];
    const m13 = worldMatrix[2];

    const m21 = worldMatrix[4];
    const m22 = worldMatrix[5];
    const m23 = worldMatrix[6];

    const m31 = worldMatrix[8];
    const m32 = worldMatrix[9];
    const m33 = worldMatrix[10];

    const trace = m11 + m22 + m33;

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1.0);
        quaternion[3] = 0.25 / s;
        quaternion[0] = (m23 - m32) * s;
        quaternion[1] = (m31 - m13) * s;
        quaternion[2] = (m12 - m21) * s;
    } else if (m11 > m22 && m11 > m33) {
        const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
        quaternion[3] = (m23 - m32) / s;
        quaternion[0] = 0.25 * s;
        quaternion[1] = (m12 + m21) / s;
        quaternion[2] = (m13 + m31) / s;
    } else if (m22 > m33) {
        const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
        quaternion[3] = (m31 - m13) / s;
        quaternion[0] = (m12 + m21) / s;
        quaternion[1] = 0.25 * s;
        quaternion[2] = (m23 + m32) / s;
    } else {
        const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
        quaternion[3] = (m12 - m21) / s;
        quaternion[0] = (m13 + m31) / s;
        quaternion[1] = (m23 + m32) / s;
        quaternion[2] = 0.25 * s;
    }

    return quaternion as Quat;
}
