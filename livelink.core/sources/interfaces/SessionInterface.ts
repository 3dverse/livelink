import { UUID } from "../types";

export interface SessionInterface {
    /**
     *
     */
    get gateway_url(): string | null;

    /**
     *
     */
    get session_key(): string | null;

    /**
     *
     */
    set client_id(client_id: UUID | null);

    /**
     *
     */
    isJoinable(): boolean;
}
