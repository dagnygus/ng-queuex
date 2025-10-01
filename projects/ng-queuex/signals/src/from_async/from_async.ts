import { computed, signal, Signal } from "@angular/core";
import { createContextAwareSignal } from "../context_aware_signal/context_aware_signal";
import { CleanupScope } from "../signals";
import { setActiveConsumer } from "@angular/core/primitives/signals";
import type { Observable, Subscribable, Unsubscribable } from "rxjs";

/**
 * Options passed to `fromAsync()` creation function.
 */
export interface CreateFromAsyncOptions {

  /**
   * A callback that will be used when error accurse.
   */
  onError: (e: any) => void;

  /**
   * A debug name for the signal. Used in Angular DevTools to identify the signal.
   */
  debugName: string;
}


/**
 * Creates a signal from object of type `PromiseLike`.
 * @param asyncSource A source that will be used to retrieved data.
 */
export function fromAsync<T>(asyncSource: PromiseLike<T>): Signal<T>;
/**
 * Creates a signal from object of type `PromiseLike`.
 * @param asyncSource A source that will be used to retrieved data.
 * @param debugName A debug name for the signal. Used in Angular DevTools to identify the signal.
 */
export function fromAsync<T>(asyncSource: PromiseLike<T>, debugName: string | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`.
 * @param asyncSource A source that will be used to retrieved data.
 * @param onError A callback that will be used when error accurse.
 */
export function fromAsync<T>(asyncSource: PromiseLike<T>, onError: ((e: any) => void) | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`.
 * @param asyncSource A source that will be used to retrieved data.
 * @param options A `fromAsync` creation options.
 *
 * @see {@link CreateFromAsyncOptions}
 */
export function fromAsync<T>(asyncSource: PromiseLike<T>, options: CreateFromAsyncOptions | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`. When signal is read for the fist time then signal internally
 * invokes provided function and subscribes to `PromiseLike` object returned from that function.
 * in reactive context like effect() or component template.
 * @param asyncSource A source that will be used to retrieved data.
 */
export function fromAsync<T>(asyncSource: () => PromiseLike<T>): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`. When signal is read for the fist time then signal internally
 * invokes provided function and subscribes to `PromiseLike` object returned from that function.
 * @param asyncSource A source that will be used to retrieved data.
 * @param debugName A debug name for the signal. Used in Angular DevTools to identify the signal.
 */
export function fromAsync<T>(asyncSource: () => PromiseLike<T>, debugName: string | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`. When signal is read for the fist time then signal internally
 * invokes provided function and subscribes to `PromiseLike` object returned from that function.
 * @param asyncSource A source that will be used to retrieved data.
 * @param onError A callback that will be used when error accurse.
 */
export function fromAsync<T>(asyncSource: () => PromiseLike<T>, onError: ((e: any) => void) | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `PromiseLike`. When signal is read for the fist time then signal internally
 * invokes provided function and subscribes to `PromiseLike` object returned from that function.
 * @param asyncSource A source that will be used to retrieved data.
 * @param options A `fromAsync` creation options.
 *
 * @see {@link CreateFromAsyncOptions}
 */
export function fromAsync<T>(asyncSource: () => PromiseLike<T>, options: CreateFromAsyncOptions | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 */
export function fromAsync<T>(asyncSource: Observable<T>): Signal<T | undefined>;
/**
 *  Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param debugName A debug name for the signal. Used in Angular DevTools to identify the signal.
 */
export function fromAsync<T>(asyncSource: Observable<T>, debugName: string | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param onError A callback that will be used when error accurse.
 */
export function fromAsync<T>(asyncSource: Observable<T>, onError: ((e: any) => void) | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param options A `fromAsync` creation options.
 *
 * @see {@link CreateFromAsyncOptions}
 */
export function fromAsync<T>(asyncSource: Observable<T>, options: CreateFromAsyncOptions | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 */
export function fromAsync<T>(asyncSource: Subscribable<T>): Signal<T | undefined>;
/**
 *  Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param debugName A debug name for the signal. Used in Angular DevTools to identify the signal.
 */
export function fromAsync<T>(asyncSource: Subscribable<T>, debugName: string | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param onError A callback that will be used when error accurse.
 */
export function fromAsync<T>(asyncSource: Subscribable<T>, onError: ((e: any) => void) | undefined): Signal<T | undefined>;
/**
 * Creates a signal from object of type `Subscribable`. This signal can be read only in reactive context like effect() or component template.
 * This signal internally subscribed to 'Subscribable' source when first reactive consumer appears (e.g. effect(), component template etc..)
 * and unsubscribes when last consumer is destroyed. After that again when new consumer appears, signal subscribes to it's source again.
 * @param asyncSource A source that will be used to retrieved data.
 * @param options A `fromAsync` creation options.
 *
 * @see {@link CreateFromAsyncOptions}
 */
export function fromAsync<T>(asyncSource: Subscribable<T>, options: CreateFromAsyncOptions | undefined): Signal<T | undefined>;
export function fromAsync(asyncSource: any, arg?: string | ((e: any) => void) | CreateFromAsyncOptions): Signal<any> {
  let debugName: string | undefined;
  let onError: ((e: any) => void) | null = null;

  if (typeof arg === 'string') {
    debugName = arg;
  } else if (typeof arg === 'function') {
    onError = arg;
  } else if (typeof arg === 'object') {
    debugName = arg.debugName;
    onError = arg.onError;
  }


  if (typeof asyncSource === 'function') {
    return fromAsync_1(asyncSource, onError, debugName);
  } else if (typeof asyncSource.then === 'function') {
    return fromAsync_2(asyncSource, onError, debugName);
  } else if (typeof asyncSource.subscribe === 'function') {
    return fromAsync_3(asyncSource, onError, debugName);
  }

  throw new Error(`fromAsync(): Invalid argument! asyncSource: ${asyncSource}`);
}

function fromAsync_1<T>(asyncSource: () => PromiseLike<T>, onError: ((e: any) => void) | null, debugName: string | undefined): Signal<T | undefined> {
  let unprepared = true
  const valueSource = signal<T | undefined>(undefined, debugName ? { debugName } : undefined);

  return computed(() => {
    if (unprepared) {
      const consumer = setActiveConsumer(null);
      try {
        unprepared = false;
        asyncSource().then(
          (value) => {
            valueSource.set(value);
          },
          (e) => {
            onError?.(e);
            CleanupScope.current()?.cleanup();
          }
        );
      } finally {
        setActiveConsumer(consumer);
      }
    }

    return valueSource();
  })
}

function fromAsync_2<T>(asyncSource: PromiseLike<T>, onError: ((e: any) => void) | null, debugName: string | undefined): Signal<T | undefined> {
  const valueSource = signal<T | undefined>(undefined, debugName ? { debugName } : undefined);

  asyncSource.then(
    (value: T) => {
      valueSource.set(value);
    },
    (e) => {
      onError?.(e);
      CleanupScope.current()?.cleanup();
    }
  )

  return valueSource.asReadonly();
}

function fromAsync_3<T>(asyncSource: Subscribable<T>, onError: ((e: any) => void) | null, debugName: string | undefined): Signal<T | undefined> {
  let subscription: Unsubscribable = null!;

  return createContextAwareSignal<T | undefined>(
    undefined,
    (set) => {
      subscription = asyncSource.subscribe({
        next(value) {
          set(value);
        },
        error(e) {
          onError?.(e);
          CleanupScope.current()?.cleanup();
        }
      })
    },
    () => {
      subscription.unsubscribe();
    },
    fromAsync,
    debugName
  )
}
