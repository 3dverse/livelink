//------------------------------------------------------------------------------
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { Slider } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Slider",
    component: Slider,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof Slider>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        value: 50,
        onChange: () => {},
    },
    render: (args: any) => {
        const [value, setValue] = useState(args.value);
        return (
            <div className="livelink-react-ui-component" style={{ width: "300px" }}>
                <Slider {...args} value={value} onChange={setValue} />
            </div>
        );
    },
};
