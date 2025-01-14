//------------------------------------------------------------------------------
export function Home() {
    return (
        <div className="grow h-full border-l border-tertiary">
            <div className="container-lg flex flex-col items-center justify-center h-full w-full py-12">
                <div className="flex items-center gap-3 font-primary text-3xl text-secondary tracking-wide">
                    <img src="https://3dverse.com/logo/3dverse-wordmark.svg" className="h-6 mt-px" alt="3dverse" />
                    <h1>Samples</h1>
                </div>
                <p className="mt-3 text-md text-tertiary">Explore 3dverse features with these samples.</p>
            </div>
        </div>
    );
}
