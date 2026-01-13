import { assertNotInReactiveContext, signal } from "@angular/core";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { Schedulers } from "../../schedulers/schedulers";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Schedules the forwarding of source values onto the microtask queue.
 *
 * When the source `Signal<T>` emits a value, the emission to the output
 * signal is deferred and executed in a microtask. This ensures that the
 * value is propagated asynchronously, after the current synchronous
 * execution completes.
 *
 * @returns
 * A signal operator function that emits source values scheduled on the
 * microtask queue.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const scheduled = signalPipe(
 *   source,
 *   [ scheduleOnMicrotask() ]
 * );
 * ```
 *
 * @remarks
 * - Emissions are deferred using the microtask queue.
 * - Multiple source emissions within the same synchronous execution
 *   are scheduled independently.
 * - Useful for breaking synchronous signal propagation chains.
 */
export function scheduleOnMicrotask<T>(): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(scheduleOnMicrotask);
    const scope = CleanupScope.assertCurrent(scheduleOnMicrotask);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);
    const taskAborters: (() => void)[] = [];

    scope.add(() => {
      while(taskAborters.length) {
        taskAborters.pop()!();
      }
    });

    subscribe(prevSource, (value) => {
      const abort = schedulers.scheduleMicrotask(() => {
        const index = taskAborters.indexOf(abort);
        if (index > -1) {
          taskAborters.splice(index, 1);
        }
        nextSource.set(value);
      });
    });

    return nextSource.asReadonly();
  }
}
