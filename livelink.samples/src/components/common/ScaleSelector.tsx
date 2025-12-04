//------------------------------------------------------------------------------
import { ButtonGroupSelect } from "@/components/common/ButtonGroupSelect";

//------------------------------------------------------------------------------
const deviceDPR = window.devicePixelRatio || 1;
const baseOptions = [0.5, 0.75, 1, 2];
const scaleOptions = [...new Set([...baseOptions, deviceDPR])].sort();

//------------------------------------------------------------------------------
export function ScaleSelector({ scale, setScale }: { scale: number; setScale: (scale: number) => void }) {
    return (
        <div className="flex flex-wrap gap-2 justify-center">
            <ButtonGroupSelect
                value={scale}
                items={scaleOptions.map(scale => ({
                    value: scale,
                    label: `${scale * 100}%`,
                }))}
                onChange={scale => {
                    setScale(scale);
                }}
            />
        </div>
    );
}
