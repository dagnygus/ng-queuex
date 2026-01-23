import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { scan } from "./scan";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

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

describe('Testing scan function.', () => {

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
    expect(() => scan((acc) => acc, 0)(inputSource)).toThrowError(
      'scan(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => scan((acc) => acc, 0)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => scan<number | undefined, number>((acc, value) => acc + value, 0)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);

    expect(log).toEqual([ 0, 1, 3, 6 ]);
  });

  it('Should run accumulator() function inside child cleanup scope!', () => {
    const log: string[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => scan<number | undefined, number>((acc, value) => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return acc + value;
    }, 0)(inputSource));

    expect(log).toEqual([]);
    inputSource.set(1);
    expect(log).toEqual([ 'A' ]);
  });

});
