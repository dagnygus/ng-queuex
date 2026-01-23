import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalMonoTypeOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Forwards only the first `count` values emitted by the source `Signal<T>`.
 *
 * After the specified number of values has been emitted, the operator
 * deinitializes the `signalPipe`, stopping further observation
 * of the source signal. The pipeline is re-initialized only when all
 * consumers are removed and a new active consumer appears again.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param count
 * The maximum number of values to emit before deinitializing the pipeline.
 *
 * @returns
 * A signal operator function that emits up to `count` values per active
 * consumer lifecycle.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const limited = signalPipe(
 *   source,
 *   [take(3)]
 * );
 * ```
 *
 * @remarks
 * - After emitting `count` values, the signal pipeline is fully deinitialized.
 * - Further source changes are ignored until the pipeline is re-initialized.
 * - Re-initialization occurs only after the number of consumers drops to zero
 *   and a new active consumer is registered.
 */
export function take<T>(count: number): SignalMonoTypeOperatorFunction<T> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(take);
    const scope = CleanupScope.assertCurrent(take);
    const nextSource = signal<any>(undefined);
    count = Math.max(1, count);

    let i = 0;
    subscribe(prevSource, (value) => {
      nextSource.set(value);
      i++;
      if (i < count) { return; }
      scope.cleanup();
    });


    return nextSource.asReadonly();
  }
}
