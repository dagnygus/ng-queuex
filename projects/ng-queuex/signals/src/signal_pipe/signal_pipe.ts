import { ComputedNode, consumerAfterComputation, consumerBeforeComputation, defaultEquals, producerAccessed, producerUpdateValueVersion, REACTIVE_NODE, runPostProducerCreatedFn, setActiveConsumer, SIGNAL } from '@angular/core/primitives/signals';
import { assertInInjectionContext, DestroyRef, inject, Injector, Signal } from '@angular/core';
import { DefaultCleanupScope, setCleanupScope, CleanupScope } from '../cleanup_scope/cleanup_scope';
import { SignalOperatorFunction, NG_DEV_MODE, assertInReactiveContextOrInCleanupScope } from '../common';

/**
 * Options passed to the `signalPipe()` creation function.
 */
export interface CreateSignalPipeOptions {

  /** Optional debug label for tracing. */
  debugName?: string;

  /** An injector if the signal must to be created outside injection context */
  injector?: Injector;
}

export interface SignalPipeNode<T> extends ComputedNode<T> {
  pipeline: SignalOperatorFunction<any, any>[];
  inputSource: Signal<any> | null;
  outputSource: Signal<any> | null;
  cleanupScope: DefaultCleanupScope;
  scopeRefCount: number;
  oldValue: any;
  allowInit: boolean;
  initializing: boolean;
  deinitializeAfterInitialization: boolean
  decreaseScopeRefCount(): void
  init(): void;
  deinit(): void;
  destroy(): void;
  __consumers__: unknown;
}

const UNSET: any = /* @__PURE__ */ Symbol('UNSET');
const COMPUTING: any = /* @__PURE__ */ Symbol('COMPUTING');
const ERRORED: any = /* @__PURE__ */ Symbol('ERRORED');

type KeysToOmit =
  'pipeline' |
  'inputSource' |
  'outputSource' |
  'cleanupScope' |
  'scopeRefCount' |
  'decreaseScopeRefCount' |
  '__consumers__' |
  'value' |
  'oldValue' |
  'dirty' |
  'error' |
  'allowInit' |
  'initializing' |
  'deinitializeAfterInitialization'

function decreaseScopeRefCount(this: SignalPipeNode<any>) {
  if (--this.scopeRefCount === 0 && this.__consumers__ == null) {
    this.deinit();
    if (this.inputSource) {
      this.allowInit = true;
    }
  }
}

const SIGNAL_PIPE_NODE: Omit<SignalPipeNode<any>, KeysToOmit> = /* @__PURE__ */ (() => ({
  ...REACTIVE_NODE,
  equal: defaultEquals,
  kind: 'computed',
  producerMustRecompute(node: SignalPipeNode<any>) {
    return node.value === UNSET || node.value === COMPUTING || node.allowInit;
  },
  producerRecomputeValue(node: SignalPipeNode<any>) {
    if (node.value === COMPUTING) {
      throw new Error('Detected cycle in computations.');
    }

    const oldValue = node.oldValue = node.value;
    node.value = COMPUTING;

    const prevConsumer = consumerBeforeComputation(node);
    let newValue: unknown;
    let wasEqual = false;
    try {
      newValue = node.computation();
      if (node.deinitializeAfterInitialization) {
        node.deinitializeAfterInitialization = false;
        node.deinit();
      }
      // We want to mark this node as errored if calling `equal` throws; however, we don't want
      // to track any reactive reads inside `equal`.
      setActiveConsumer(null);
      wasEqual =
        oldValue !== UNSET &&
        oldValue !== ERRORED &&
        newValue !== ERRORED &&
        node.equal(oldValue, newValue);
    } catch (err) {
      newValue = ERRORED;
      node.error = err;
    } finally {
      consumerAfterComputation(node, prevConsumer);
    }

    if (wasEqual) {
      // No change to `valueVersion` - old and new values are
      // semantically equivalent.
      node.value = oldValue;
      return;
    }

    node.value = newValue;
    node.oldValue = newValue;
    node.version++;
  },
  computation(this: SignalPipeNode<any>) {
    const node = this;
    if (node.inputSource) {
      if (this.outputSource === null) {
        if (!this.allowInit) { return node.oldValue; }

        node.cleanupScope.add(function() {
          if (node.initializing) {
            node.deinitializeAfterInitialization = true;
          } else {
            node.deinit();
          }
        });
        node.init();
      }
      return node.outputSource!();
    } else if (node.oldValue === UNSET) {
      node.error = new Error(`Signal pipe ${this.debugName ? this.debugName + ' ' : ''}was destroyed before the first read! Computation is impossible.`);
      return ERRORED;
    } else {
      return node.oldValue;
    }
  },
  init(this: SignalPipeNode<any>) {
    if (this.inputSource) {
      this.initializing = true;
      const consumer = setActiveConsumer(null);
      const prevScope = setCleanupScope(this.cleanupScope);
      try {
          let outputSource = this.inputSource;
          for (let i = 0; i < this.pipeline.length; i++) {
            outputSource = this.pipeline[i](outputSource);
          }
          this.outputSource = outputSource;
          this.allowInit = false;
      } finally {
        setActiveConsumer(consumer);
        setCleanupScope(prevScope);
        this.initializing = false;
      }
    }
  },
  deinit(this: SignalPipeNode<any>) {
    if (this.outputSource) {
      this.outputSource = null;
      this.cleanupScope.cleanup();
    }
  },
  destroy(this: SignalPipeNode<any>) {
    this.inputSource = null;
    this.deinit();
  },

}))();

