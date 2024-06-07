//------------------------------------------------------------------------------
import { useEffect, useRef } from "react";
import Canvas from "../../components/Canvas";
import { useLivelinkInstance } from "../../hooks/useLivelinkInstance";
import { DefaultCamera } from "../../components/DefaultCamera";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { Camera } from "livelink.js";

//------------------------------------------------------------------------------

const ONE_SECOND = 1000;
const FPS = 60;
const _vec3b = new THREE.Vector3();

class CameraShake {
    private _cameraControls: CameraControls;
    private _duration: number;
    private strength: number;
    private _noiseX: number[];
    private _noiseY: number[];
    private _noiseZ: number[];
    private _lastOffsetX: number;
    private _lastOffsetY: number;
    private _lastOffsetZ: number;

    // frequency: cycle par second
    constructor(cameraControls: CameraControls, duration = ONE_SECOND, frequency = 10, strength = 1) {
        this._cameraControls = cameraControls;
        this._duration = duration;
        this.strength = strength;
        this._noiseX = makePNoise1D((duration / ONE_SECOND) * frequency, (duration / ONE_SECOND) * FPS);
        this._noiseY = makePNoise1D((duration / ONE_SECOND) * frequency, (duration / ONE_SECOND) * FPS);
        this._noiseZ = makePNoise1D((duration / ONE_SECOND) * frequency, (duration / ONE_SECOND) * FPS);

        this._lastOffsetX = 0;
        this._lastOffsetY = 0;
        this._lastOffsetZ = 0;
    }

    shake() {
        const startTime = performance.now();

        const anim = () => {
            const elapsedTime = performance.now() - startTime;
            const frameNumber = ((elapsedTime / ONE_SECOND) * FPS) | 0;
            const progress = elapsedTime / this._duration;
            const ease = sineOut(1 - progress);

            if (progress >= 1) {
                this._cameraControls.setTarget(
                    _vec3b.x - this._lastOffsetX,
                    _vec3b.y - this._lastOffsetY,
                    _vec3b.z - this._lastOffsetZ,
                    false,
                );

                this._lastOffsetX = 0;
                this._lastOffsetY = 0;
                this._lastOffsetZ = 0;
                return;
            }

            requestAnimationFrame(anim);

            this._cameraControls.getTarget(_vec3b);

            const offsetX = this._noiseX[frameNumber] * this.strength * ease;
            const offsetY = this._noiseY[frameNumber] * this.strength * ease;
            const offsetZ = this._noiseZ[frameNumber] * this.strength * ease;

            this._cameraControls.setTarget(
                _vec3b.x + offsetX - this._lastOffsetX,
                _vec3b.y + offsetY - this._lastOffsetY,
                _vec3b.z + offsetZ - this._lastOffsetZ,
                false,
            );

            this._lastOffsetX = offsetX;
            this._lastOffsetY = offsetY;
            this._lastOffsetZ = offsetZ;
        };

        anim();
    }
}

function makePNoise1D(length: number /* : int */, step: number /* : int */) {
    const noise = [];
    const gradients = [];

    for (let i = 0; i < length; i++) {
        gradients[i] = Math.random() * 2 - 1;
    }

    for (let t = 0; t < step; t++) {
        const x = ((length - 1) / (step - 1)) * t;

        const i0 = x | 0;
        const i1 = (i0 + 1) | 0;

        const g0 = gradients[i0];
        const g1 = gradients[i1] || gradients[i0];

        const u0 = x - i0;
        const u1 = u0 - 1;

        const n0 = g0 * u0;
        const n1 = g1 * u1;

        noise.push(n0 * (1 - fade(u0)) + n1 * fade(u0));
    }

    return noise;
}

function fade(t: number) {
    return t * t * t * (t * (6 * t - 15) + 10);
}

const HALF_PI = Math.PI * 0.5;

function sineOut(t: number) {
    return Math.sin(t * HALF_PI);
}

//------------------------------------------------------------------------------
export class VanillaCamera extends Camera {
    private _speed = 1;
    onCreate() {
        this.local_transform = { position: [0, 3, 10] };
        this.camera = {
            renderGraphRef: "398ee642-030a-45e7-95df-7147f6c43392",
            dataJSON: { grid: true, skybox: false, gradient: true },
        };
        this.perspective_lens = {
            aspectRatio: 1,
            fovy: 60,
            nearPlane: 0.1,
            farPlane: 10000,
        };
    }

    onUpdate({ elapsed_time }: { elapsed_time: number }): void {
        this.local_transform!.position![1] = 1 + Math.sin(elapsed_time * this._speed);
    }
}

//------------------------------------------------------------------------------
export default function ControllerEffects() {
    const canvasRef1 = useRef<HTMLCanvasElement>(null);
    const canvasRef2 = useRef<HTMLCanvasElement>(null);

    const cameraControls = useRef<CameraControls | null>(null);

    const { connect } = useLivelinkInstance({
        canvas_refs: [canvasRef1, canvasRef2],
        camera_constructors: [DefaultCamera, VanillaCamera],
    });

    useEffect(() => {
        (async () => {
            const connection = await connect({
                scene_id: "15e95136-f9b7-425d-8518-d73dab5589b7",
                token: "public_p54ra95AMAnZdTel",
            });
            const { cameras } = connection!;
            cameraControls.current = (cameras[0] as DefaultCamera).cameraControls;
        })();
    }, []);

    const cameraShake1 = cameraControls.current && new CameraShake(cameraControls.current, 500, 10, 0.5);
    const cameraShake2 = cameraControls.current && new CameraShake(cameraControls.current, 1000, 10, 1);
    const cameraShake3 = cameraControls.current && new CameraShake(cameraControls.current, 5000, 2, 0.5);

    return (
        <div className="w-full h-full flex basis-full grow p-4 ">
            <div className="relative flex basis-full">
                <Canvas canvasRef={canvasRef1} />
                <div className="absolute left-1/2 bottom-8 -translate-x-1/2 flex flex-col items-center gap-2">
                    <div className="flex gap-2 w-max">
                        <button className="button button-primary" onClick={() => cameraShake1?.shake()}>
                            Shake 1
                        </button>
                        <button className="button button-primary" onClick={() => cameraShake2?.shake()}>
                            Shake 2
                        </button>
                        <button className="button button-primary" onClick={() => cameraShake3?.shake()}>
                            Shake 3
                        </button>
                    </div>
                    <div>
                        <button className="button button-primary" onClick={() => cameraControls.current?.lockPointer()}>
                            Lock Pointer
                        </button>
                    </div>
                </div>
            </div>
            <div className="relative flex basis-full">
                <Canvas canvasRef={canvasRef2} />
                <div className="absolute left-1/2 bottom-16 -translate-x-1/2">
                    <p className="text-color-tertiary">No controls</p>
                </div>
            </div>
        </div>
    );
}
