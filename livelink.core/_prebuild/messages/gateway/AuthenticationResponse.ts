import { UUID, deserialize_UUID } from "../../../sources/types";
import { LITTLE_ENDIAN } from "../../../sources/types/constants";

/**
 *
 */
export enum AuthenticationStatus {
    // Common
    unknown_error = 0,
    success = 1,
    // Join session errors
    authentication_failed = 100,
    session_not_found,
    session_closed,
    // Launcher errors
    launcher_not_found = 200,
    unknown_service,
    service_boot_error,
    // Session creation errors
    invalid_request = 300,
    duplicate_session,
    // Client errors
    client_not_found = 400,
}

/**
 *
 */
export type AuthenticationResponse = {
    status: AuthenticationStatus;
    client_id: UUID;
};

/**
 *
 */
export function deserialize_AuthenticationResponse({
    data_view,
    offset,
}: {
    data_view: DataView;
    offset: number;
}): AuthenticationResponse {
    const status = data_view.getUint16(offset, LITTLE_ENDIAN) as AuthenticationStatus;
    offset += 2;

    const client_id = deserialize_UUID({
        data_view,
        offset,
    });

    return { status, client_id };
}
