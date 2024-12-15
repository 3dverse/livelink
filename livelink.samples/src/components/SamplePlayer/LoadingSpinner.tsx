//------------------------------------------------------------------------------
export function LoadingSpinner({ className = "" }: { className?: string }) {
    return (
        <div
            className={`w-full h-full flex items-center justify-center absolute z-10 bg-[#1e222e] rounded-xl ${className}`}
        >
            <div className="loader" />
        </div>
    );
}
