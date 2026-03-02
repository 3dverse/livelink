//------------------------------------------------------------------------------
import { ButtonGroupSelect } from "@/components/common/ButtonGroupSelect";

//------------------------------------------------------------------------------
const deviceDPR = window.devicePixelRatio || 1;
const baseOptions = [0.5, 0.75, 1, 2];
const scaleOptions = [...new Set([...baseOptions, parseFloat(deviceDPR.toFixed(2))])].sort();

//------------------------------------------------------------------------------
export function ScaleSelector({ scale, setScale }: { scale: number; setScale: (scale: number) => void }) {
    const options = scaleOptions.map(option => ({
        value: option,
        label: `${parseFloat((option * 100).toFixed(0))}%`,
    }));

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            <ButtonGroupSelect
                value={scale}
                items={options}
                onChange={scale => {
                    setScale(scale);
                }}
            />
        </div>
    );
}
