//------------------------------------------------------------------------------
import { useRef, useState, useEffect } from "react";
import Canvas from "../../components/Canvas";
import { CanvasActionBar } from "../../styles/components/CanvasActionBar";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { useLivelinkInstance, useEntity } from "@3dverse/livelink-react";
import { Entity, Livelink, Quat } from "@3dverse/livelink";
import { Animation } from "./animations/skeletal_animation_types.ts";
import { droid_idle } from "./animations/droid_idle.ts";
import { droid_walk } from "./animations/droid_walk.ts";
import { droid_tpose } from "./animations/droid_tpose.ts";
import { joint_parents } from "./animations/droid_skeleton.ts";

//------------------------------------------------------------------------------
let joints: Array<THREE.Object3D> | undefined = undefined;
let jointGizmo: TransformControls | undefined = undefined;

//------------------------------------------------------------------------------
export default function LiveSkeletalAnimation() {
    const threeJSCanvasRef = useRef<HTMLCanvasElement>(null);
    const livelinkCanvasRef = useRef<HTMLCanvasElement>(null);
    const [animation, setAnimation] = useState<string | null>(null);

    const { instance, connect, disconnect } = useLivelinkInstance({
        views: [{ canvas_ref: livelinkCanvasRef }],
    });

    const toggleConnection = async () => {
        if (instance) {
            disconnect();
        } else if (livelinkCanvasRef.current) {
            connect({
                scene_id: "d63131bc-86f0-4fd4-afe5-3c52d4e38947",
                token: "public_mpijUG4uJBZNH3Hl",
            });
        }
    };

    const controller = useEntity({ instance, entity_uuid: "677ae420-f914-4604-a95b-494b2e78c94c" });

    useEffect(() => {
        const { renderer, scene, camera } = setUpThreeJsSkeleton(threeJSCanvasRef.current!);

        function onWindowResize() {
            // TODO: fixme
            const width = threeJSCanvasRef.current!.offsetWidth;
            const height = threeJSCanvasRef.current!.offsetHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
        window.addEventListener("resize", onWindowResize);

        return () => {
            window.removeEventListener("resize", onWindowResize);
            cleanUpThreeJs(renderer, scene);
        };
    }, []);

    useEffect(() => {
        if (!instance || !controller) {
            return;
        }

        jointGizmo!.addEventListener("rotationAngle-changed", e => {
            const joint = e.target.object!;
            const jointIndex = parseInt(joint.name);
            const pose = new Map().set(jointIndex, joint.quaternion.toArray());
            instance.sendSkeletonPose({ controller, pose });
        });
    }, [instance, controller]);

    useEffect(() => {
        if (!animation) {
            return;
        }

        if (animation === "user-controlled") {
            handleUserControlledSkeleton(instance, controller);
            return;
        }

        const intervalId = handleAnimatedSkeleton(animation, instance, controller);
        return () => {
            clearInterval(intervalId);
        };
    }, [animation]);

    return (
        <div className="w-full h-full flex gap-4 p-3">
            <div className="relative flex basis-full" id="skeleton-display">
                <Canvas canvasRef={threeJSCanvasRef} />
                <CanvasActionBar isCentered={false}>
                    <select
                        className="select select-primary"
                        name="animations"
                        id="animation"
                        onChange={e => setAnimation(e.target.value)}
                    >
                        <option value="user-controlled">User Controlled</option>
                        <option value="idle">Idle</option>
                        <option value="walk">Walk</option>
                    </select>
                </CanvasActionBar>
                <div className="absolute flex right-2 top-2">
                    <span className="text-s text-color-secondary">Client Side Three JS Skeleton</span>
                </div>
            </div>
            <div className="relative flex basis-full">
                <Canvas canvasRef={livelinkCanvasRef} />
                <CanvasActionBar isCentered={!instance}>
                    <button className="button button-primary" onClick={toggleConnection}>
                        {instance ? "Disconnect" : "Connect"}
                    </button>
                </CanvasActionBar>
                <div className="absolute flex right-2 top-2">
                    <span className={"text-s " + (instance ? "text-color-primary-dark" : "text-color-secondary")}>
                        Livelink Session
                    </span>
                </div>
            </div>
        </div>
    );
}

//------------------------------------------------------------------------------
function handleUserControlledSkeleton(instance: Livelink | null, controller: Entity | null) {
    // Attach joint gizmo to root
    jointGizmo!.attach(joints![0]);

    // Set T Pose in 3js
    for (let jointIndex = 0; jointIndex < joints!.length; ++jointIndex) {
        const quat = droid_tpose.rotations[jointIndex];
        joints![jointIndex].quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    }

    // Update livelink skeleton
    if (instance && controller) {
        const pose = new Map(joints!.map((joint, jointIndex) => [jointIndex, joint.quaternion.toArray() as Quat]));
        instance.sendSkeletonPose({ controller, pose });
    }
}

//------------------------------------------------------------------------------
function handleAnimatedSkeleton(animation: string, instance: Livelink | null, controller: Entity | null) {
    // Disable joint gizmo for animations
    jointGizmo!.detach();

    let chosenAnimation = [] as Animation;
    if (animation === "idle") {
        chosenAnimation = droid_idle;
    } else if (animation === "walk") {
        chosenAnimation = droid_walk;
    }

    // Start sending poses every frame
    const fps = 30;
    const numFrames = chosenAnimation.length;
    let frameIndex = 0;
    const intervalId = setInterval(() => {
        if (frameIndex === numFrames) {
            frameIndex = 0;
        }

        // Update 3js skeleton
        for (let jointIndex = 0; jointIndex < joints!.length; ++jointIndex) {
            const quat = chosenAnimation[frameIndex].rotations[jointIndex];
            joints![jointIndex].quaternion.set(quat[0], quat[1], quat[2], quat[3]);
        }

        // Update livelink skeleton
        if (instance && controller) {
            const rotations = chosenAnimation[frameIndex].rotations;
            const pose = new Map(rotations.map((quat, jointIndex) => [jointIndex, quat]));
            instance.sendSkeletonPose({
                controller,
                pose,
            });
        }

        ++frameIndex;
    }, 1000 / fps);

    return intervalId;
}

//------------------------------------------------------------------------------
function setUpThreeJsSkeleton(canvas: HTMLCanvasElement) {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Scene and renderer
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setSize(width, height);

    // Camera and orbital camera controller
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.setRotationFromQuaternion(new THREE.Quaternion(-0.2716, -0.2716, -0.1473, -0.0421));
    camera.position.set(-0.6189, 2.4, 1.6689);
    const orbit = new OrbitControls(camera, renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const light = new THREE.PointLight(0xffffff, 5, 0, 2);
    light.position.set(camera.position.x, camera.position.y, camera.position.z);
    scene.add(light);

    // Grid
    const size = 10;
    const divisions = 10;
    const gridHelper = new THREE.GridHelper(size, divisions);
    scene.add(gridHelper);
    // Z Axis
    const points = [];
    points.push(new THREE.Vector3(0, 0.001, 0));
    points.push(new THREE.Vector3(0, 0.001, size / 2));
    const zAxis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
            color: 0x0000ff,
        }),
    );
    scene.add(zAxis);
    // X Axis
    points[1] = new THREE.Vector3(size / 2, 0.001, 0);
    const xAxis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
            color: 0xff0000,
        }),
    );
    scene.add(xAxis);

    // Bone space positions and rotations
    const jointPositions = droid_tpose.positions!.map(pos => new THREE.Vector3(pos[0], pos[1], pos[2]));
    const jointRotations = droid_tpose.rotations.map(rot => new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]));
    const jointRaycastLayer = 1;
    const jointMaterial = new THREE.MeshBasicMaterial({
        color: 0xcfe5fd,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
    });
    const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xbcbcbc });

    // Calculate maxDistanceBetweenJoints to scale joint/bone meshes accordingly
    let maxDistanceBetweenJoints = 0;
    for (let i = 1; i < jointPositions.length; ++i) {
        maxDistanceBetweenJoints = Math.max(jointPositions[i].length(), maxDistanceBetweenJoints);
    }

    joints = [];
    for (let i = 0; i < jointPositions.length; ++i) {
        const jointPosition = jointPositions[i];
        const jointRotation = jointRotations[i];

        // Calculate some info of parent joint
        const parentJointIndex = joint_parents[i];
        const parentJoint = parentJointIndex === -1 ? null : joints[parentJointIndex];
        const parentJointWorldPos = new THREE.Vector3();
        let distanceToParentJoint = 0.2;
        if (parentJoint) {
            parentJoint.getWorldPosition(parentJointWorldPos);
            distanceToParentJoint = jointPosition.length();
        }

        // Create joint
        const jointRadius = (0.035 * distanceToParentJoint) / maxDistanceBetweenJoints;
        const jointGeom = new THREE.SphereGeometry(jointRadius, 32, 16);
        const joint = new THREE.Mesh(jointGeom, jointMaterial);
        joint.name = i.toString();
        joint.layers.enable(jointRaycastLayer);
        if (parentJoint) {
            parentJoint.attach(joint);
        } else {
            scene.attach(joint);
        }
        joint.position.set(jointPosition.x, jointPosition.y, jointPosition.z);
        joint.quaternion.set(jointRotation.x, jointRotation.y, jointRotation.z, jointRotation.w);
        const jointWorldPos = joint.getWorldPosition(new THREE.Vector3());
        joints.push(joint);

        // Bone between Joints
        if (parentJoint) {
            const boneRadius = (0.04 * distanceToParentJoint) / maxDistanceBetweenJoints;
            const pointCloseToParent = new THREE.Vector3()
                .subVectors(parentJointWorldPos, jointWorldPos)
                .multiplyScalar(0.9)
                .add(jointWorldPos);

            // Cone to child
            let coneHeight = distanceToParentJoint * 0.9;
            let coneGeom = new THREE.ConeGeometry(boneRadius, coneHeight);
            coneGeom.translate(0, coneHeight * 0.5, 0); // base to 0
            coneGeom.rotateX(Math.PI * 0.5); // align along Z-axis
            let cone = new THREE.Mesh(coneGeom, boneMaterial);
            cone.position.copy(pointCloseToParent);
            cone.lookAt(jointWorldPos);
            parentJoint.attach(cone);

            // Cone to parent
            coneHeight = distanceToParentJoint * 0.1;
            coneGeom = new THREE.ConeGeometry(boneRadius, coneHeight);
            coneGeom.translate(0, coneHeight * 0.5, 0); // base to 0
            coneGeom.rotateX(Math.PI * 0.5); // align along Z-axis
            cone = new THREE.Mesh(coneGeom, boneMaterial);
            cone.position.copy(pointCloseToParent);
            cone.lookAt(parentJointWorldPos);
            parentJoint.attach(cone);
        }
    }

    // Joint Gizmo
    jointGizmo = new TransformControls(camera, renderer.domElement);
    jointGizmo.attach(joints[0]);
    jointGizmo.setSize(0.25);
    jointGizmo.setSpace("local");
    jointGizmo.setMode("rotate");
    jointGizmo.addEventListener("dragging-changed", event => {
        // Disable camera controller when rotating joint
        orbit.enabled = !event.value;
    });
    scene.add(jointGizmo.getHelper());

    // Raycaster to check for hovered joints
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(jointRaycastLayer);
    const pointer = new THREE.Vector2();
    function onPointerMove(event: PointerEvent) {
        // Calculate pointer position in normalized device coordinates (-1 to +1)
        const rect = renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        pointer.x = (x / renderer.domElement.clientWidth) * 2 - 1;
        pointer.y = -(y / renderer.domElement.clientHeight) * 2 + 1;
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    function animate() {
        const userControlledMode = jointGizmo!.getHelper().visible;
        if (userControlledMode && !jointGizmo!.dragging) {
            // Check for hovered joints to attach gizmo to them
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(joints!);
            for (const intersect of intersects) {
                jointGizmo!.detach();
                jointGizmo!.attach(intersect.object);
            }
        }

        orbit.update();
        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);

    return { renderer, scene, camera };
}

//------------------------------------------------------------------------------
function cleanUpThreeJs(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    scene.traverse(object => {
        if (!(object as THREE.Mesh).isMesh) {
            return;
        }

        (object as THREE.Mesh).geometry.dispose();

        const material = (object as THREE.Mesh).material as THREE.Material;
        if (material.isMaterial) {
            material.dispose();
        }
    });

    renderer.dispose();
    scene.clear();

    joints = undefined;
    jointGizmo = undefined;
}
