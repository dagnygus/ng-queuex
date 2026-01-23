import { DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { windowCount } from "./window_count";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../signals";

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

describe('Testing windowCount() function.', () => {
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

  it('Should throw error of it is used outside cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => windowCount(5)(inputSource)).toThrowError(
      'windowCount(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => windowCount(5)(inputSource))).toThrowError());
  });

  it('Should project output source correctly.', () => {
    const intermediateSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowCount<string | undefined>(3)(inputSource));

    subscribe(outputSource, (value) => intermediateSources.push(value), destroyRef);

    expect(intermediateSources.length).toBe(1);
    expect(intermediateSources[0]()).toBeUndefined();
    inputSource.set('A');
    expect(intermediateSources[0]()).toBe('A');
    inputSource.set('B');
    expect(intermediateSources[0]()).toBe('B');
    inputSource.set('C');
    expect(intermediateSources[0]()).toBe('C');
    expect(intermediateSources.length).toBe(2);
    expect(intermediateSources[1]()).toBeUndefined();
    inputSource.set('D');
    expect(intermediateSources[0]()).toBe('C');
    expect(intermediateSources[1]()).toBe('D');
    inputSource.set('E');
    expect(intermediateSources[0]()).toBe('C');
    expect(intermediateSources[1]()).toBe('E');
    inputSource.set('F');
    expect(intermediateSources[0]()).toBe('C');
    expect(intermediateSources[1]()).toBe('F');
    expect(intermediateSources.length).toBe(3);
    expect(intermediateSources[2]()).toBeUndefined();
  })
})
