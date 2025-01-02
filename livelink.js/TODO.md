# TODO

- [ ] Check if we can save on Entity Proxy by defining accessors for each component
    - One drawback is that we can't delete components with `delete entity.component`
    - We can use `entity.component = undefined` instead

```typescript

type default = "default";

class Entity {
    #local_transform?: Components.Transform;

    get local_transform() : Components.Transform | undefined {
        // If local_transform is not already a Proxy, we can create it
        return new Proxy(this.#local_transform, new ComponentHandler(this, "local_transform"));
        // or we can return it as is
        return this.#local_transform;
    }

    set local_transform(value: Partial<Components.Transform> | default | undefined) {
        if (value === undefined) {
            delete this.#local_transform;
            return;
        }

        if (value === "default") {
            value = undefined;
        }

        // Either using auto generated code (meh)
        this.#local_transform = { ...{ position: [], orientation: [], scale: [] }, ...value };
        // or using Livelink.Core
        this.#local_transform = this.#scene._sanitizeComponentValue("local_transform", value);

        // we can create the component as a Proxy
        this.#local_transform = new Proxy(
            this.#scene._sanitizeComponentValue("local_transform", value),
            new ComponentHandler(this, "local_transform")
        );
    }
}
```
