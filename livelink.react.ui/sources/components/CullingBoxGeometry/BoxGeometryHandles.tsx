//------------------------------------------------------------------------------
import React, { PointerEventHandler, useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { Entity, Vec3, Vec2, CameraProjection, Viewport as LiveliveViewport } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { Maths } from "@3dverse/livelink";
import { DOM3DAnchor, ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import styles from "./style.module.css";

//------------------------------------------------------------------------------
type GeometryHandle = {
    worldPosition: Vec3;
    onPointerDown: PointerEventHandler;
};

//------------------------------------------------------------------------------
const geometryHandlesAxes = [
    new Maths.Vector3(1, 0, 0),
    new Maths.Vector3(-1, 0, 0),
    new Maths.Vector3(0, 1, 0),
    new Maths.Vector3(0, -1, 0),
    new Maths.Vector3(0, 0, 1),
    new Maths.Vector3(0, 0, -1),
] as const;

//------------------------------------------------------------------------------
export function BoxGeometryHandles({ boxGeometryEntity, edgeColor }: { boxGeometryEntity: Entity; edgeColor: string }) {
    const [geometryHandles, setGeometryHandles] = useState<GeometryHandle[]>([]);
    const { viewport, viewportDomElement } = useContext(ViewportContext);
    const [handleDepths, setHandleDepths] = useState<[number, number, number, number, number, number]>([
        0, 0, 0, 0, 0, 0,
    ]);

    useEffect(() => {
        if (!boxGeometryEntity.box_geometry) {
            console.warn("BoxGeometryHandles: box_geometry component not found.");
            return;
        }

        if (!viewport || !viewportDomElement) {
            console.warn("BoxGeometryHandles: should be mounted inside a valid Viewport component.");
            return;
        }

        const updateHandles = () => {
            setGeometryHandles(
                geometryHandlesAxes.map(axis =>
                    createBoxGeometryHandle({
                        axis,
                        boxGeometryEntity,
                        viewport,
                    }),
                ),
            );
        };

        boxGeometryEntity.addEventListener("on-entity-updated", updateHandles);
        updateHandles();

        return () => {
            boxGeometryEntity.removeEventListener("on-entity-updated", updateHandles);
        };
    }, [boxGeometryEntity, viewport, viewportDomElement]);

    return geometryHandles.map((handle, index) => {
        const oppositeHandleIndex = index % 2 === 0 ? index + 1 : index - 1;
        const handleDepth = handleDepths[index];
        const oppositeHandleDepth = handleDepths[oppositeHandleIndex];
        const isBehindTheOtherHandle = handleDepth > oppositeHandleDepth;

        return (
            <DOM3DAnchor
                id={`handle-${index}`}
                key={index}
                worldPosition={handle.worldPosition}
                className={styles.handle}
                style={{
                    border: `1px solid color-mix(in srgb, ${edgeColor}, transparent 50%)`,
                    opacity: isBehindTheOtherHandle ? 0.25 : 1.0,
                }}
                onPointerDown={handle.onPointerDown}
                onProjectionChange={projection => {
                    setHandleDepths(prev => {
                        const newPositions = [...prev] as [number, number, number, number, number, number];
                        newPositions[index] = projection.screen_position[2];
                        return newPositions;
                    });
                }}
            />
        );
    });
}

//------------------------------------------------------------------------------
function createBoxGeometryHandle({
    axis,
    boxGeometryEntity,
    viewport,
}: {
    axis: Maths.Vector3;
    boxGeometryEntity: Entity;
    viewport: LiveliveViewport;
}): GeometryHandle {
    //--------------------------------------------------------------------------
    const ray = new Maths.Ray();
    const plane = new Maths.Plane();
    const intersection = new Maths.Vector3();

    //--------------------------------------------------------------------------
    const absAxis = new Maths.Vector3(Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z));
    const nullifyAxis = new Maths.Vector3(1 - absAxis.x, 1 - absAxis.y, 1 - absAxis.z);

    //--------------------------------------------------------------------------
    const boxGeometry = boxGeometryEntity.box_geometry!;
    const dimensions = new Maths.Vector3().fromArray(boxGeometry.dimension);
    const offset = new Maths.Vector3().fromArray(boxGeometry.offset);

    //--------------------------------------------------------------------------
    const maxOffset = offset.clone().addScaledVector(dimensions, 0.5);
    const minOffset = offset.clone().addScaledVector(dimensions, -0.5);

    //--------------------------------------------------------------------------
    const { local_from_world, world_position } = computeWorldComponents();

    //--------------------------------------------------------------------------
    const onPointerDown: PointerEventHandler = (event: React.PointerEvent<Element>) => {
        event.stopPropagation();

        //----------------------------------------------------------------------
        const camera_projection = viewport.camera_projection as CameraProjection;
        if (!camera_projection) {
            console.warn("BoxGeometryHandles: viewport should have a valid camera_projection.");
            return;
        }

        //----------------------------------------------------------------------
        const cameraDirection = new Maths.Vector3(0.0, 0.0, 1.0).applyQuaternion(
            new Maths.Quaternion().fromArray(camera_projection.world_orientation),
        );
        plane.setFromNormalAndCoplanarPoint(cameraDirection, world_position);

        //----------------------------------------------------------------------
        const pointerMove = (event: PointerEvent) => {
            event.stopPropagation();

            computeRayFromPointerEvent({
                event,
                ray,
                viewport,
                camera_projection,
            });

            if (ray.intersectPlane(plane, intersection)) {
                transformBoxGeometry({ intersection });
            }
        };

        //----------------------------------------------------------------------
        document.addEventListener("pointermove", pointerMove);
        document.addEventListener("pointerup", () => {
            document.removeEventListener("pointermove", pointerMove);
        });
    };

    //--------------------------------------------------------------------------
    function computeWorldComponents(): {
        local_from_world: Maths.Matrix4;
        world_position: Maths.Vector3;
    } {
        const globalTransform = boxGeometryEntity.global_transform;

        const world_position = new Maths.Vector3().fromArray(globalTransform.position);
        const world_orientation = new Maths.Quaternion().fromArray(globalTransform.orientation);
        const world_scale = new Maths.Vector3().fromArray(globalTransform.scale);

        const local_from_world = new Maths.Matrix4().compose(world_position, world_orientation, world_scale).invert();

        world_position.add(
            axis
                .clone()
                .multiplyScalar(0.5)
                .multiply(dimensions)
                .add(offset)
                .multiply(world_scale)
                .applyQuaternion(world_orientation),
        );

        return { local_from_world, world_position };
    }

    //--------------------------------------------------------------------------
    function computeRayFromPointerEvent({
        event,
        ray,
        viewport,
        camera_projection,
    }: {
        event: PointerEvent;
        ray: Maths.Ray;
        viewport: LiveliveViewport;
        camera_projection: CameraProjection;
    }) {
        const screen_position: Vec2 = viewport.getScreenPositionFromEvent({
            event,
        });

        const { origin, direction } = camera_projection.computeRayFromScreenPosition({
            screen_position,
        });

        ray.origin.fromArray(origin);
        ray.direction.fromArray(direction);
    }

    //--------------------------------------------------------------------------
    function transformBoxGeometry({ intersection }: { intersection: Maths.Vector3 }) {
        const intersectionInLocalSpace = intersection.clone().applyMatrix4(local_from_world).sub(offset);

        const radius = intersectionInLocalSpace.dot(axis);

        const radiusVector = dimensions
            .clone()
            .multiply(nullifyAxis)
            .addScaledVector(absAxis, radius * 2);

        const dimensionOffset = new Maths.Vector3().subVectors(radiusVector, dimensions).multiplyScalar(0.5);

        const newDimension = dimensions.clone().add(dimensionOffset);
        const newOffset = offset.clone().addScaledVector(dimensionOffset.multiply(axis), 0.5);

        boxGeometry.dimension[0] = Math.max(0.0, newDimension.x);
        boxGeometry.dimension[1] = Math.max(0.0, newDimension.y);
        boxGeometry.dimension[2] = Math.max(0.0, newDimension.z);

        if (axis.x < 0) {
            boxGeometry.offset[0] = Math.min(maxOffset.x, newOffset.x);
        } else if (axis.y < 0) {
            boxGeometry.offset[1] = Math.min(maxOffset.y, newOffset.y);
        } else if (axis.z < 0) {
            boxGeometry.offset[2] = Math.min(maxOffset.z, newOffset.z);
        } else if (axis.x > 0) {
            boxGeometry.offset[0] = Math.max(minOffset.x, newOffset.x);
        } else if (axis.y > 0) {
            boxGeometry.offset[1] = Math.max(minOffset.y, newOffset.y);
        } else if (axis.z > 0) {
            boxGeometry.offset[2] = Math.max(minOffset.z, newOffset.z);
        }
    }

    //------------------------------------------------------------------------------
    return {
        worldPosition: world_position.toArray(),
        onPointerDown,
    };
}
