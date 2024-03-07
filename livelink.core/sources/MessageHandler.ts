/**
 *
 */
type MessageResolver<PayloadType> = {
  resolve: (u?: any) => void;
  reject: (reason?: unknown) => void;
  payload?: PayloadType;
};

/**
 *
 */
export class MessageHandler<ChannelType, PayloadType> extends EventTarget {
  /**
   *
   */
  private readonly _resolvers = new Map<
    ChannelType,
    Array<MessageResolver<PayloadType>>
  >();

  /**
   *
   */
  protected _makeMessageResolver<T>({
    channel_id,
    payload,
  }: {
    channel_id: ChannelType;
    payload?: PayloadType;
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._resolvers.set(channel_id, [
        ...(this._resolvers.get(channel_id) ?? []),
        { resolve, reject, payload },
      ]);
    });
  }

  /**
   *
   */
  protected _getNextMessageResolver({
    channel_id,
  }: {
    channel_id: ChannelType;
  }): MessageResolver<PayloadType> {
    const handlers = this._resolvers.get(channel_id);
    if (!handlers || handlers.length === 0) {
      throw new Error(`No handler for message on channel ${channel_id}`);
    }

    return handlers.shift()!;
  }
}
