//------------------------------------------------------------------------------
import React, { createContext, PointerEventHandler, useContext, useEffect, useMemo, useState } from "react";
import {
    BoxGeometry,
    ColorRepresentation,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Plane,
    Quaternion,
    Ray,
    Scene,
    Vector3,
} from "three";

//------------------------------------------------------------------------------
import type { Entity, Vec3, Vec2, CameraProjection, Viewport as LiveliveViewport } from "@3dverse/livelink";
import { useEntity, DOM3DElement, DOM3DOverlay, ViewportContext } from "@3dverse/livelink-react";
import { ThreeOverlay, ThreeOverlayContext } from ".";

//------------------------------------------------------------------------------
type CullingBoxGeometryContextType = {
    isActive: boolean;
    toggle: () => void;
};

//------------------------------------------------------------------------------
const CullingBoxGeometryContext = createContext<CullingBoxGeometryContextType | null>(null);

//------------------------------------------------------------------------------
export const useCullingBoxGeometry = () => {
    const ctx = useContext(CullingBoxGeometryContext);
    if (!ctx) throw new Error("useCullingBoxGeometry must be used within <CullingBoxGeometry>");
    return ctx;
};

//------------------------------------------------------------------------------
const geometryHandleStyle: React.CSSProperties = {
    backgroundColor: "white",
    border: "1px solid black",
    width: "1rem",
    height: "1rem",
    borderRadius: "100%",
    cursor: "grab",
};

//------------------------------------------------------------------------------
export const CullingBoxGeometry = ({
    initialSize = [1, 1, 1],
    initialPosition = [0, 0, 0],
    isActiveByDefault = true,
    boxColor = "#ffff00",
    opacity = 0.2,
    edgeColor = "#000000",
    children,
    scene: propsScene,
}: {
    initialSize?: Vec3;
    initialPosition?: Vec3;
    isActiveByDefault?: boolean;
    boxColor?: ColorRepresentation;
    opacity?: number;
    edgeColor?: ColorRepresentation;
    children?: React.ReactNode;
    scene?: Scene;
}) => {
    const [isEnable, setEnableState] = useState(isActiveByDefault);
    const { scene: contextScene } = useContext(ThreeOverlayContext);
    const scene = useMemo(() => propsScene ?? contextScene ?? new Scene(), [propsScene, contextScene]);

    const { entity: boxGeometryEntity } = useEntity(
        {
            name: "Box Geometry",
            components: {
                local_transform: { position: initialPosition },
                box_geometry: { dimension: initialSize },
                culling_geometry: {},
            },
            options: { delete_on_client_disconnection: true },
        },
        ["local_transform", "box_geometry"],
    );

    const toggle = () => setEnableState(!isEnable);

    return (
        <CullingBoxGeometryContext.Provider value={{ isActive: isEnable, toggle }}>
            {
                /** Only render ThreeOverlay if no scene is provided via props or context */
                !propsScene && !contextScene && <ThreeOverlay scene={scene} />
            }
            {boxGeometryEntity && isEnable && (
                <BoxGeometryMesh
                    boxGeometryEntity={boxGeometryEntity}
                    scene={scene}
                    boxColor={boxColor}
                    opacity={opacity}
                    edgeColor={edgeColor}
                />
            )}
            {boxGeometryEntity && isEnable && (
                <DOM3DOverlay>
                    <BoxGeometryHandles boxGeometryEntity={boxGeometryEntity} />
                </DOM3DOverlay>
            )}
            {children}
        </CullingBoxGeometryContext.Provider>
    );
};

//------------------------------------------------------------------------------
function BoxGeometryMesh({
    boxGeometryEntity,
    scene,
    boxColor,
    opacity,
    edgeColor,
}: {
    boxGeometryEntity: Entity;
    scene: Scene;
    boxColor?: ColorRepresentation;
    opacity?: number;
    edgeColor?: ColorRepresentation;
}) {
    useEffect(() => {
        if (!boxGeometryEntity.box_geometry || !boxGeometryEntity.local_transform) {
            console.warn("BoxGeometryMesh: box_geometry or local_transform component not found.");
            return;
        }

        const geometry = new BoxGeometry(1, 1, 1);
        const material = new MeshBasicMaterial({
            color: boxColor,
            opacity,
            transparent: true,
        });
        const mesh = new Mesh(geometry, material);

        const edgeGeometry = new EdgesGeometry(geometry);
        const edgeMaterial = new LineBasicMaterial({ color: edgeColor });
        const edges = new LineSegments(edgeGeometry, edgeMaterial);
        mesh.add(edges);

        // Object that represents the box geometry component's dimension attributes
        const dimensionObject = new Object3D();
        dimensionObject.add(mesh);

        // Object that represents the box geometry global transform
        const globalTransformObject = new Object3D();
        globalTransformObject.add(dimensionObject);

        scene.add(globalTransformObject);

        const updateObjectsTransform = () => {
            const globalTransform = boxGeometryEntity.global_transform;
            globalTransformObject.position.fromArray(globalTransform.position);
            globalTransformObject.quaternion.fromArray(globalTransform.orientation);
            globalTransformObject.scale.fromArray(globalTransform.scale);
            globalTransformObject.updateMatrixWorld();

            const boxGeometry = boxGeometryEntity.box_geometry!;
            dimensionObject.position.fromArray(boxGeometry.offset);
            dimensionObject.scale.fromArray(boxGeometry.dimension);
            dimensionObject.updateMatrixWorld();
        };

        boxGeometryEntity.addEventListener("on-entity-updated", updateObjectsTransform);
        updateObjectsTransform();

        return () => {
            scene.remove(globalTransformObject);
            boxGeometryEntity.removeEventListener("on-entity-updated", updateObjectsTransform);
        };
    }, [boxGeometryEntity, scene, edgeColor, boxColor, opacity]);

    return null;
}

