import { assertNotInReactiveContext, signal } from "@angular/core";
import { SignalOperatorFunction, SignalMonoTypeOperatorFunction, NG_DEV_MODE } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Forwards all values emitted by the source `Signal<T>` without skipping any.
 *
 * Since the provided `predicate` always returns `false`, no source value
 * is ever skipped and all defined values are forwarded unchanged.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A predicate that always returns `false`, causing no values to be skipped.
 *
 * @returns
 * A signal operator function that forwards all source values.
 *
 * @remarks
 * - This overload represents a no-op skip operator.
 * - All defined source values are forwarded as-is.
 */
export function skipWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => false): SignalMonoTypeOperatorFunction<T>;
/**
 * Skips all values emitted by the source `Signal<T>`.
 *
 * Since the provided `predicate` always returns `true`, every defined
 * source value is skipped and no value is ever forwarded.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A predicate that always returns `true`, causing all source values
 * to be skipped.
 *
 * @returns
 * A signal operator function that never emits any value.
 *
 * @remarks
 * - This overload represents a statically non-emitting operator.
 * - The output signal will never produce a value.
 */
export function skipWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => true): SignalOperatorFunction<T, undefined>;
/**
 * Skips values from the source `Signal<T>` while the provided
 * `predicate` function returns `true`.
 *
 * The predicate is evaluated for each defined source value together
 * with its zero-based emission index. Once the predicate returns
 * `false`, all subsequent source values are forwarded unchanged.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A function that determines whether the current value should be skipped.
 *
 * @returns
 * A signal operator function that emits source values after the predicate
 * condition becomes `false`.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const skipped = signalPipe(
 *   source,
 *   [skipWhile(value => value < 5)]
 * );
 * ```
 *
 * @remarks
 * - Values are skipped while the predicate returns `true`.
 * - Once the predicate returns `false`, all following values are forwarded.
 */
export function skipWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean): SignalOperatorFunction<T, T | undefined>;
export function skipWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(skipWhile);
    const childScope = CleanupScope.assertCurrent(skipWhile).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let index = 0;
    let skip = true;

    subscribe(prevSource, (value) => {
      if (skip) {
        childScope.cleanup();
        skip = childScope.run(() => predicate(value, index++));
      }

      if (skip) { return; }
      nextSource.set(value);
    })

    return nextSource.asReadonly();
  }
}
