import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from '../../cleanup_scope/cleanup_scope';
import { assertNotInReactiveContext, computed } from "@angular/core";

/**
 * Creates a signal operator that transforms the emitted value of a source signal
 * using a provided projection function.
 *
 * Each time the source signal updates, the projection function is called with
 * the current value, and its return value becomes the next value of the derived signal.
 *
 * @param project A pure function that receives the current signal value and returns a new transformed value.
 *
 * @returns A signal operator function that applies the projection to each signal value.
 *
 * @example
 * const count = signal(1);
 * const doubled = map(x => x * 2);
 * const doubledSignal = doubled(count);
 *
 * console.log(doubledSignal()); // 2
 *
 * @remarks
 * - All project() function executions have shared cleanup scope, what it gets clean between executions.
 */
export function map<T, V>(project: (value: T) => V): SignalOperatorFunction<T, V> {
  return function(mainSource) {
    NG_DEV_MODE && assertNotInReactiveContext(map);
    const childScope = CleanupScope.assertCurrent(map).createChild();

    return computed(() => {
      childScope.cleanup();
      let cleaned = false;
      childScope.add(() => { cleaned = true; });

      const result = childScope.run(() => project(mainSource()));

      if (cleaned) { childScope.cleanup(); }

      return result;
    });
  }
}
