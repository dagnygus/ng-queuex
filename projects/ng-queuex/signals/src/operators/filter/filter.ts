import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Emits values from the source signal only if they satisfy the provided predicate function.
 * Values of `undefined` are ignored and never passed to the predicate.
 *
 * @template T The type of the values emitted by the source signal.
 *
 * @param predicate
 * A function that evaluates each defined value emitted by the source signal.
 * If it returns `true`, the value is included in the output signal.
 *
 * @returns
 * A signal operator function that emits only values satisfying the given predicate.
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * const evenCount = signalPipe(
 *   count,
 *   filter(value => value % 2 === 0)
 * );
 * ```
 *
 * @remarks
 * - Initial value `undefined` is skipped.
 * - Use this to selectively propagate signal updates based on a condition.
 * - All predicate() function executions have shared cleanup, what it gets clean between executions.
 */
export function filter<T>(predicate: (value: Exclude<T, undefined>) => boolean): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(filter);
    const childScope = CleanupScope.assertCurrent(filter).createChild();
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (value) => {
      childScope.cleanup();
      let cleaned = false;
      childScope.add(() => { cleaned = true; });
      if(childScope.run(() => predicate(value))) {
        nextSource.set(value);
      }
      if (cleaned) {
        childScope.cleanup();
      }
    });

    return nextSource.asReadonly();
  }
}
