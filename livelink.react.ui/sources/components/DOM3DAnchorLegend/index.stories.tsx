//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DOM3DAnchorLegend } from ".";
import {
    CameraController,
    Canvas,
    DOM3DEntityAnchor,
    DOM3DOverlay,
    useCameraEntity,
    useEntity,
    Viewport,
} from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { SUN_POSITION_PICKER_SCENE_ID } from "../../../.storybook/sceneIds";

//------------------------------------------------------------------------------
const CUBE_1_EUID = "703dad6a-c96d-46dc-a1bf-7a29faee16ec";
const CUBE_2_EUID = "b9753054-ddf4-4b74-a6ad-b680368043e9";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/DOM 3D Anchor Legend",
    /** Stable permalink: avoids `dom-3d` vs `dom3d` slug mismatch for preview/Chromatic links. */
    id: "components-dom3d-anchor-legend",
    component: DOM3DAnchorLegend,
    parameters: {
        layout: "fullscreen",
        livelinkSceneId: SUN_POSITION_PICKER_SCENE_ID,
    },
} satisfies Meta<typeof DOM3DAnchorLegend>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
function AnchorLegendDemo(props: {
    direction?: "start" | "end";
    children?: React.ReactNode;
    color?: string;
}): React.JSX.Element {
    const { cameraEntity } = useCameraEntity({
        position: [14, 12, 14],
        eulerOrientation: [-35, 45, 0],
    });

    //--------------------------------------------------------------------------
    const { entity: cube1Entity } = useEntity({ euid: CUBE_1_EUID });
    const { entity: cube2Entity } = useEntity({ euid: CUBE_2_EUID });

    //--------------------------------------------------------------------------
    return (
        <Canvas style={{ width: "100%", height: "100vh" }}>
            <Viewport cameraEntity={cameraEntity} style={{ width: "100%", height: "100%" }}>
                <CameraController />
                <DOM3DOverlay>
                    <DOM3DEntityAnchor entity={cube1Entity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend direction={props.direction} color={props.color}>
                            {props.children}
                        </DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                    <DOM3DEntityAnchor entity={cube2Entity} scaleFactor={0.005}>
                        <DOM3DAnchorLegend direction={props.direction} color={props.color}>
                            {props.children}
                        </DOM3DAnchorLegend>
                    </DOM3DEntityAnchor>
                </DOM3DOverlay>
            </Viewport>
        </Canvas>
    );
}

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        children: "Scene marker",
    },
    render: args => (
        <AnchorLegendDemo direction={args.direction} color={args.color}>
            {args.children}
        </AnchorLegendDemo>
    ),
};

//------------------------------------------------------------------------------
export const DirectionEnd: Story = {
    args: {
        direction: "end",
        children: "Mirrored legend",
    },
    render: args => (
        <AnchorLegendDemo direction={args.direction} color={args.color}>
            {args.children}
        </AnchorLegendDemo>
    ),
};


//------------------------------------------------------------------------------
export const Color: Story = {
    args: {
        children: "Legend with color",
        color: "#7dd3fc",
    },
    render: args => (
        <AnchorLegendDemo direction={args.direction} color={args.color}>
            {args.children}
        </AnchorLegendDemo>
    ),
};
