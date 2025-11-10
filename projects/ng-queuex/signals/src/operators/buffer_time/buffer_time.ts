import { assertNotInReactiveContext, signal } from "@angular/core"
import { arrayEquals, NG_DEV_MODE, SignalOperatorFunction } from "../../common"
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { Schedulers } from "../../schedulers/schedulers";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Collects values emitted by the source `Signal<T>` into arrays (buffers)
 * that are emitted periodically based on time or buffer size.
 *
 * Each buffer collects values for the specified `bufferTimeSpan` duration
 * before being emitted and replaced with a new one. New buffers can also
 * be created periodically according to `bufferCreationInterval`, allowing
 * multiple overlapping or skipped buffers depending on configuration.
 *
 * If `maxBufferSize` is provided, a buffer will emit and close early when
 * it reaches the specified size, even if its time span has not yet elapsed.
 *
 * The first emitted value is always an empty array (`[]`), representing the
 * initial empty buffer before any source values are collected.
 *
 *
 * @param bufferTimeSpan
 * The amount of time (in milliseconds) each buffer collects values before it is emitted.
 *
 * @param bufferCreationInterval
 * The interval (in milliseconds) at which to start new buffers.
 * If not specified, a new buffer is created immediately after the previous one is emitted,
 * meaning buffers do not overlap.
 *
 * @param maxBufferSize
 * The maximum number of values a buffer can hold before it is emitted early.
 *
 * @returns
 * A signal operator that emits arrays of collected values over time.
 *
 * @example
 * ```ts
 * const clicks = signal(0);
 *
 * const buffered = signalPipe(
 *   clicks,
 *   [ bufferTime(2000) ]
 * );
 * // Emits every 2 seconds: arrays of click values received in that period.
 * ```
 *
 * @example
 * ```ts
 * const values = signal(0);
 *
 * const overlapping = signalPipe(
 *   values,
 *   [ bufferTime(2000, 1000) ]
 * );
 * // Starts a new buffer every 1s, each lasting 2s — buffers overlap.
 * ```
 *
 * @remarks
 * - Each buffer runs independently and may overlap with others.
 * - Buffers are emitted as soon as they expire by time or reach `maxBufferSize`.
 * - Initial `undefined` value is ignored.
 * - Buffer with same items set as previous will not be emitted.
 */
export function bufferTime<T>(bufferTimeSpan: number, bufferCreationInterval?: number, maxBufferSize?: number): SignalOperatorFunction<T, Exclude<T, undefined>[]> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(bufferTime);

    bufferTimeSpan = Math.max(0, bufferTimeSpan);
    bufferCreationInterval = typeof bufferCreationInterval === 'number' ? Math.max(0, bufferCreationInterval) : bufferTimeSpan;
    maxBufferSize = typeof maxBufferSize === 'number' ? Math.max(1, Math.floor(maxBufferSize)) : undefined;

    const scope = CleanupScope.assertCurrent(bufferTime);
    const schedulers = scope.injector.get(Schedulers);
    const nextSource = signal<Exclude<T, undefined>[]>([], { equal: arrayEquals });
    const buffers: [Exclude<T, undefined>[], VoidFunction][] = [];

    let cleaned = false;

    scope.add(() => {
      cleaned;
    });

    subscribe(prevSource, (value) => {
      for (let i = 0; i < buffers.length; i++) {
        const [buf, cleanup] = buffers[i];

        if (maxBufferSize == null) {

          buf.push(value);

        } else if (buf.length < maxBufferSize) {

          buf.push(value);

          if (buf.length === maxBufferSize) {
            buffers.splice(i, 1);
            i--;
            nextSource.set(buf);
            cleanup();
            scope.remove(cleanup);
          }

        }
      }
    });

    if (cleaned) { return nextSource.asReadonly(); }

    const startBuffer = () => {
      let buffer: [Exclude<T, undefined>[], VoidFunction] = [[], null!];

      const timeoutCleanup = schedulers.setTimeout(() => {
        scope.remove(timeoutCleanup);
        const index = buffers.indexOf(buffer);
        if (index === -1) { return; }
        buffers.splice(index, 1);
        nextSource.set(buffer[0]);
      }, bufferTimeSpan);

      buffer[1] = timeoutCleanup;
      buffers.push(buffer);
      scope.add(timeoutCleanup);
    };

    startBuffer();

    const intervalCleanup = schedulers.setInterval(() => {
      schedulers.allowTaskRegistration = false;
      startBuffer();
      schedulers.allowTaskRegistration = true;
    }, bufferCreationInterval);

    scope.add(intervalCleanup);

    return nextSource.asReadonly();
  }
}
