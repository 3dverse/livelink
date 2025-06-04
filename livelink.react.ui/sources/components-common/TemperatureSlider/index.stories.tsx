//------------------------------------------------------------------------------
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { TemperatureSlider } from "./index";

//------------------------------------------------------------------------------
const meta = {
    title: "Components Common/Temperature Slider",
    component: TemperatureSlider,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof TemperatureSlider>;

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
                <TemperatureSlider {...args} value={value} onChange={setValue} />
            </div>
        );
    },
};
