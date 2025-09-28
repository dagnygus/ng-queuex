import { producerAccessed, producerIncrementEpoch, runPostProducerCreatedFn, SIGNAL, SIGNAL_NODE, SignalNode, signalSetFn } from "@angular/core/primitives/signals";
import { CleanupScope } from "../cleanup_scope/cleanup_scope";
import { assertInReactiveContextOrInCleanupScope, NG_DEV_MODE } from "../shared";
import { Signal } from "@angular/core";

export const enum ContextAwareSignalStatus {
  Preparing = 0,
  Prepared = 1,
  Unprepared = 2
}

export interface ContextAwareSignalNode<T> extends SignalNode<T> {
  scopeRefCount: number;
  status: ContextAwareSignalStatus
  increaseScopeRefCount: VoidFunction;
  decreaseScopeRefCount: VoidFunction;
  init: VoidFunction;
  deinit: VoidFunction;
  onInit: (set: (value: T) => void, update: (updater: (value: T) => T) => void) => void;
  onDeinit: VoidFunction
  __consumers__: unknown
}

// for node.decreaseScopeRefCount = decreaseScopeRefCount.bind(node)
function decreaseScopeRefCount(this: ContextAwareSignalNode<any>) {
  if (--this.scopeRefCount === 0 && this.__consumers__ == null) {
    this.deinit();
  }
}

const CONTEXT_AWARE_SIGNAL_NODE: Partial<ContextAwareSignalNode<any>> = /* @__PURE__ */(() => ({
  ...SIGNAL_NODE,

  increaseScopeRefCount(this: ContextAwareSignalNode<any>) {
    if (++this.scopeRefCount === 1 && this.__consumers__ == null) {
      this.init();
    }
  },
  init(this: ContextAwareSignalNode<any>) {
    if (NG_DEV_MODE && this.status === ContextAwareSignalStatus.Prepared) {
      throw new Error('InternalError:[node.init()] Context aware node is already prepared!');
    }
    this.status = ContextAwareSignalStatus.Preparing;

    const node = this;
    const signalSet = function(value: any) {
      if (NG_DEV_MODE && node.status === ContextAwareSignalStatus.Unprepared) {
        throw new Error('Unprepared signal can not be updated!');
      }

      if (node.status === ContextAwareSignalStatus.Preparing) {
        node.value = value
        return
      }

      signalSetFn(node, value);
    }

    const signalUpdate = function(updater: (value: any) => any) {
      if (NG_DEV_MODE && node.status === ContextAwareSignalStatus.Unprepared) {
        throw new Error('Unprepared signal can not be updated!');
      }

      if (node.status === ContextAwareSignalStatus.Preparing) {
        const newValue = updater(node.value);
        node.value = newValue
        return
      }

      signalSetFn(node, updater(node.value));
    }

    this.onInit(signalSet, signalUpdate);
    this.status = ContextAwareSignalStatus.Prepared;
  },
  deinit(this: ContextAwareSignalNode<any>) {
    if (NG_DEV_MODE && this.status === ContextAwareSignalStatus.Unprepared) {
      throw new Error('InternalError:[node.deinit()] Context aware node is already unprepared!');
    }
    this.onDeinit()
    this.status =  ContextAwareSignalStatus.Unprepared;
  }
}))();

Object.defineProperty(CONTEXT_AWARE_SIGNAL_NODE, 'consumers', {
  get(this: ContextAwareSignalNode<any>) {
    return this.__consumers__;
  },
  set(this: ContextAwareSignalNode<any>, value: unknown) {
    const prevValue = this.__consumers__;
    this.__consumers__ = value;

    if (this.scopeRefCount === 0) {
      if (prevValue == null && value != null) {
        this.init();
      } else if (prevValue != null && value == null) {
        this.deinit();
      }
    }
  }
})

export function createContextAwareSignal<T>(
  initialValue: T,
  onInit: (set: (value: T) => void, update: (fn: (value: T) => T) => void) => void,
  onDeinit: () => void,
  debugFn: Function = createContextAwareSignal,
  debugName?: string | undefined
): Signal<T> {

  const node = Object.create(CONTEXT_AWARE_SIGNAL_NODE) as ContextAwareSignalNode<T>;
  node.value = initialValue;
  node.scopeRefCount = 0;
  node.status = ContextAwareSignalStatus.Unprepared
  node.__consumers__ = undefined;
  node.onInit = onInit;
  node.onDeinit = onDeinit;
  node.decreaseScopeRefCount = decreaseScopeRefCount.bind(node);

  const signalFn = function() {

    NG_DEV_MODE && assertInReactiveContextOrInCleanupScope(
      'Signal created by ' + debugFn.name + '() can not read outside required context. It ' +
      'This signal can only be used appropriately in a reactive context like effect() or ' +
      'component template. It can be also used in cleanup scope provided by signalPipe().'
    );

    producerAccessed(node);

    const scope = CleanupScope.current();

    if (scope) {
      node.increaseScopeRefCount();
      scope.add(node.decreaseScopeRefCount);
    }

    return node.value;
  } as Signal<T>;

  signalFn[SIGNAL] = node;

  runPostProducerCreatedFn(node);

  if (NG_DEV_MODE) {
    signalFn.toString = () => `[Signal: ${signalFn()}]`;
    node.debugName = debugName
  }

  return signalFn;
}
