//------------------------------------------------------------------------------
export function LoadingSpinner({ className = "" }: { className?: string }) {
    return (
        <div className={`w-full h-full flex items-center justify-center absolute z-10 bg-ground ${className}`}>
            <div className="loader" />
        </div>
    );
}
