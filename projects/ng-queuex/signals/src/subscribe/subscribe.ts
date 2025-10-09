import { assertInInjectionContext, assertNotInReactiveContext, DestroyRef, inject, Injector, Signal } from "@angular/core";
import { ReactiveHookFn, ReactiveNode, REACTIVE_NODE, setPostSignalSetFn, consumerDestroy, consumerPollProducersForChange, consumerAfterComputation, consumerBeforeComputation, isInNotificationPhase, consumerMarkDirty, setActiveConsumer } from "@angular/core/primitives/signals";
import { NG_DEV_MODE } from "../common";
import { CleanupScope } from "../cleanup_scope/cleanup_scope";

interface SubscriptionNode extends ReactiveNode {
  hook: ReactiveHookFn;
  prevHook: ReactiveHookFn | null;
  node: ReactiveNode | null;
  destroyed: boolean
  source: Signal<any>
  teardownLogics: VoidFunction[],
  fn: Function | null
  run(): void;
  destroy(): void;
  cleanup(): void;
}

/**
 * Description of the unsubscribe function.
 */
export interface UnsubscribeFunction {

  (): void;

  /**
   * Adds extra logic that will be executed when unsubscribe runs.
   * @param teardownLogic An extra logic that will be executed when unsubscribe runs.
   */
  add(teardownLogic: VoidFunction): void;

  /**
   * Removes previous added teardown logic
   * @param teardownLogic
   */
  remove(teardownLogic: VoidFunction): void;
}

function hook(this: SubscriptionNode, node: ReactiveNode) {
  this.node = node
  this.run();
}

const SUBSCRIPTION_NODE: Partial<SubscriptionNode> = /* @__PURE__ */ (() => {
  return {
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: true,
    consumerMarkedDirty: (node: SubscriptionNode) => {
      node.prevHook = setPostSignalSetFn(node.hook)
    },
    run(this: SubscriptionNode) {
      try {
        setPostSignalSetFn(this.prevHook);
        if (this.prevHook) {
            const prevHook = this.prevHook;
            prevHook(this.node!);
          }
      } finally {
        if (this.fn === null) {
          // trying to run a destroyed watch is noop
          return;
        }

        if (isInNotificationPhase()) {
          throw new Error(
            NG_DEV_MODE
              ? 'Schedulers cannot synchronously execute watches while scheduling.'
              : '',
          );
        }

        this.dirty = false;
        if (this.version > 0 && !consumerPollProducersForChange(this)) {
          return;
        }

        this.version++;

        if (this.version <= 0) {
          this.version = 2 as any
        }

        const prevConsumer = consumerBeforeComputation(this);
        try {
          const value = this.source();
          if (this.version > 1 && typeof value === 'undefined') {
            throw new Error('subscribe(): Source signal has been set to undefined!');
          }
          if (typeof value !== 'undefined') {
            const fn = this.fn;
            const prevConsumer = setActiveConsumer(null);
            try {
              fn(value);
            } finally {
              setActiveConsumer(prevConsumer);
            }
          }
        } finally {
          consumerAfterComputation(this, prevConsumer);
        }
      }
    },
    destroy(this: SubscriptionNode) {
      this.destroyed = true;
      consumerDestroy(this);
      this.fn = null;
      this.cleanup();
    },
    cleanup(this: SubscriptionNode) {
      try {
        while (this.teardownLogics.length) {
          this.teardownLogics.shift()!();
        }
      } finally {
        if (this.teardownLogics.length) {
          this.cleanup();
        }
      }
    }
  };
})();

/**
 * An effect for observing single signal in synchronous way. This function can be used only
 * in injection context or cleanup scope. If current stack frame is in both at the same time,
 * cleanup logic will be attached to cleanup scope. Whoever if current stack frame is not in
 * required context, then 'DestroyRef' object is required as third argument.
 *
 * @param source A source signal to observe.
 * @param next A callback that will be used when source signal change.
 */
export function subscribe<T>(source: Signal<T>, next: (value: Exclude<T, undefined>) => void): UnsubscribeFunction;
/**
 * An effect for observing single signal in synchronous way. This function can be used only
 * in injection context or in cleanup scope. If current stack frame is in both at the same time,
 * cleanup logic will be attached to cleanup scope. Whoever if current stack frame is not in
 * required contexts, then 'DestroyRef' object is required as third argument.
 *
 * @param source A source signal to observe.
 * @param next A callback that will be used when source signal change.
 * @param destroyRef An object of type `DestroyRef`
 */
export function subscribe<T>(source: Signal<T>, next: (value: Exclude<T, undefined>) => void, destroyRef: DestroyRef | null): UnsubscribeFunction;
export function subscribe<T>(source: Signal<T>, next: (value: Exclude<T, undefined>) => void, destroyRef: DestroyRef | null = null): UnsubscribeFunction {
  NG_DEV_MODE && assertNotInReactiveContext(subscribe);

  const cleanupScope = CleanupScope.current();

  if (NG_DEV_MODE && !cleanupScope && !destroyRef) {
    assertInInjectionContext(subscribe);
  }

  const node = Object.create(SUBSCRIPTION_NODE) as SubscriptionNode;
  node.hook = hook.bind(node);
  node.fn = next;
  node.source = source;
  node.teardownLogics = [];

  const unsubscribe = function() {
    node.destroy();
  } as unknown as UnsubscribeFunction

  unsubscribe.add = function(teardownLogic) {
    if (node.destroyed) { return; }
    node.teardownLogics.push(teardownLogic);
  }

  unsubscribe.remove = function(teardownLogic) {
    const index = node.teardownLogics.indexOf(teardownLogic);
    if (index > -1) {
      node.teardownLogics.splice(index, 1);
    }
  }

  if (cleanupScope) {
    cleanupScope.add(unsubscribe);
  } else {
    if (!destroyRef) {
      destroyRef = inject(DestroyRef);
    }
    destroyRef.onDestroy(unsubscribe);
  }

  consumerMarkDirty(node);
  node.run();

  return unsubscribe;
}
