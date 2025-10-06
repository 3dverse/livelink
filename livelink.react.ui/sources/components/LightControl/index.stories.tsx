//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    CameraController,
    Canvas,
    LivelinkContext,
    useCameraEntity,
    useEntity,
    Viewport,
} from "@3dverse/livelink-react";
import type { Entity } from "@3dverse/livelink";
import clsx from "clsx";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";
import { LightPreview } from "./LightPreview/LightPreview";
import { LightColorSelector } from "./LightColorSelector/LightColorSelector";
import { LightTemperatureSlider } from "./LightTemperatureSlider/LightTemperatureSlider";
import { LightBrightnessSlider } from "./LightBrightnessSlider/LightBrightnessSlider";
import { LightSwitchOnOff } from "./LightSwitchOnOff/LightSwitchOnOff";
import { useLightControl } from "./LightControlContext";
import styles from "./index.module.css";
import { LightControl, LightControlProps } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Light Control",
    component: LightControl,
    subcomponents: {
        LightPreview,
        LightColorSelector,
        LightTemperatureSlider,
        LightBrightnessSlider,
        LightSwitchOnOff,
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
    render: (args: any) => {
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
                    <ViewerPanel
                        style={{
                            position: "absolute",
                            bottom: "10%",
                            left: "50%",
                            transform: "translate(-50%, 0)",
                        }}
                    >
                        {lights[0] && <LightControlWidget lights={lights} {...args} />}
                    </ViewerPanel>
                </Viewport>
            </Canvas>
        );
    },
};

//------------------------------------------------------------------------------
const LightControlWidget = ({ lights, ...args }: { lights: Entity[] } & LightControlProps) => {
    const { entity: light } = useEntity({ euid: lights[0].euid.value }, ["point_light"]);

    if (!light) {
        return null;
    }
    return (
        <LightControl {...args} light={light}>
            {/* TODO: replace by component Story */}
            <LightControlInner />
        </LightControl>
    );
};

//------------------------------------------------------------------------------
const LightControlInner = () => {
    const { isPowered } = useLightControl();
    return (
        <div className={`${styles.container} livelink-react-ui-component`}>
            <LightPreview />
            <div className={styles.innerContainer}>
                <Card
                    isPowered={isPowered}
                    style={{
                        flexDirection: "column",
                        gap: "var(--3dverse-spacing-4)",
                        flexGrow: 1,
                    }}
                >
                    <LightColorSelector />
                    <div>
                        <label className={styles.label}>Temperature</label>
                        <LightTemperatureSlider />
                    </div>
                    <div>
                        <label className={styles.label}>Brightness</label>
                        <LightBrightnessSlider />
                    </div>
                </Card>
                <Card style={{ justifyContent: "end", alignItems: "end" }}>
                    <LightSwitchOnOff />
                </Card>
            </div>
        </div>
    );
};

//------------------------------------------------------------------------------
const Card = ({
    children,
    className,
    isPowered = true,
    ...props
}: { isPowered?: boolean; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
    <div className={clsx(styles.card, isPowered ? "" : styles.dimmed, className)} {...props}>
        {children}
    </div>
);
