//------------------------------------------------------------------------------
export function LoadingSpinner({}: { stage: string }) {
    return (
        <div className={"z-30 w-full h-full flex items-center justify-center absolute bg-[#1e222e] rounded-xl"}>
            <div className="loader" />
        </div>
    );
}
