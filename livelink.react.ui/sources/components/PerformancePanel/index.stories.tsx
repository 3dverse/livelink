//------------------------------------------------------------------------------
import type { Meta, StoryObj } from "@storybook/react-vite";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";
import { PerformancePanel } from ".";

//------------------------------------------------------------------------------
const meta = {
    title: "Components/Performance Panel",
    component: PerformancePanel,
    parameters: {
        layout: "fullscreen",
    },
} satisfies Meta<typeof PerformancePanel>;

//------------------------------------------------------------------------------
export default meta;
type Story = StoryObj<typeof meta>;

//------------------------------------------------------------------------------
export const _Component: Story = {
    args: {},
    render: (args: any) => {
        return (
            <ViewerPanel
                style={{
                    position: "absolute",
                    bottom: "10%",
                    left: "50%",
                    transform: "translate(-50%, 0)",
                    padding: ".5rem 1rem",
                    width: "8rem",
                }}
            >
                <PerformancePanel {...args} />
            </ViewerPanel>
        );
    },
};
