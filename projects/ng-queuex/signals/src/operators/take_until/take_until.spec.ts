import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { takeUntil } from "./take_until";
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

describe('Testing takeUntil() function.', () => {
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
    expect(() => takeUntil(signal(undefined))(signal(undefined))).toThrowError(
      'takeUntil(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => takeUntil(signal(undefined))(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const notifier = signal(0);
    const outputSource = scope.run(() => takeUntil<number | undefined>(notifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    notifier.update((v) => ++v);
    inputSource.set(5);
    inputSource.set(6);

    expect(log).toEqual([ 1, 2, 3, 4 ]);
  });

  it('Should run root cleanup scope teardown logics when notifier emits.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const notifier = signal(0);
    scope.run(() => takeUntil<number | undefined>(notifier)(inputSource));

    scope.add(() => log.push('A'));

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    expect(log).toEqual([]);
    notifier.update((v) => ++v);
    expect(log).toEqual([ 'A' ]);
  });
});
