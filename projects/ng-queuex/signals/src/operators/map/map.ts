import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from '../../cleanup_scope/cleanup_scope';
import { assertNotInReactiveContext, computed, signal } from "@angular/core";
import { subscribe } from "../../subscribe/subscribe";

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
 * const doubled = signalPipe(
 *  count,
 *  [ map((x) => x * 2) ]
 * );
 *
 * count.set(2) // doubled - 4;
 * count.set(4) // doubled - 8;
 *
 * @remarks
 * - All project() function executions have shared cleanup scope, what it gets clean between executions.
 */
export function map<T, V>(project: (value: Exclude<T, undefined>) => V): SignalOperatorFunction<T, T extends undefined ? V | undefined : V> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(map);
    const childScope = CleanupScope.assertCurrent(map).createChild();
    const nextSource = signal<any>(undefined);
    let cleaned = false;

    function onCleanup() {
      cleaned = true;
    }

    subscribe(prevSource, (value) => {
      childScope.cleanup();
      cleaned = false;
      childScope.add(onCleanup);

      nextSource.set(childScope.run(() => project(value)));

      if (cleaned) { childScope.cleanup(); }
    });

    return nextSource.asReadonly();
  }
}
