//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * Provides a list of all clients connected to the current session.
 *
 * @category Hooks
 */
export function useClients(): { clients: Array<Client> } {
    const { instance } = useContext(LivelinkContext);

    const [clients, setClients] = useState<Array<Client>>([]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const onClientsChanged = (): void => setClients(instance.session.other_clients);

        instance.session.addEventListener("on-client-joined", onClientsChanged);
        instance.session.addEventListener("on-client-left", onClientsChanged);

        onClientsChanged();

        return (): void => {
            instance.session.removeEventListener("on-client-joined", onClientsChanged);
            instance.session.removeEventListener("on-client-left", onClientsChanged);
            setClients([]);
        };
    }, [instance]);

    return { clients };
}
