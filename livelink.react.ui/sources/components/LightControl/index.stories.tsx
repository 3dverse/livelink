//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CameraController, Canvas, LivelinkContext, useCameraEntity, Viewport } from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import { LightControl } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Light Control",
    component: LightControl,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof LightControl>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        light: undefined as unknown as Entity,
    },
    decorators: [
        (Story: React.ComponentType<{ lights: Entity[] }>, { args }) => {
            const { instance } = useContext(LivelinkContext);
            const { cameraEntity } = useCameraEntity({
                settings: { ssr: true, volumetricLighting: true, density: 0.1 },
            });
            const [lights, setLights] = useState<Entity[]>([]);

            //--------------------------------------------------------------------------
            // Effects
            useEffect(() => {
                instance?.scene
                    .findEntitiesWithComponents({
                        mandatory_components: ["point_light"],
                    })
                    .then(entities => {
                        const _lights = entities.filter(entity => !entity.point_light?.isSun);
                        setLights(_lights);
                    });
            }, [instance]);

            return (
                <Canvas style={{ width: "100vw", height: "100vh" }}>
                    <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                        <CameraController />
                        <div
                            style={{
                                position: "absolute",
                                bottom: "10%",
                                left: "50%",
                                transform: "translate(-50%, 0)",
                                backgroundColor:
                                    "color-mix(in srgb,var(--3dverse-color-bg-foreground) 85%,transparent)",
                                backdropFilter: "blur(24px)",
                                borderRadius: "var(--3dverse-border-radius-lg)",
                            }}
                        >
                            {/* TODO: replace by component Story */}
                            {lights[0] && <LightControl {...args} light={lights[0]} />}
                        </div>
                    </Viewport>
                </Canvas>
            );
        },
    ],
};
