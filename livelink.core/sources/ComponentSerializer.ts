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
  private readonly _descriptors = new Map<ComponentName, ComponentDescriptor>();

  /**
   *
   */
  constructor(descriptors: Record<string, ComponentDescriptor>) {
    for (const componentName in descriptors) {
      const component = descriptors[componentName];
      if (component.mods.length > 0) {
        continue;
      }

      if (component.attributes.every((attr) => attr.mods.length > 0)) {
        continue;
      }

      this._descriptors.set(componentName, component);
    }
  }
}