//------------------------------------------------------------------------------
type GeometryHandle = {
    worldPosition: Vec3;
    onPointerDown: PointerEventHandler;
};
const geometryHandlesAxes = [
    new Vector3(1, 0, 0),
    new Vector3(-1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, -1),
] as const;

//------------------------------------------------------------------------------
function BoxGeometryHandles({ boxGeometryEntity }: { boxGeometryEntity: Entity }) {
    const [geometryHandles, setGeometryHandles] = useState<GeometryHandle[]>([]);
    const { viewport, viewportDomElement } = useContext(ViewportContext);

    useEffect(() => {
        if (!boxGeometryEntity.box_geometry || !boxGeometryEntity.local_transform) {
            console.warn("BoxGeometryHandles: box_geometry or local_transform component not found.");
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

    return geometryHandles.map((handle, index) => (
        <DOM3DElement worldPosition={handle.worldPosition} key={index}>
            <div style={geometryHandleStyle} onPointerDown={handle.onPointerDown} />
        </DOM3DElement>
    ));
}

//------------------------------------------------------------------------------
function createBoxGeometryHandle({
    axis,
    boxGeometryEntity,
    viewport,
}: {
    axis: Vector3;
    boxGeometryEntity: Entity;
    viewport: LiveliveViewport;
}): GeometryHandle {
    //--------------------------------------------------------------------------
    const ray = new Ray();
    const plane = new Plane();
    const intersection = new Vector3();

    //--------------------------------------------------------------------------
    const absAxis = new Vector3(Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z));
    const nullifyAxis = new Vector3(1 - absAxis.x, 1 - absAxis.y, 1 - absAxis.z);

    //--------------------------------------------------------------------------
    const boxGeometry = boxGeometryEntity.box_geometry!;
    const dimensions = new Vector3().fromArray(boxGeometry.dimension);
    const offset = new Vector3().fromArray(boxGeometry.offset);

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
        const cameraDirection = new Vector3(0.0, 0.0, 1.0).applyQuaternion(
            new Quaternion().fromArray(camera_projection.world_orientation),
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
        local_from_world: Matrix4;
        world_position: Vector3;
    } {
        const globalTransform = boxGeometryEntity.global_transform;

        const world_position = new Vector3().fromArray(globalTransform.position);
        const world_orientation = new Quaternion().fromArray(globalTransform.orientation);
        const world_scale = new Vector3().fromArray(globalTransform.scale);

        const local_from_world = new Matrix4().compose(world_position, world_orientation, world_scale).invert();

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
        ray: Ray;
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
    function transformBoxGeometry({ intersection }: { intersection: Vector3 }) {
        const intersectionInLocalSpace = intersection.clone().applyMatrix4(local_from_world).sub(offset);

        const radius = intersectionInLocalSpace.dot(axis);

        const radiusVector = dimensions
            .clone()
            .multiply(nullifyAxis)
            .addScaledVector(absAxis, radius * 2);

        const dimensionOffset = new Vector3().subVectors(radiusVector, dimensions).multiplyScalar(0.5);

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

//------------------------------------------------------------------------------
export const CullingBoxGeometryButton = ({
    children,
}: {
    children: React.ReactNode | ((props: { isActive: boolean; toggle: () => void }) => React.ReactNode);
}) => {
    const { isActive, toggle } = useCullingBoxGeometry();

    if (typeof children === "function") {
        return <>{children({ isActive, toggle })}</>;
    }

    if (React.isValidElement(children)) {
        const element = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void; isActive?: boolean }>;
        return React.cloneElement(element, {
            onClick: (e: React.MouseEvent) => {
                toggle();
                if (element.props.onClick) {
                    element.props.onClick(e);
                }
            },
            isActive,
        });
    }

    return <>{children}</>;
};
