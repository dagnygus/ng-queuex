import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Transforms each emitted value from the source `Signal<T>` into an inner `Signal<V>`
 * using the provided `project` function, and mirrors the inner signal’s values
 * only after it emits its first defined (non-undefined) value.
 *
 * If a new value is emitted by the source signal while a projected inner signal
 * is still pending (i.e. has not yet produced a defined value), it is ignored
 * until the current inner signal becomes active. Each projected signal is created
 * within its own child cleanup scope.
 *
 * @param  project
 * A function that maps each defined value from the source signal
 * to a new inner signal created within a child cleanup scope.
 * Values of `undefined` are ignored.
 *
 * @returns
 * A signal operator function that ignores new source emissions
 * while the current projected signal is pending, and emits values
 * from it once it becomes active.
 *
 * @example
 * ```ts
 * const trigger = signal(0);
 *
 * const result = signalPipe(
 *   trigger,
 *   exhaustMap(() => createAsyncSignal())
 * );
 * ```
 *
 * @remarks
 * - Each inner signal is created within a separate child cleanup scope.
 * - New source emissions are ignored until the active inner signal
 *   produces its first defined value.
 * - Use this when you want to prevent overlapping signal computations.
 * - Values of `undefined` from the source signal are skipped.
 */
export function exhaustMap<T, V>(project: (value: Exclude<T, undefined>) => Signal<V>): SignalOperatorFunction<T, V> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(exhaustMap);
    const childScope = CleanupScope.assertCurrent(exhaustMap).createChild();
    const nextSource = signal<any>(undefined);

    let innerSource: Signal<any> | null = null;

    subscribe(prevSource, (value) => {
      if (innerSource) { return; }

      childScope.cleanup();

      childScope.add(() => {
        innerSource = null;
      });

      childScope.run(() => {
        innerSource = project(value);
        subscribe(innerSource, (v) => {
          innerSource = null;
          nextSource.set(v);
        });
      });
    });

    return nextSource.asReadonly();
  }
}
