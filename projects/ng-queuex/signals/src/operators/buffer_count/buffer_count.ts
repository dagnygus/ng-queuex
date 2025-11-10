import { assertNotInReactiveContext, signal } from "@angular/core";
import { arrayEquals, NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Collects values emitted by the source `Signal<T>` into arrays of a specified size,
 * emitting each buffer when it reaches the given `count`. The first emitted value
 * is always an empty array, providing an initial defined state.
 *
 * When `startBufferEvery` is provided, new buffers start every specified number of
 * emissions, allowing overlapping or sliding windows of values.
 *
 * @param count
 * The number of values to collect before emitting a buffered array.
 *
 * @param startBufferEvery
 * The interval (in number of emissions) at which to start a new buffer.
 * Defaults to the same value as `count`.
 *
 * @returns
 * A signal operator function that emits arrays containing up to `count`
 * most recent defined values from the source signal.
 *
 * @example
 * ```ts
 * const value = signal<number | undefined>(undefined);
 *
 * const buffered = signalPipe(
 *   value,
 *   [bufferCount(3)]
 * );
 *
 * effect(() => console.log(buffered())); // log: []
 *
 * value.set(1);
 * value.set(2);
 * value.set(3); // log: [1, 2, 3]
 * value.set(4);
 * value.set(5);
 * value.set(6); // log: [4, 5, 6]
 * ```
 *
 * @remarks
 * - The first emitted value is always an empty array.
 * - Use `startBufferEvery` to control how often new buffers begin.
 * - Useful for batching or sliding-window computations in reactive logic.
 * - Buffer with same items set as previous will not be emitted.
 */
export function bufferCount<T>(count: number, startBufferEvery?: number): SignalOperatorFunction<T, Exclude<T, undefined>[]> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(bufferCount) && assertNotInReactiveContext(bufferCount);
    count = Math.max(1, Math.floor(count));
    const startEvery = typeof startBufferEvery === 'number' ? Math.max(1, Math.floor(startBufferEvery)) : count;
    const nextSource = signal<Exclude<T, undefined>[]>([], { equal: arrayEquals });
    const buffers: Exclude<T, undefined>[][] = [ [] ];
    let emissionIndex = 0;

    subscribe(prevSource, (value) => {
      if (emissionIndex === startEvery) {
        emissionIndex = 0;
        buffers.push([]);
      }
      emissionIndex++;

      for (let i = 0; i < buffers.length; i++) {
        buffers[i].push(value);
      }

      if (buffers[0] && buffers[0].length === count) {
        nextSource.set(buffers.shift()!);
      }
    });

    return nextSource.asReadonly();
  }
}
