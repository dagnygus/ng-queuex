import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { take } from "./take";
import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
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

describe('Testing take() function.', () => {
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
    expect(() => take(5)(signal(undefined))).toThrowError(
      'take(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => take(5)(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = []
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSource = scope.run(() => take<number | undefined>(5)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);
    inputSource.set(10);

    expect(log).toEqual([ 1, 2, 3, 4, 5 ]);
  });

  it('Should run root cleanup scope teardown logics when input signal will reach given count emissions.', () => {
    const log: string[] = []
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    scope.run(() => take<number | undefined>(5)(inputSource));

    scope.add(() => log.push('A'));

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([ 'A' ]);
  });
});
