import { UUID } from "@3dverse/livelink.core";
import { ClientInfo } from "./ClientInfo";

/**
 * Information about a session.
 *
 * @category Session
 */
export type SessionInfo = {
    /**
     * The unique identifier of the session.
     */
    readonly session_id: UUID;

    /**
     * The unique identifier of the scene the session is running in.
     */
    readonly scene_id: UUID;

    /**
     * Whether the session is a transient session.
     * Transient sessions are temporary and changes are not saved.
     */
    readonly is_transient_session: boolean;

    /**
     * The name of the scene the session is running in.
     */
    readonly scene_name?: string;

    /**
     * The unique identifier of the 3dverse console folder the scene is in.
     */
    readonly folder_id?: UUID;

    /**
     * The maximum number of users who can join the session.
     */
    readonly max_users?: number;

    /**
     * The unique identifier of the user who created the session.
     */
    readonly created_by?: {
        /**
         * The unique identifier of the user who created the session.
         */
        readonly user_id: UUID;

        /**
         * The name of the user who created the session.
         */
        readonly username: string;
    };

    /**
     * The date and time the session was created.
     */
    readonly created_at?: Date;

    /**
     * The country code of the 3dverse server the session is running on.
     */
    readonly country_code?: string;

    /**
     * The continent code of the 3dverse server the session is running on.
     */
    readonly continent_code?: string;

    /**
     * The information about the clients connected to the session.
     */
    readonly clients?: Array<ClientInfo>;
};
