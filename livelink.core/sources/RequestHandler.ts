/**
 * Holds the resolve/reject pair of a Promise alongside some metadata associated with the request.
 */
type RequestResolver<MetaDataType> = {
    resolve: (u?: any) => void;
    reject: (reason?: unknown) => void;
    meta_data?: MetaDataType;
};

/**
 * A helper class to handle asynchronous communication with a server in a request/response model.
 *
 * The requests are expected to be sequential, i.e. sending request 1 then request 2 on channel C is
 * expected to receive response 1 then response 2 on channel C.
 * This is a big limitation of the system for now.
 *
 * Usage:
 *
 * Start by sending the request message on a specific channel.
 * Then call makeRequestResolver<ResponseType>() generic function specifiying the channel,
 * an optional meta data associated with the request, and the type of the expected response.
 *
 * When receiving a message on the same channel call getNextRequestResolver() specifing the channel,
 * which will return the instance of MessageResolver<MetaDataType> containing the pair of
 * resolve/reject functions and the provided meta data associated with the request.
 *
 * From there you can call either resolver.resolve() providing the expected response or
 * resolver.reject().
 *
 */
export class RequestHandler<ChannelType, MetaDataType> {
    /**
     * FIFO list of request resolvers per channel type.
     */
    readonly #resolvers = new Map<ChannelType, Array<RequestResolver<MetaDataType>>>();

    /**
     * Creates a promise for handling a request, associating it with a specific channel and some
     * optional meta_data.
     */
    makeRequestResolver<ResponseType>({
        channel_id,
        meta_data,
    }: {
        channel_id: ChannelType;
        meta_data?: MetaDataType;
    }): Promise<ResponseType> {
        return new Promise<ResponseType>((resolve, reject) => {
            this.#resolvers.set(channel_id, [
                ...(this.#resolvers.get(channel_id) ?? []),
                { resolve, reject, meta_data },
            ]);
        });
    }

    /**
     * Retrieves and removes the next request resolver from the list of resolvers for a given channel.
     */
    getNextRequestResolver({ channel_id }: { channel_id: ChannelType }): RequestResolver<MetaDataType> {
        const resolvers = this.#resolvers.get(channel_id);
        if (!resolvers || resolvers.length === 0) {
            throw new Error(`No request resolver on channel ${channel_id}`);
        }

        return resolvers.shift()!;
    }
}
