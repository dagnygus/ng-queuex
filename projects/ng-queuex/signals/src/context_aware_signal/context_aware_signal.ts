import { producerAccessed, SIGNAL, SIGNAL_NODE, SignalNode, signalSetFn, signalUpdateFn } from "@angular/core/primitives/signals";
import { CleanupScope } from "../cleanup_scope/cleanup_scope";
import { assertInReactiveContextXorInCleanupScope, NG_DEV_MODE } from "../utils";
import { Signal } from "@angular/core";

export interface ContextAwareSignalNode<T> extends SignalNode<T> {
  scopeRefCount: number;
  prepared: boolean;
  increaseScopeRefCount: VoidFunction;
  decreaseScopeRefCount: VoidFunction;
  init: VoidFunction;
  deinit: VoidFunction;
  onInit: (set: (value: T) => void, update: (fn: (value: T) => T) => void) => void;
  onDeinit: VoidFunction
  __consumers__: unknown

}

const CONTEXT_AWARE_SIGNAL_NODE: Partial<ContextAwareSignalNode<any>> = /* @__PURE__ */(() => ({
  ...SIGNAL_NODE,
  increaseScopeRefCount(this: ContextAwareSignalNode<any>) {
    this.scopeRefCount++;
  },
  decreaseScopeRefCount(this: ContextAwareSignalNode<any>) {
    if (this.__consumers__ == null && --this.scopeRefCount === 0) {
      this.deinit();
    }
  },
  init(this: ContextAwareSignalNode<any>) {
    if (NG_DEV_MODE && this.prepared) {
      throw new Error('InternalError:[node.init()] Context aware node is already prepared!');
    }

    const signalSet = (value: any) => {
      if (NG_DEV_MODE && !this.prepared) {
        throw new Error('Unprepared signals can not be updated!');
      }
      signalSetFn(this, value);
    }

    const signalUpdate = (fn: (value: any) => any) => {
      if (NG_DEV_MODE && !this.prepared) {
        throw new Error('Unprepared signals can not be updated!');
      }
      signalUpdateFn(this, fn);
    }

    this.onInit(signalSet, signalUpdate);
    this.prepared = true;
  },
  deinit(this: ContextAwareSignalNode<any>) {
    if (NG_DEV_MODE && !this.prepared) {
      throw new Error('InternalError:[node.deinit()] Context aware node is already unprepared!');
    }
    this.onDeinit()
    this.prepared = false;
  }
}))();

Object.defineProperty(CONTEXT_AWARE_SIGNAL_NODE, 'consumers', {
  get(this: ContextAwareSignalNode<any>) {
    return this.__consumers__;
  },
  set(this: ContextAwareSignalNode<any>, value: unknown) {
    this.__consumers__ = value
    if (value == null && this.scopeRefCount === 0) {
      this.deinit();
    }
  }
})

export function createContextAwareSignal<T>(
  initialValue: T,
  onInit: (set: (value: T) => void, update: (fn: (value: T) => T) => void) => void,
  onDeinit: () => void,
  errorMessage?: string | undefined,
): Signal<T> {

  const node = Object.create(CONTEXT_AWARE_SIGNAL_NODE) as ContextAwareSignalNode<T>;
  node.value = initialValue;
  node.scopeRefCount = 0;
  node.prepared = false
  node.__consumers__ = undefined;
  node.onInit = onInit;
  node.onDeinit = onDeinit;

  const signalGetter = function() {
    NG_DEV_MODE && assertInReactiveContextXorInCleanupScope(errorMessage ? errorMessage : '');

    producerAccessed(node);

    const scope = CleanupScope.current();

    if (scope) {
      node.increaseScopeRefCount();
      scope.add(node.decreaseScopeRefCount.bind(node));
    }

    node.init()

    return node.value;
  } as Signal<T>;

  signalGetter[SIGNAL] = node;

  return signalGetter;
}
