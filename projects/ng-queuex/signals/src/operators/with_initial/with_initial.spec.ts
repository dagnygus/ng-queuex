import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { withInitial } from "./with_initial";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";

function runInReactiveContext(fn: VoidFunction): ReactiveNode {
  const consumer = Object.create(REACTIVE_NODE) as ReactiveNode;
  consumer.dirty = true;
  (consumer as any).consumerIsAlwaysLive = true;
  const prevConsumer = consumerBeforeComputation(consumer);
  try {
    fn();
  } finally {
    consumerAfterComputation(consumer, prevConsumer);
  }
  return consumer;
}

describe('Testing withInitial() function', () => {

  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  });

  it('Should throw error if it is used outside cleanup scope.', () => {
    expect(() => withInitial(0)(signal(undefined))).toThrowError(
      'withInitial(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => withInitial(0)(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const scope = createTestCleanupScope();
    const inputSource = signal(undefined);
    const outputSource = scope.run(() => withInitial('A')(inputSource));

    expect(outputSource()).toBe('A');
  });

});
