import { DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { window } from "./window";
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

describe('Testing window() function.', () => {

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
    const inputSource = signal(undefined);
    expect(() => window(signal(undefined))(inputSource)).toThrowError(
      'window(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => window(signal(undefined))(inputSource))).toThrowError());
  });

  it('Should project output source correctly.', () => {
    const intermediateSources: Signal<string | undefined>[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const windowBoundary = signal(0);
    const outputSource = scope.run(() => window<string | undefined>(windowBoundary)(inputSource));

    subscribe(outputSource, (value) => intermediateSources.push(value), destroyRef);

    expect(intermediateSources.length).toBe(1);
    expect(intermediateSources[0]()).toBeUndefined();
    inputSource.set('A');
    expect(intermediateSources[0]()).toBe('A');
    inputSource.set('B');
    expect(intermediateSources[0]()).toBe('B');
    windowBoundary.update((v) => ++v);
    expect(intermediateSources.length).toBe(2);
    expect(intermediateSources[1]()).toBeUndefined();
    inputSource.set('C');
    expect(intermediateSources[0]()).toBe('B');
    expect(intermediateSources[1]()).toBe('C');
    inputSource.set('D');
    expect(intermediateSources[0]()).toBe('B');
    expect(intermediateSources[1]()).toBe('D');
    windowBoundary.update((v) => ++v);
    expect(intermediateSources.length).toBe(3);
    expect(intermediateSources[2]()).toBeUndefined();
    inputSource.set('E');
    expect(intermediateSources[0]()).toBe('B');
    expect(intermediateSources[1]()).toBe('D');
    expect(intermediateSources[2]()).toBe('E');
    inputSource.set('F');
    expect(intermediateSources[0]()).toBe('B');
    expect(intermediateSources[1]()).toBe('D');
    expect(intermediateSources[2]()).toBe('F');
  })

});
