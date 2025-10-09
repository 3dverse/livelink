//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InactivityWarning } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Inactivity Warning",
    component: InactivityWarning,
    parameters: {
        layout: "centered",
    },
} satisfies Meta<typeof InactivityWarning>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {
        warningDuration: 100,
        onActivityDetected: () => {},
    },
};
