import { ComputedNode, consumerAfterComputation, consumerBeforeComputation, defaultEquals, producerAccessed, producerUpdateValueVersion, REACTIVE_NODE, runPostProducerCreatedFn, setActiveConsumer, SIGNAL } from '@angular/core/primitives/signals';
import { assertInInjectionContext, DestroyRef, inject, Injector, Signal } from '@angular/core';
import { DefaultCleanupScope, setCleanupScope, CleanupScope } from '../cleanup_scope/cleanup_scope';
import { SignalOperatorFunction, NG_DEV_MODE, decreaseScopeRefCount, assertInReactiveContextOrInCleanupScope } from '../common';

export type IsValidPipe<In, Ops extends readonly any[]> =
  Ops extends []
    ? true
    : Ops extends [infer First, ...infer Rest]
      ? First extends SignalOperatorFunction<In, any>
        ? Rest extends readonly any[]
          ? First extends SignalOperatorFunction<In, infer Out>
              ? IsValidPipe<Out, Rest>
              : false
          : false
        : false
      : false;

export type EnsureChainable<In, Ops extends readonly SignalOperatorFunction<any, any>[]> =
  IsValidPipe<In, Ops> extends true ? Ops : ['PIPE_TYPE_MISMATCH', { expectedInput: In }];

type PipeResultValue<In, Ops extends readonly any[]> =
  Ops extends []
    ? In
    : Ops extends [infer First, ...infer Rest]
      ? First extends SignalOperatorFunction<In, any>
        ? First extends SignalOperatorFunction<In, infer Out>
          ? PipeResultValue<Out, Rest extends readonly any[] ? Rest : []>
          : never
        : never
      : never;

export interface CreateSignalPipeOptions {
  debugName?: string;
  injector?: Injector;
}

export interface SignalPipeNode<T> extends ComputedNode<T> {
  pipeline: SignalOperatorFunction<any, any>[];
  inputSource: Signal<any> | null;
  outputSource: Signal<any> | null;
  cleanupScope: DefaultCleanupScope;
  scopeRefCount: number;
  oldValue: any;
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
  'error'

const SIGNAL_PIPE_NODE: Omit<SignalPipeNode<any>, KeysToOmit> = /* @__PURE__ */ (() => ({
  ...REACTIVE_NODE,
  equal: defaultEquals,
  kind: 'computed',
  producerMustRecompute(node: SignalPipeNode<any>) {
    return node.value === UNSET || node.value === COMPUTING;
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
    if (this.inputSource) {
      if (this.outputSource === null) {
        this.init();
      }
      return this.outputSource!();
    } else if (this.oldValue === UNSET) {
      this.error = new Error(`Signal pipe ${this.debugName ? this.debugName + ' ' : ''}was destroyed before the first read! Computation is impossible.`)
      return ERRORED;
    } else {
      return this.oldValue;
    }
  },
  init(this: SignalPipeNode<any>) {
    this;
    if (this.inputSource) {
      const consumer = setActiveConsumer(null);
      const prevScope = setCleanupScope(this.cleanupScope);
      try {
          let outputSource = this.inputSource;
          for (let i = 0; i < this.pipeline.length; i++) {
            outputSource = this.pipeline[i](outputSource);
          }
          this.outputSource = outputSource;
      } finally {
        setActiveConsumer(consumer);
        setCleanupScope(prevScope);
      }
    }
  },
  deinit(this: SignalPipeNode<any>) {
    if (this.outputSource) {
      this.outputSource = null;
      this.cleanupScope._allowCleanup = true;
      this.cleanupScope.cleanup();
      this.cleanupScope._allowCleanup = false;
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
    }
  }
});

export function signalPipe<T, Ops extends readonly SignalOperatorFunction<any, any>[]>(
  source: Signal<T>,
  pipeline: EnsureChainable<T, Ops>,
  options?: CreateSignalPipeOptions
): Signal<PipeResultValue<T, Ops> >{
  const parentScope = CleanupScope.current();

  NG_DEV_MODE && !parentScope?.injector && !options?.injector && assertInInjectionContext(signalPipe);

  const debugName = options?.debugName;
  const injector = parentScope?.injector ?? options?.injector ?? inject(Injector);
  const ownScope = new DefaultCleanupScope(injector);

  ownScope._allowCleanup = false;
  pipeline = pipeline.slice() as any;

  const node  = Object.create(SIGNAL_PIPE_NODE) as SignalPipeNode<any>;

  node.value = UNSET
  node.oldValue = undefined;
  node.dirty = true;
  node.error = null;
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
    node.debugName = debugName
  }

  runPostProducerCreatedFn(node);

  return signalFn;
}