Object.defineProperty(SIGNAL_PIPE_NODE, 'consumers', {
  get(this: SignalPipeNode<any>) {
    return this.__consumers__;
  },
  set(this: SignalPipeNode<any>, value: unknown) {
    const prevValue = this.__consumers__;
    this.__consumers__ = value;

    if (this.scopeRefCount === 0 && value == null && prevValue != null) {
      this.deinit();
      if (this.inputSource) {
        this.allowInit = true;
      }
    }
  }
});

/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn>(source: Signal<TIn>, pipeline: [], options?: CreateSignalPipeOptions): Signal<TIn>
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, TOut>
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T30, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T30, T31>,
    SignalOperatorFunction<T31, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, T46, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, T46>,
    SignalOperatorFunction<T46, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, T46, T47, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, T46>,
    SignalOperatorFunction<T46, T47>,
    SignalOperatorFunction<T47, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, T46, T47, T48, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, T46>,
    SignalOperatorFunction<T46, T47>,
    SignalOperatorFunction<T47, T48>,
    SignalOperatorFunction<T48, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, T46, T47, T48, T49, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, T46>,
    SignalOperatorFunction<T46, T47>,
    SignalOperatorFunction<T47, T48>,
    SignalOperatorFunction<T48, T49>,
    SignalOperatorFunction<T49, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<TIn, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20,
T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40,
T41, T42, T43, T44, T45, T46, T47, T48, T49, T50, TOut>(
  source: Signal<TIn>,
  pipeline: [
    SignalOperatorFunction<TIn, T1>,
    SignalOperatorFunction<T1, T2>,
    SignalOperatorFunction<T2, T3>,
    SignalOperatorFunction<T3, T4>,
    SignalOperatorFunction<T4, T5>,
    SignalOperatorFunction<T5, T6>,
    SignalOperatorFunction<T6, T7>,
    SignalOperatorFunction<T7, T8>,
    SignalOperatorFunction<T8, T9>,
    SignalOperatorFunction<T9, T10>,
    SignalOperatorFunction<T10, T11>,
    SignalOperatorFunction<T11, T12>,
    SignalOperatorFunction<T12, T13>,
    SignalOperatorFunction<T13, T14>,
    SignalOperatorFunction<T14, T15>,
    SignalOperatorFunction<T15, T16>,
    SignalOperatorFunction<T16, T17>,
    SignalOperatorFunction<T17, T18>,
    SignalOperatorFunction<T18, T19>,
    SignalOperatorFunction<T19, T20>,
    SignalOperatorFunction<T20, T21>,
    SignalOperatorFunction<T21, T22>,
    SignalOperatorFunction<T22, T23>,
    SignalOperatorFunction<T23, T24>,
    SignalOperatorFunction<T24, T25>,
    SignalOperatorFunction<T25, T26>,
    SignalOperatorFunction<T26, T27>,
    SignalOperatorFunction<T27, T28>,
    SignalOperatorFunction<T28, T29>,
    SignalOperatorFunction<T29, T30>,
    SignalOperatorFunction<T31, T32>,
    SignalOperatorFunction<T32, T33>,
    SignalOperatorFunction<T33, T34>,
    SignalOperatorFunction<T34, T35>,
    SignalOperatorFunction<T35, T36>,
    SignalOperatorFunction<T36, T37>,
    SignalOperatorFunction<T37, T38>,
    SignalOperatorFunction<T38, T39>,
    SignalOperatorFunction<T39, T40>,
    SignalOperatorFunction<T40, T41>,
    SignalOperatorFunction<T41, T42>,
    SignalOperatorFunction<T42, T43>,
    SignalOperatorFunction<T43, T44>,
    SignalOperatorFunction<T44, T45>,
    SignalOperatorFunction<T45, T46>,
    SignalOperatorFunction<T46, T47>,
    SignalOperatorFunction<T47, T48>,
    SignalOperatorFunction<T48, T49>,
    SignalOperatorFunction<T49, T50>,
    SignalOperatorFunction<T50, TOut>,
  ],
  options?: CreateSignalPipeOptions
): Signal<TOut>;
/**
 * Creates a new signal by sequentially applying a series of operator functions
 * to a given source signal. This signal can be created in an injection context
 * or a {@link CleanupScope} context provided by another `signalPipe()` pipeline.
 * This signal can only be read in a reactive context like `effect()` or a component
 * template (also within another `signalPipe()` pipeline). When this signal is read
 * for the first time in a reactive context, it will be initialized with the provided pipeline.
 *
 * Each operator receives a signal and returns a new derived signal.
 * Operators are applied in the order they are provided. Operators
 * always run in a {@link CleanupScope} context. Each time the last reactive
 * consumer of this signal gets destroyed, the {@link CleanupScope} will run teardown
 * logic. After that, when a new reactive consumer appears, the signal will be
 * reinitialized with the provided pipeline. However, if the host injector is destroyed,
 * this signal will also be destroyed and reinitialization will be disabled.
 *
 * @param source The source signal that provides the initial value.
 * @param pipeline A tuple of signal operators.
 * @param options An optional parameter for signal creation options.
 *
 * @throws Error when the signal is read for the first time after it has been destroyed.
 *
 * @see {@link CleanupScope}
 */
