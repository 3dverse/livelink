//------------------------------------------------------------------------------
import {
    PointerEventHandler,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import * as THREE from "three";

//------------------------------------------------------------------------------
import type {
    Entity,
    Vec3,
    Vec2,
    CameraProjection,
    Viewport as LiveliveViewport,
} from "@3dverse/livelink";
import {
    Livelink,
    Canvas,
    Viewport,
    CameraController,
    useCameraEntity,
    useEntity,
    DOM3DElement,
    DOM3DOverlay,
    ViewportContext,
} from "@3dverse/livelink-react";
import { ThreeOverlay } from "@3dverse/livelink-three/react";
import { LoadingOverlay } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { DisconnectedModal } from "../../components/SamplePlayer";

//------------------------------------------------------------------------------
const scene_id = "8f3c24c1-720e-4d2c-b0e7-f623e4feb7be";
const token = import.meta.env.VITE_PROD_PUBLIC_TOKEN;

//------------------------------------------------------------------------------
export default {
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    title: "Culling Box Geometry",
    summary:
        "Three.js overlay with a widget to resize a box geometry that culls scene objects.",
    element: <App />,
};

//------------------------------------------------------------------------------
function App() {
    return (
        <Livelink
            sceneId={scene_id}
            token={token}
            LoadingPanel={LoadingOverlay}
            ConnectionErrorPanel={DisconnectedModal}
        >
            <AppLayout />
        </Livelink>
    );
}

//------------------------------------------------------------------------------
function AppLayout() {
    const { cameraEntity } = useCameraEntity({
        position: [20, 20, 20],
        eulerOrientation: [-45, 45, 0],
    });

    return (
        <Canvas className="w-full h-full">
            <Viewport cameraEntity={cameraEntity} className="w-full h-full">
                <CameraController />
                <CullingBoxGeometryWidget initialSize={[20, 10, 20]} />
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
function CullingBoxGeometryWidget({
    initialSize = [1, 1, 1],
    initialPosition = [0, 0, 0],
}: {
    initialSize?: Vec3;
    initialPosition?: Vec3;
}) {
    const [isEnable, setEnableState] = useState(true);
    const scene = useMemo(() => new THREE.Scene(), []);

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

    return (
        <>
            <div className="absolute bottom-4 right-4">
                <button
                    className="button button-primary"
                    onClick={() => setEnableState(!isEnable)}
                >
                    {isEnable ? "Hide" : "Show"} Box Geometry
                </button>
            </div>

            <ThreeOverlay scene={scene} />
            {boxGeometryEntity && isEnable && (
                <BoxGeometryMesh
                    boxGeometryEntity={boxGeometryEntity}
                    scene={scene}
                />
            )}
            {boxGeometryEntity && isEnable && (
                <DOM3DOverlay>
                    <BoxGeometryHandles boxGeometryEntity={boxGeometryEntity} />
                </DOM3DOverlay>
            )}
        </>
    );
}

//------------------------------------------------------------------------------
function BoxGeometryMesh({
    boxGeometryEntity,
    scene,
    boxColor = 0xffff00,
    opacity = 0.5,
    edgeColor = 0x000000,
}: {
    boxGeometryEntity: Entity;
    scene: THREE.Scene;
    boxColor?: THREE.ColorRepresentation;
    opacity?: number;
    edgeColor?: THREE.ColorRepresentation;
}) {
    useEffect(() => {
        if (
            !boxGeometryEntity.box_geometry ||
            !boxGeometryEntity.local_transform
        ) {
            console.warn(
                "BoxGeometryMesh: box_geometry or local_transform component not found.",
            );
            return;
        }

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: boxColor,
            opacity,
            transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);

        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: edgeColor });
        const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        mesh.add(edges);

        // Object that represents the box geometry component's dimension attributes
        const dimensionObject = new THREE.Object3D();
        dimensionObject.add(mesh);

        // Object that represents the box geometry global transform
        const globalTransformObject = new THREE.Object3D();
        globalTransformObject.add(dimensionObject);

        scene.add(globalTransformObject);

        const updateObjectsTransform = () => {
            const globalTransform = boxGeometryEntity.global_transform;
            globalTransformObject.position.fromArray(globalTransform.position);
            globalTransformObject.quaternion.fromArray(
                globalTransform.orientation,
            );
            globalTransformObject.scale.fromArray(globalTransform.scale);
            globalTransformObject.updateMatrixWorld();

            const boxGeometry = boxGeometryEntity.box_geometry!;
            dimensionObject.position.fromArray(boxGeometry.offset);
            dimensionObject.scale.fromArray(boxGeometry.dimension);
            dimensionObject.updateMatrixWorld();
        };

        boxGeometryEntity.addEventListener(
            "on-entity-updated",
            updateObjectsTransform,
        );
        updateObjectsTransform();

        return () => {
            scene.remove(globalTransformObject);
            boxGeometryEntity.removeEventListener(
                "on-entity-updated",
                updateObjectsTransform,
            );
        };
    }, [boxGeometryEntity, scene, edgeColor]);

    return null;
}

