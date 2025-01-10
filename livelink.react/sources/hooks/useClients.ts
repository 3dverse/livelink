//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { Client } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * Provides a list of all clients connected to the current session.
 *
 * @category Context Providers
 */
export function useClients() {
    const { instance } = useContext(LivelinkContext);

    const [clients, setClients] = useState<Array<Client>>([]);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const onClientsChanged = () => setClients(instance.session.other_clients);

        instance.session.addEventListener("on-client-joined", onClientsChanged);
        instance.session.addEventListener("on-client-left", onClientsChanged);

        onClientsChanged();

        return () => {
            instance.session.removeEventListener("on-client-joined", onClientsChanged);
            instance.session.removeEventListener("on-client-left", onClientsChanged);
            setClients([]);
        };
    }, [instance]);

    return { clients };
}
