import { forwardRef, type Ref, useContext, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { ViewportContext } from "@3dverse/livelink-react";

import * as THREE from "three";
import { TransformControls, type TransformControlsEventMap } from "three/addons/controls/TransformControls.js";

import { CameraController, Entity, EntityUpdatedEvent } from "@3dverse/livelink";
import { ThreeOverlayContext } from "./ThreeOverlayProvider";

//------------------------------------------------------------------------------
export type TransformController = TransformControls;

//------------------------------------------------------------------------------
export function TransformControlsComponent(
    {
        controlledEntity,
        cameraController,
        setDragging,
    }: {
        controlledEntity: Entity | null;
        cameraController: CameraController | null;
        setDragging?: (isDragging: boolean) => void;
    },
    ref: Ref<TransformController | null>,
) {
    const { overlay } = useContext(ThreeOverlayContext);
    const { viewport } = useContext(ViewportContext);

    const anchorObject = useMemo(() => new THREE.Object3D(), []);
    const [controls, setControls] = useState<TransformController | null>(null);

    useImperativeHandle(ref, () => controls, [controls]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewport || !overlay || !cameraController) {
            return;
        }

        const controls = new TransformControls(overlay.camera, viewport.dom_element);

        const redrawHandler = function () {
            viewport.rendering_surface.redrawLastFrame();
        };

        viewport.dom_element.addEventListener("pointermove", redrawHandler);

        setControls(controls);
        overlay.scene.add(controls.getHelper());

        return () => {
            viewport.dom_element.removeEventListener("pointermove", redrawHandler);
            overlay.scene.remove(controls.getHelper());
            controls.dispose();
        };
    }, [viewport, overlay, cameraController]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!controls || !cameraController) {
            return;
        }

        const handler = function (event: TransformControlsEventMap["dragging-changed"]) {
            const value = Boolean(event.value);
            cameraController.enabled = !value;
            if (setDragging) {
                setTimeout(() => setDragging(value), 0);
            }
        };

        controls.addEventListener("dragging-changed", handler);
        return () => {
            controls.removeEventListener("dragging-changed", handler);
        };
    }, [controls, cameraController, setDragging]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!controlledEntity || !controls || !overlay) {
            return;
        }

        overlay.scene.add(anchorObject);
        controls.attach(anchorObject);

        let isDragging = false;

        const controlsListener = function () {
            controlledEntity.global_transform.position = controls.object.position.toArray();
            controls.object.quaternion.toArray(controlledEntity.global_transform.orientation);
            controlledEntity.global_transform = {
                scale: controls.object.scale.toArray(),
            };
        };

        const draggingChangedHandler = function (event: TransformControlsEventMap["dragging-changed"]) {
            isDragging = Boolean(event.value);
        };

        controls.addEventListener("dragging-changed", draggingChangedHandler);

        const entityUpdateHandler = function (event: EntityUpdatedEvent) {
            if (event.updated_components.includes("local_transform") && !isDragging) {
                applyEntityTransform();
            }
        };

        const applyEntityTransform = function () {
            anchorObject.position.fromArray(controlledEntity.global_transform.position);
            anchorObject.quaternion.fromArray(controlledEntity.global_transform.orientation);
            anchorObject.scale.fromArray(controlledEntity.global_transform.scale);
            anchorObject.updateMatrixWorld();
        };

        controls.addEventListener("objectChange", controlsListener);

        // Listen for changes on the controlled entity and its parents
        const abortController = new AbortController();
        let entity: Entity | null = controlledEntity;
        while (entity) {
            entity.addEventListener("on-entity-updated", entityUpdateHandler, { signal: abortController.signal });
            entity = entity.parent;
        }

        applyEntityTransform();

        return () => {
            overlay.scene.remove(anchorObject);
            controls.removeEventListener("objectChange", controlsListener);
            controls.removeEventListener("dragging-changed", draggingChangedHandler);
            abortController.abort();
            controls.detach();
        };
    }, [overlay, controlledEntity, controls, anchorObject]);

    return null;
}

const TransformControlsComponentWithRef = forwardRef(TransformControlsComponent);
export { TransformControlsComponentWithRef as TransformControls };
