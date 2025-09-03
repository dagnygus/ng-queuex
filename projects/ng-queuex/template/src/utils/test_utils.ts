import { Priority } from "@ng-queuex/core";

export function describePriorityLevel(priority: Priority, fn: () => void) {
  describe(`Priority level = ${Priority[priority]}.`, fn)
}

export function defineGlobalFlag(flag: string): () => void {
  (window as any)[`__$$TEST_FLAGS$$__${flag}`] = true;
  return () => {
    delete (window as any)[`__$$TEST_FLAGS$$__${flag}`]
  }
}

export function isFlagDefined(flag: string): boolean {
  const _global = window as any
  return typeof _global[`__$$TEST_FLAGS$$__${flag}`] === 'boolean' && _global[`__$$TEST_FLAGS$$__${flag}`]
}

export function runCbWhenFlagDefined(flag: string, cb: () => void) {
  if (isFlagDefined(flag)) {
    cb();
  }
}
