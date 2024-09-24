import type { FrameMetaData, Mat4, Quat, UUID, Vec3 } from "@3dverse/livelink.core";
import { CameraFrameTransform } from "./CameraFrameTransform";
import { EntityRegistry } from "../EntityRegistry";
import { Camera } from "../Camera";

/**
 *
 */
export type RawFrameMetaData = {
    /**
     * Timestamp of the frame
     */
    renderer_timestamp: number;

    /**
     * Number of the frame, incremented for each frame
     */
    frame_counter: number;

    /**
     * Camera transforms of each client viewport in the frame
     */
    current_client_cameras: Array<CameraFrameTransform>;

    /**
     * Camera transforms of each other client viewport in the frame
     */
    other_clients_cameras: Array<CameraFrameTransform>;
};

/**
 *
 */
export function rawFrameMetaDatafromFrameMetaData({
    frame_meta_data,
    client_id,
    entity_registry,
}: {
    frame_meta_data: FrameMetaData;
    client_id: UUID;
    entity_registry: EntityRegistry;
}): RawFrameMetaData {
    const meta_data: RawFrameMetaData = {
        renderer_timestamp: frame_meta_data.renderer_timestamp,
        frame_counter: frame_meta_data.frame_counter,
        current_client_cameras: [],
        other_clients_cameras: [],
    };

    const current_client = frame_meta_data.clients.find(client => client.client_id === client_id);
    const other_clients = frame_meta_data.clients.filter(client => client.client_id !== client_id);

    for (const viewport of current_client?.viewports || []) {
        const camera = entity_registry.get({ entity_rtid: viewport.camera_rtid }) as Camera | null;
        if (!camera) {
            continue;
        }
        const cameraMetadata: CameraFrameTransform = {
            camera,
            position: getWorldPosition(viewport.ws_from_ls),
            orientation: getWorldQuaternion(viewport.ws_from_ls),
        };
        meta_data.current_client_cameras.push(cameraMetadata);
    }

    for (const client of other_clients) {
        for (const viewport of client.viewports) {
            const camera = entity_registry.get({ entity_rtid: viewport.camera_rtid }) as Camera | null;
            // Skip cameras which also belong to current client
            if (!camera || meta_data.current_client_cameras.some(c => c.camera.rtid === camera.rtid)) {
                continue;
            }
            const cameraMetadata: CameraFrameTransform = {
                camera,
                position: getWorldPosition(viewport.ws_from_ls),
                orientation: getWorldQuaternion(viewport.ws_from_ls),
            };
            meta_data.other_clients_cameras.push(cameraMetadata);
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
