import { assertInInjectionContext, assertNotInReactiveContext, DestroyRef, inject, isSignal, Signal } from "@angular/core";
import { ReactiveHookFn, ReactiveNode, createWatch, setPostSignalSetFn, setActiveConsumer, Watch } from "@angular/core/primitives/signals";
import { NG_DEV_MODE } from "../utlils";

/**
 * Represents reference to value directly provided by `set` method or
 * to the most recent value of provided signal. In case of signal, it allows safely
 * access to recent value in notification faze without touching internal signal node.
 */
export interface ValueRef<T> {

  /**
   * The underlying value.
   */
  readonly value: T

  /**
   * Updates the value.
   *
   * If plain value is provided, directly sets the underlying value.
   * If signal is provided, reference will fallow that signal.
   *
   * @param value A new value or signal to observe and extracts values in synchronic way.
   */
  set(value: T | Signal<T>): void
}

interface InternalValueRef<T> extends ValueRef<T> {
  __watcher__: Watch | null;
  __value__: T;
}

const BASE_VALUE_REF = {
  set(this: InternalValueRef<any>, value: any | Signal<any>) {
    if (this.__watcher__) { this.__watcher__.destroy(); }
    if (isSignal(value)) {
      this.__watcher__ = watchSignal(value, (v) => this.__value__ = v);
      return;
    }
    this.__value__ = value;
  },
  get value() {
    return (this as any).__value__;
  }
}

export function watchSignal<T>(source: Signal<T>, callback: (arg: T) => void): Watch {
  let prevHook: ReactiveHookFn | null = null;
  let node: ReactiveNode | null = null;
  const hook: ReactiveHookFn = (n) => {
    node = n;
    watcher.run();
  }
  const watcher = createWatch(
    () => {
      setPostSignalSetFn(prevHook);
      if (prevHook) {
        prevHook(node!);
      }
      const value = source();
      const prevConsumer = setActiveConsumer(null);
      try {
        callback(value);
      } finally {
        setActiveConsumer(prevConsumer);
      }
    },
    () => {
      prevHook = setPostSignalSetFn(hook);
    },
    true
  );
  watcher.notify();
  watcher.run();

  return watcher;
}

/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @throws Error if is used not in injection context.
 * @throws Error if is used in reactive context.
 */
export function value<T>(initialValue: T | Signal<T>): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param destroyRef The object that implements `DestroyRef` abstract class.
 * @throws Error if is used in reactive context.
 *
 * @see {@link DestroyRef}
 */
export function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param debugName Optional developer-friendly label for debugging purposes.
 * @throws Error if is used not in injection context.
 * @throws Error if is used in reactive context.
 */
export function value<T>(initialValue: T | Signal<T>, debugName: string | undefined): ValueRef<T>;
/**
 * Creates a value reference.
 *
 * A `ValueRef` is a lightweight wrapper that always exposes
 * the most recent value of either:
 *   - a plain value of type `T`, or
 *   - a reactive `Signal<T>`.
 *
 * Unlike reading a signal directly, accessing `.value` on a `ValueRef`
 * is always safe — even during the signal notification phase, when
 * normal signal reads are disallowed. The reference never touches
 * the internal signal node and does not participate in dependency tracking.
 *
 * The `set()` method does not update the underlying signal. Instead,
 * it rebinds the `ValueRef` to a new value or to another signal.
 *
 * @param initialValue The initial value or signal to bind.
 * @param destroyRef The object that implements `DestroyRef` abstract class.
 * @param debugName Optional developer-friendly label for debugging purposes.
 * @throws Error if is used in reactive context.
 *
 * @see {@link DestroyRef}
 */
export function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef, debugName: string | undefined): ValueRef<T>;
export function value<T>(initialValue: T | Signal<T>, arg2?: any, arg3?: any): ValueRef<T> {
  (NG_DEV_MODE) &&
    assertNotInReactiveContext(value);

  let destroyRef: DestroyRef | null = null;
  let debugName = 'ValueRef'

  if (typeof arg2 === 'object' && typeof arg2.onDestroy === 'function' && typeof arg2.destroyed === 'boolean') {
    destroyRef = arg2
  }

  if (typeof arg2 === 'string') { debugName = arg2; }
  if (typeof arg3 === 'string') { debugName = arg3; }

  if (!destroyRef) {
    (NG_DEV_MODE) &&
      assertInInjectionContext(value);
    destroyRef = inject(DestroyRef);
  }

  const ref = Object.create(BASE_VALUE_REF) as InternalValueRef<T>;
  ref.__value__ = undefined!;
  ref.__watcher__ = null;
  ref.set(initialValue);

  if (NG_DEV_MODE) {
    (ref as any).toString = () => `[ValueRef.value: ${ref.__value__}]`;
    (ref as any).debugName = debugName;
  }


  destroyRef.onDestroy(() => {
    if(ref.__watcher__) {
      ref.__watcher__.destroy();
    }
  });

  return ref;
}
