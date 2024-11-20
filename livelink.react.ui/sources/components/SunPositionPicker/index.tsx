//------------------------------------------------------------------------------
import React from "react";
import { useEffect, useRef } from "react";
import type { Entity, Vec2, Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
const RADIUS = 40;
const LINE_WIDTH = 1;
const CENTER_RADIUS = 4;
const CENTER_MARGIN = 2;
const SUN_RADIUS = 6;
const SUN_MARGIN = 0;
const CANVAS_SIZE = `${RADIUS * 2 + 20}px`;

//------------------------------------------------------------------------------
const containerStyle = {
    position: "relative",
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
} as const;

const canvasStyle = {
    position: "absolute",
} as const;

//------------------------------------------------------------------------------
const STROKE_COLOR = "#3c4a62";
const HANDLE_COLOR = "#FFC700";
const RED_COLOR = "#fb4949";
const BLUE_COLOR = "#3db8ff";

//------------------------------------------------------------------------------
export const SunPositionPicker = ({ sun }: { sun: Entity }) => {
    //------------------------------------------------------------------------------
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const sunCanvasRef = useRef<HTMLCanvasElement>(null);

    //------------------------------------------------------------------------------
    useEffect(() => {
        const canvas = bgCanvasRef.current;

        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.translate(0.5, 0.5);
        ctx.strokeStyle = STROKE_COLOR;
        ctx.fillStyle = STROKE_COLOR;
        ctx.lineWidth = LINE_WIDTH;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // draw circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, RADIUS, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY, CENTER_RADIUS, 0, 2 * Math.PI);
        ctx.fill();

        // draw the x axis
        ctx.strokeStyle = STROKE_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX - RADIUS, centerY);
        ctx.lineTo(centerX - (CENTER_RADIUS + CENTER_MARGIN), centerY);
        ctx.stroke();
        ctx.strokeStyle = RED_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX + (CENTER_RADIUS + CENTER_MARGIN), centerY);
        ctx.lineTo(centerX + RADIUS, centerY);
        ctx.stroke();

        // draw the y axis
        ctx.strokeStyle = STROKE_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - RADIUS);
        ctx.lineTo(centerX, centerY - (CENTER_RADIUS + CENTER_MARGIN));
        ctx.stroke();
        ctx.strokeStyle = BLUE_COLOR;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + (CENTER_RADIUS + CENTER_MARGIN));
        ctx.lineTo(centerX, centerY + RADIUS);
        ctx.stroke();
    }, []);

    //------------------------------------------------------------------------------
    useEffect(() => {
        const canvas = sunCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.fillStyle = HANDLE_COLOR;
        ctx.lineWidth = LINE_WIDTH;
        ctx.strokeStyle = HANDLE_COLOR;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        let isMouseDown = false;

        const [initX, initY] = eulerToSunPosition(sun.local_transform!.eulerOrientation!);

        let sunX = initX * RADIUS + centerX;
        let sunY = initY * RADIUS + centerY;
        let sunZ = 0;

        const updateSunPosition = ({ x, y }: { x: number; y: number }) => {
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            if (distance > RADIUS) {
                const angle = Math.atan2(y - centerY, x - centerX);
                const xCenterOffset = Math.cos(angle) * RADIUS;
                const yCenterOffset = Math.sin(angle) * RADIUS;
                sunX = centerX + xCenterOffset;
                sunY = centerY + yCenterOffset;
                sunZ = RADIUS;
            } else {
                sunX = x;
                sunY = y;
                sunZ = distance;
            }
        };

        const updateCanvas = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.arc(sunX, sunY, SUN_RADIUS, 0, 2 * Math.PI);
            ctx.fill();

            const angle = Math.atan2(sunY - centerY, sunX - centerX);

            const xCenterOffset = Math.cos(angle) * (CENTER_RADIUS + CENTER_MARGIN);
            const yCenterOffset = Math.sin(angle) * (CENTER_RADIUS + CENTER_MARGIN);
            const xOffset = Math.cos(angle) * (SUN_RADIUS + SUN_MARGIN);
            const yOffset = Math.sin(angle) * (SUN_RADIUS + SUN_MARGIN);

            ctx.beginPath();
            ctx.moveTo(centerX + xCenterOffset, centerY + yCenterOffset);
            ctx.lineTo(sunX - xOffset, sunY - yOffset);
            ctx.stroke();
        };

        const update = () => {
            updateCanvas();
            const normalizedPosition = [
                (sunX - centerX) / RADIUS,
                (sunY - centerY) / RADIUS,
                1 - sunZ / RADIUS,
            ] as Vec3;

            sun.local_transform!.eulerOrientation = sunToPositionToEuler(normalizedPosition);
        };

        const onMouseDown = () => {
            isMouseDown = true;
        };

        const onMouseUp = (event: PointerEvent) => {
            event.preventDefault();
            if (!isMouseDown) return;
            isMouseDown = false;
            updateSunPosition({
                x: event.offsetX,
                y: event.offsetY,
            });
            requestAnimationFrame(update);
        };

        const onMouseMove = (event: PointerEvent) => {
            event.preventDefault();
            if (!isMouseDown) return;
            updateSunPosition({
                x: event.offsetX,
                y: event.offsetY,
            });
            requestAnimationFrame(update);
        };

        requestAnimationFrame(updateCanvas);

        canvas.addEventListener("pointerdown", onMouseDown);
        canvas.addEventListener("pointerup", onMouseUp);
        canvas.addEventListener("pointermove", onMouseMove);
        return () => {
            canvas.removeEventListener("pointerdown", onMouseDown);
            canvas.removeEventListener("pointerup", onMouseUp);
            canvas.removeEventListener("pointermove", onMouseMove);
        };
    }, [sun]);

    //------------------------------------------------------------------------------
    // UI
    return (
        <div style={containerStyle}>
            <canvas width={CANVAS_SIZE} height={CANVAS_SIZE} ref={bgCanvasRef} style={canvasStyle} />
            <canvas width={CANVAS_SIZE} height={CANVAS_SIZE} ref={sunCanvasRef} style={canvasStyle} />
        </div>
    );
};

//------------------------------------------------------------------------------
const sunToPositionToEuler = (sunPosition: Vec3): Vec3 => {
    const [sunX, sunY] = sunPosition;
    const distance = Math.sqrt(sunX * sunX + sunY * sunY);
    const normalizedPosition = [sunX / distance, sunY / distance];
    const yaw = distance === 0 ? 0 : Math.atan2(normalizedPosition[0], normalizedPosition[1]);
    const pitch_degrees = (1 - distance) * -90;
    const yaw_degrees = (yaw * 180) / Math.PI;
    return [pitch_degrees, yaw_degrees, 0];
};

//------------------------------------------------------------------------------
const eulerToSunPosition = (euler: Vec3): Vec2 => {
    const [pitch, yaw] = euler;
    const yaw_radiants = (yaw * Math.PI) / 180;
    const distance = pitch / 90 + 1;
    const sunX = -Math.cos(yaw_radiants + Math.PI / 2) * distance;
    const sunY = Math.sin(yaw_radiants + Math.PI / 2) * distance;
    return [sunX, sunY];
};
