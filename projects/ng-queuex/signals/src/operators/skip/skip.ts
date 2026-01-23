import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalMonoTypeOperatorFunction, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Skips the first `count` values emitted by the source `Signal<T>`.
 *
 * After the specified number of values has been skipped, all subsequent
 * values from the source signal are forwarded unchanged.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param count
 * The number of initial values to skip.
 *
 * @returns
 * A signal operator function that emits source values after the skip
 * count has been reached.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const skipped = signalPipe(
 *   source,
 *   [skip(2)]
 * );
 * ```
 *
 * @remarks
 * - The skipped values are not emitted.
 * - Once the skip count is reached, all subsequent values are forwarded.
 */
export function skip<T>(count: 0): SignalMonoTypeOperatorFunction<T>;
/**
 * Skips the first `count` values emitted by the source `Signal<T>`.
 *
 * After the specified number of values has been skipped, all subsequent
 * values from the source signal are forwarded unchanged.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param count
 * The number of initial values to skip.
 *
 * @returns
 * A signal operator function that emits source values after the skip
 * count has been reached.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const skipped = signalPipe(
 *   source,
 *   [skip(2)]
 * );
 * ```
 *
 * @remarks
 * - The skipped values are not emitted.
 * - Once the skip count is reached, all subsequent values are forwarded.
 */
export function skip<T>(count: number): SignalOperatorFunction<T, T | undefined>;
export function skip<T>(count: number): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(skip) && assertNotInReactiveContext(skip);
    const nextSource = signal<T | undefined>(undefined);
    count = Math.max(1, count);

    let i = 0;
    subscribe(prevSource, (value) => {
      if (count < ++i) {
        nextSource.set(value);
      }
    });

    return nextSource.asReadonly();
  }
}
