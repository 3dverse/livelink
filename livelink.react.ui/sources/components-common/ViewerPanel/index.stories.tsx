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
        style: {
            padding: "0.5rem 1rem",
        },
    },
    render: (args: any) => <ViewerPanel {...args} />,
};
