import { Signal } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";

export function assertSignal(arg: any, propertyName: string): void {
  if (typeof arg === 'function' && arg[SIGNAL]) { return; }
  let typeName: string
  if ((typeof arg === 'object' || typeof arg === 'function') && arg !== null) {
    typeName = arg.constructor.name;
  } else {
    typeName = typeof arg;
  }
  throw new Error(`${propertyName} must be a signal, but received ${typeName}`);
}
