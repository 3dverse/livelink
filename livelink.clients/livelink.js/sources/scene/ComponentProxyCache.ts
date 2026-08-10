//------------------------------------------------------------------------------
import type { ComponentName, ComponentType } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import type { Entity } from "@livelink.base/scene/Entity";

/**
 * Stable per-component Proxy cache backing the browser SDK's proxied component model.
 *
 * Wraps the live stored component values in dirty-flagging proxies and hands the same proxy back
 * for as long as the underlying stored value is unchanged, so consumers can rely on reference
 * identity (React dependency arrays, Map keys, `!==` change detection). The cache is keyed by the
 * stored value: replacing or recreating the component invalidates it automatically.
 *
 * It has no headless counterpart — the shared core's entities expose the explicit component model
 * and hand out the raw stored values, carrying no proxy state. Its sole consumer is the generated
 * `EntityComponentsProxy` accessor layer, which pairs it with the {@link ComponentHandler}.
 *
 * @internal
 */
export class ComponentProxyCache {
    /**
     * Cached proxies keyed by component name. Each entry remembers the stored value it wraps so a
     * replaced component rebuilds its proxy.
     */
    readonly #proxies = new Map<ComponentName, { target: object; proxy: object }>();

    /**
     * Wrap the given stored component value in a stable Proxy built from the given handler class.
     *
     * @returns The cached (or newly built) proxy for the value, or undefined when the component is
     * absent — in which case any stale cache entry is dropped.
     */
    wrap<_ComponentName extends ComponentName>({
        entity,
        component_name,
        value,
        ComponentHandler,
    }: {
        entity: Entity;
        component_name: _ComponentName;
        value: ComponentType<_ComponentName> | undefined;
        ComponentHandler: new (entity: Entity, component_name: _ComponentName) => ProxyHandler<never>;
    }): ComponentType<_ComponentName> | undefined {
        if (value === undefined) {
            this.#proxies.delete(component_name);
            return undefined;
        }

        const cached = this.#proxies.get(component_name);
        if (cached !== undefined && cached.target === value) {
            return cached.proxy as ComponentType<_ComponentName>;
        }

        // Proxy the live stored value so nested mutations flag the entity dirty.
        const proxy = new Proxy(value, new ComponentHandler(entity, component_name));
        this.#proxies.set(component_name, { target: value, proxy });
        return proxy as ComponentType<_ComponentName>;
    }
}
