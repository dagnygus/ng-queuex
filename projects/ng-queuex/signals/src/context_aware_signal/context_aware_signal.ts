import { getActiveConsumer, producerAccessed, SIGNAL, SIGNAL_NODE, SignalNode, signalSetFn, signalUpdateFn } from "@angular/core/primitives/signals";
import { CleanupScope } from "../cleanup_scope/cleanup_scope";
import { NG_DEV_MODE } from "../utils";
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
  set: (value: T) => void;
  update: (fn: (value: T) => T) => void;
  __consumers__: unknown

}

const CONTEXT_AWARE_SIGNAL_NODE: Partial<ContextAwareSignalNode<any>> = /* @__PURE__ */(() => ({
  ...SIGNAL_NODE,
  increaseScopeRefCount(this: ContextAwareSignalNode<any>) {
    this.scopeRefCount++;
  },
  init(this: ContextAwareSignalNode<any>) {
    if (this.prepared) { return; }
    this.onInit(this.set.bind(this), this.update.bind(this));
    this.prepared = true;
  },
  deinit(this: ContextAwareSignalNode<any>) {
    if (this.prepared) {
      this.onDeinit()
    }
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
  onDeinit: () => void
): Signal<T> {

  const node = Object.create(CONTEXT_AWARE_SIGNAL_NODE) as ContextAwareSignalNode<T>;
  node.value = initialValue;
  node.scopeRefCount = 0;
  node.prepared = false
  node.__consumers__ = undefined;
  node.onInit = onInit;
  node.onDeinit = onDeinit;

  node.decreaseScopeRefCount = (function(this: ContextAwareSignalNode<any>) {
    if (this.__consumers__ == null && --this.scopeRefCount === 0) {
      this.deinit();
    }
  }).bind(node);

  node.set = function(this: ContextAwareSignalNode<any>, value) {
    if (NG_DEV_MODE && !this.prepared) {
      throw new Error('Unprepared signals can not be updated!')
    }
    signalSetFn(this, value);
  }

  node.update = function(this: ContextAwareSignalNode<any>, fn) {
    if (NG_DEV_MODE && !this.prepared) {
      throw new Error('Unprepared signals can not be updated!')
    }
    signalUpdateFn(this, fn);
  }

  const signalGetter = (function(this: ContextAwareSignalNode<any>) {
    if (NG_DEV_MODE) {
      if (getActiveConsumer() && CleanupScope.current()) {
        throw new Error(
          'Context aware signal can not be accessed in reactive context and cleanup scope at the same time!'
        );
      }

      if (!(getActiveConsumer() && CleanupScope.current())) {
        throw new Error(
          'Context aware signal can be accessed in reactive context or in cleanup scope (but not at the same time)!'
        );
      }
    }

    producerAccessed(this);

    const scope = CleanupScope.current();

    if (scope) {
      this.increaseScopeRefCount();
      scope.add(this.decreaseScopeRefCount);
    }

    this.init()

    return this.value;
  }).bind(node) as Signal<T>;

  signalGetter[SIGNAL] = node;

  return signalGetter;
}
