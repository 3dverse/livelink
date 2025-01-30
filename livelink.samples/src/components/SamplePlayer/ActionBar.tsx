//------------------------------------------------------------------------------
export const ActionBar = ({ disconnect }: { disconnect: () => void }) => {
    return (
        <div role="menubar" className="absolute z-10 flex gap-1 top-2 md:top-4 right-2 md:right-4">
            <button className="button button-overlay" onClick={disconnect}>
                Disconnect
            </button>
        </div>
    );
};