export function signalPipe<T>(
  source: Signal<T>,
  pipeline: any[],
  options?: CreateSignalPipeOptions
): Signal<any>;
export function signalPipe<T>(
  source: Signal<T>,
  pipeline: any[],
  options?: CreateSignalPipeOptions
): Signal<any> {
  const parentScope = CleanupScope.current();

  NG_DEV_MODE && !parentScope?.injector && !options?.injector && assertInInjectionContext(signalPipe);

  const debugName = options?.debugName;
  const injector = parentScope?.injector ?? options?.injector ?? inject(Injector);
  const ownScope = new DefaultCleanupScope(injector);

  pipeline = pipeline.slice() as any;

  const node  = Object.create(SIGNAL_PIPE_NODE) as SignalPipeNode<any>;

  node.value = UNSET
  node.oldValue = undefined;
  node.dirty = true;
  node.error = null;
  node.allowInit = true;
  node.initializing = false;
  node.deinitializeAfterInitialization = false
  node.pipeline = pipeline as any;
  node.cleanupScope = ownScope;
  node.scopeRefCount = 0;
  node.__consumers__ = undefined;
  node.inputSource = source;
  node.outputSource = null;
  node.decreaseScopeRefCount = decreaseScopeRefCount.bind(node);

  if (parentScope) {
    parentScope.add(function() { node.destroy() });
  } else {
    injector.get(DestroyRef).onDestroy(function() {
      node.destroy();
    });
  }


  const signalFn = function() {
    NG_DEV_MODE && assertInReactiveContextOrInCleanupScope(
      'Signal created by signalPipe() can not read outside required context. It ' +
      'This signal can only be used appropriately in a reactive context like effect() or ' +
      'component template. It can be also used in cleanup scope provided by signalPipe().'
    );

    if (!node.__consumers__ && !node.scopeRefCount && node.inputSource && !node.outputSource) {
      node.dirty = true;
    }

    producerUpdateValueVersion(node);
    producerAccessed(node);

    const scope = CleanupScope.current();

    if (scope) {
      node.scopeRefCount++;
      scope.add(node.decreaseScopeRefCount);
    }

    if (node.value === ERRORED) {
      throw node.error;
    }

    return node.value;
  } as Signal<any>

  signalFn[SIGNAL] = node;

  if (NG_DEV_MODE) {
    signalFn.toString = () => `[SignalPipe: ${signalFn()}]`;
    node.debugName = debugName;
  }

  runPostProducerCreatedFn(node);

  return signalFn;
}
