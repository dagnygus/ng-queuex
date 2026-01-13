import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalMonoTypeOperatorFunction, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Forwards values from the source `Signal<T>` while the provided
 * `predicate` function returns `true`.
 *
 * The predicate is evaluated for each defined source value along with
 * its zero-based emission index. When the predicate returns `false`,
 * the pipeline is deinitialized.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A function that determines whether the current value should be forwarded.
 *
 * @returns
 * A signal operator function that emits source values while the predicate
 * condition holds.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const limited = signalPipe(
 *   source,
 *   [takeWhile((value, index) => value < 5)]
 * );
 * ```
 *
 * @remarks
 * - The pipeline is deinitialized as soon as the predicate returns `false`.
 * - The pipeline is re-initialized only after all consumers are removed
 *   and a new active consumer is registered.
 */
export function takeWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean): SignalOperatorFunction<T, T | undefined>;
/**
 * Forwards values from the source `Signal<T>` while the provided
 * `predicate` function returns `true`.
 *
 * The predicate is evaluated for each defined source value along with
 * its zero-based emission index. When the predicate returns `false`,
 * the pipeline is deinitialized. If `inclusive` is set to `true`,
 * the value that caused the predicate to return `false` is emitted
 * before deinitialization.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A function that determines whether the current value should be forwarded.
 *
 * @param inclusive
 * Whether to emit the value that causes the predicate to return `false`
 * before deinitializing the pipeline.
 *
 * @returns
 * A signal operator function that emits source values while the predicate
 * condition holds.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const limited = signalPipe(
 *   source,
 *   [takeWhile((value, index) => value < 5)]
 * );
 * ```
 *
 * @remarks
 * - The pipeline is deinitialized as soon as the predicate returns `false`.
 * - When `inclusive` is `true`, the terminating value is emitted once.
 * - The pipeline is re-initialized only after all consumers are removed
 *   and a new active consumer is registered.
 */
export function takeWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean, inclusive: true): SignalMonoTypeOperatorFunction<T>;
/**
 * Forwards values from the source `Signal<T>` while the provided
 * `predicate` function returns `true`.
 *
 * The predicate is evaluated for each defined source value along with
 * its zero-based emission index. When the predicate returns `false`,
 * the pipeline is deinitialized. If `inclusive` is set to `true`,
 * the value that caused the predicate to return `false` is emitted
 * before deinitialization.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param predicate
 * A function that determines whether the current value should be forwarded.
 *
 * @param inclusive
 * Whether to emit the value that causes the predicate to return `false`
 * before deinitializing the pipeline.
 *
 * @returns
 * A signal operator function that emits source values while the predicate
 * condition holds.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const limited = signalPipe(
 *   source,
 *   [takeWhile((value, index) => value < 5)]
 * );
 * ```
 *
 * @remarks
 * - The pipeline is deinitialized as soon as the predicate returns `false`.
 * - When `inclusive` is `true`, the terminating value is emitted once.
 * - The pipeline is re-initialized only after all consumers are removed
 *   and a new active consumer is registered.
 */
export function takeWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean, inclusive: boolean): SignalOperatorFunction<T, T | undefined>;
export function takeWhile<T>(predicate: (value: Exclude<T, undefined>, index: number) => boolean, inclusive: boolean = false): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(takeWhile);
    const scope = CleanupScope.assertCurrent(takeWhile);
    const childScope = scope.createChild();
    const nextSource = signal<any>(undefined);

    let index = 0
    subscribe(prevSource, (value) => {
      childScope.cleanup();
      const prediction = childScope.run(() => predicate(value, index++));
      if (prediction) {
        nextSource.set(value);
      } else {
        if (inclusive) {
          nextSource.set(value);
        }
        scope.cleanup();
      }
    });

    return nextSource.asReadonly();
  }
}
