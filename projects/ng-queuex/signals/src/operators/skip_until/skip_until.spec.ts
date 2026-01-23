import { computed, DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { skipUntil } from "./skip_until";
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

describe('Testing skipUntil() function.', () => {
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
    expect(() => skipUntil(signal(undefined))(signal(undefined))).toThrowError(
      'skipUntil(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it used inside receive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => skipUntil(signal(undefined))(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const notifier = signal(0);
    const outputSource = scope.run(() => skipUntil<number | undefined>(notifier)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    notifier.update((v) => ++v);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);

    expect(log).toEqual([ 4, 5, 6 ]);
  });

  it('Should subscribe to notifier in child cleanup scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    scope.run(() => skipUntil(computed(() => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toEqual(scope.children()[0]);
      return undefined;
    }))(signal(undefined)));
    expect(log).toEqual([ 'A' ]);
  });

  it('Should forward all values if child cleanup scope gets cleaned immediate during notifier read.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSource = scope.run(() => skipUntil<number | undefined>(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      return undefined;
    }))(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([ 1, 2, 3, 4, 5 ]);
  });

  it('Should run child cleanup logic after child cleanup scope immediate cleanup during notifier read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    scope.run(() => skipUntil<number | undefined>(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return undefined;
    }))(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Child cleanup scope should be destroyed after cleanup', () => {
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);

    let childScope: CleanupScope = null!;
    scope.run(() => skipUntil<number | undefined>(computed(() => {
      childScope = CleanupScope.assertCurrent();
      return undefined;
    }))(inputSource));

    childScope.cleanup();
    expect(childScope.destroyed).toBeTrue();
  });
});