//------------------------------------------------------------------------------
type GeometryHandle = {
    worldPosition: Vec3;
    onPointerDown: PointerEventHandler;
};
const geometryHandlesAxes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
] as const;

//------------------------------------------------------------------------------
function BoxGeometryHandles({
    boxGeometryEntity,
}: {
    boxGeometryEntity: Entity;
}) {
    const [geometryHandles, setGeometryHandles] = useState<GeometryHandle[]>(
        [],
    );
    const { viewport, viewportDomElement } = useContext(ViewportContext);

    useEffect(() => {
        if (
            !boxGeometryEntity.box_geometry ||
            !boxGeometryEntity.local_transform
        ) {
            console.warn(
                "BoxGeometryHandles: box_geometry or local_transform component not found.",
            );
            return;
        }

        if (!viewport || !viewportDomElement) {
            console.warn(
                "BoxGeometryHandles: should be mounted inside a valid Viewport component.",
            );
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
            boxGeometryEntity.removeEventListener(
                "on-entity-updated",
                updateHandles,
            );
        };
    }, [boxGeometryEntity, viewport, viewportDomElement]);

    return geometryHandles.map((handle, index) => (
        <DOM3DElement worldPosition={handle.worldPosition} key={index}>
            <div
                className="bg-[white] border border-[black] p-2 rounded-xl cursor-grab"
                onPointerDown={handle.onPointerDown}
            />
        </DOM3DElement>
    ));
}

//------------------------------------------------------------------------------
function createBoxGeometryHandle({
    axis,
    boxGeometryEntity,
    viewport,
}: {
    axis: THREE.Vector3;
    boxGeometryEntity: Entity;
    viewport: LiveliveViewport;
}): GeometryHandle {
    //--------------------------------------------------------------------------
    const ray = new THREE.Ray();
    const plane = new THREE.Plane();
    const intersection = new THREE.Vector3();

    //--------------------------------------------------------------------------
    const absAxis = new THREE.Vector3(
        Math.abs(axis.x),
        Math.abs(axis.y),
        Math.abs(axis.z),
    );
    const nullifyAxis = new THREE.Vector3(
        1 - absAxis.x,
        1 - absAxis.y,
        1 - absAxis.z,
    );

    //--------------------------------------------------------------------------
    const boxGeometry = boxGeometryEntity.box_geometry!;
    const dimensions = new THREE.Vector3().fromArray(boxGeometry.dimension);
    const offset = new THREE.Vector3().fromArray(boxGeometry.offset);

    //--------------------------------------------------------------------------
    const maxOffset = offset.clone().addScaledVector(dimensions, 0.5);
    const minOffset = offset.clone().addScaledVector(dimensions, -0.5);

    //--------------------------------------------------------------------------
    const { local_from_world, world_position } = computeWorldComponents();

    //--------------------------------------------------------------------------
    const onPointerDown: PointerEventHandler = (
        event: React.PointerEvent<Element>,
    ) => {
        event.stopPropagation();

        //----------------------------------------------------------------------
        const camera_projection =
            viewport.camera_projection as CameraProjection;
        if (!camera_projection) {
            console.warn(
                "BoxGeometryHandles: viewport should have a valid camera_projection.",
            );
            return;
        }

        //----------------------------------------------------------------------
        const cameraDirection = new THREE.Vector3(
            0.0,
            0.0,
            1.0,
        ).applyQuaternion(
            new THREE.Quaternion().fromArray(
                camera_projection.world_orientation,
            ),
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
        local_from_world: THREE.Matrix4;
        world_position: THREE.Vector3;
    } {
        const globalTransform = boxGeometryEntity.global_transform;

        const world_position = new THREE.Vector3().fromArray(
            globalTransform.position,
        );
        const world_orientation = new THREE.Quaternion().fromArray(
            globalTransform.orientation,
        );
        const world_scale = new THREE.Vector3().fromArray(
            globalTransform.scale,
        );

        const local_from_world = new THREE.Matrix4()
            .compose(world_position, world_orientation, world_scale)
            .invert();

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
        ray: THREE.Ray;
        viewport: LiveliveViewport;
        camera_projection: CameraProjection;
    }) {
        const screen_position: Vec2 = viewport.getScreenPositionFromEvent({
            event,
        });

        const { origin, direction } =
            camera_projection.computeRayFromScreenPosition({
                screen_position,
            });

        ray.origin.fromArray(origin);
        ray.direction.fromArray(direction);
    }

    //--------------------------------------------------------------------------
    function transformBoxGeometry({
        intersection,
    }: {
        intersection: THREE.Vector3;
    }) {
        const intersectionInLocalSpace = intersection
            .clone()
            .applyMatrix4(local_from_world)
            .sub(offset);

        const radius = intersectionInLocalSpace.dot(axis);

        const radiusVector = dimensions
            .clone()
            .multiply(nullifyAxis)
            .addScaledVector(absAxis, radius * 2);

        const dimensionOffset = new THREE.Vector3()
            .subVectors(radiusVector, dimensions)
            .multiplyScalar(0.5);

        const newDimension = dimensions.clone().add(dimensionOffset);
        const newOffset = offset
            .clone()
            .addScaledVector(dimensionOffset.multiply(axis), 0.5);

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
