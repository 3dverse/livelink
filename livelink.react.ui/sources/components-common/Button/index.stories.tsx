//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

//------------------------------------------------------------------------------
import { Button } from "./index";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Button",
    component: Button,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof Button>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        children: "Button",
    },
    render: (args: any) => (
        <div className="livelink-react-ui-component">
            <Button {...args} />
        </div>
    ),
};
