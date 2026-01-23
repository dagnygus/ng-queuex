import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { Schedulers } from "../../schedulers/schedulers";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Schedules the forwarding of source values onto the macrotask queue.
 *
 * When the source `Signal<T>` emits a value, the emission to the output
 * signal is deferred and executed in a macrotask. This ensures that the
 * value is propagated asynchronously, after the current execution frame
 * and any pending microtasks complete.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @returns {SignalOperatorFunction<T, T | undefined>}
 * A signal operator function that emits source values scheduled on the
 * macrotask queue.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const scheduled = signalPipe(
 *   source,
 *   [ scheduleOnMacrotask() ]
 * );
 * ```
 *
 * @remarks
 * - Emissions are deferred using the macrotask queue.
 * - Propagation occurs after microtasks and the current execution frame.
 * - Useful for deferring work to the next event loop turn.
 */
export function scheduleOnMacrotask<T>(): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(scheduleOnMacrotask);
    const scope = CleanupScope.assertCurrent(scheduleOnMacrotask);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);
    const timeoutCleanups: (() => void)[] = [];

    scope.add(() => {
      while(timeoutCleanups.length) {
        timeoutCleanups.pop()!();
      }
    });

    subscribe(prevSource, (value) => {
      const timeoutCleanup = schedulers.setTimeout(() => {
        const index = timeoutCleanups.indexOf(timeoutCleanup);
        if (index > -1) {
          timeoutCleanups.splice(index, 1);
        }
        nextSource.set(value);
      }, 0);
    });

    return nextSource.asReadonly();
  }
}
