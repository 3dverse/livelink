import { ComponentDescriptor } from "../_prebuild/types";

/**
 *
 */
type ComponentName = string;

/**
 *
 */
export class ComponentSerializer {
  /**
   *
   */
  public readonly component_names: Array<ComponentName> = [];

  /**
   *
   */
  private readonly _descriptors = new Map<ComponentName, ComponentDescriptor>();

  /**
   *
   */
  constructor(descriptors: Record<string, ComponentDescriptor>) {
    for (const componentName in descriptors) {
      const component = descriptors[componentName];

      // If mods are present it means that this component is not serializable
      // (transient or engine only).
      if (component.mods.length > 0) {
        continue;
      }

      // All attributes having mods is equivalent to the component having mods.
      if (component.attributes.every((attr) => attr.mods.length > 0)) {
        continue;
      }

      this.component_names.push(componentName);
      this._descriptors.set(componentName, component);
    }
  }
}
