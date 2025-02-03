//------------------------------------------------------------------------------
import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ViewCube } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/View Cube",
    component: ViewCube,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof ViewCube>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
// export const _Component: Story = {
//     args: {
//         cameraEntity: null,
//         children: (
//             <>
//                 <div>1</div>
//                 <div>2</div>
//                 <div>3</div>
//                 <div>4</div>
//                 <div>5</div>
//                 <div>6</div>
//             </>
//         ),
//     },
// };
