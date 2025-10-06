//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { ViewerPanel } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/ViewerPanel",
    component: ViewerPanel,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof ViewerPanel>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        children: <p>Panel optimised for 3D viewer overlay</p>,
    },
    render: (args: any) => (
        <div className="livelink-react-ui-component">
            <ViewerPanel {...args} />
        </div>
    ),
};
