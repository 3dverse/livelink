//------------------------------------------------------------------------------
export function LoadingSpinner({ className = "" }: { className?: string }) {
    return (
        <div
            className={`z-30 w-full h-full flex items-center justify-center absolute bg-[#1e222e] rounded-xl ${className}`}
        >
            <div className="loader" />
        </div>
    );
}
