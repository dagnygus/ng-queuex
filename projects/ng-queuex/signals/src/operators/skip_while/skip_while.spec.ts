import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { skipWhile } from "./skip_while";
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

describe('Testing skipWhile() function.', () => {
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
    expect(() => skipWhile(() => true)(signal(undefined))).toThrowError(
      'skipWhile(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => skipWhile(() => true)(signal(undefined)))).toThrowError())
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSource = scope.run(() => skipWhile<number | undefined>((value) => value < 5)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);
    inputSource.set(8);
    inputSource.set(9);

    expect(log).toEqual([ 5, 6, 7, 8, 9 ]);
  });

  it('Should run predicate() function in child cleanup scope', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => skipWhile(() => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return true;
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should provide value index correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource =  signal<number | undefined>(undefined);
    scope.run(() => skipWhile<number | undefined>((value, index) => {
      log.push(index);
      return value < 5;
    })(inputSource));

    inputSource.set(-5);
    inputSource.set(-4);
    inputSource.set(-3);
    inputSource.set(-2);
    inputSource.set(-1);
    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);

    expect(log).toEqual([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
  });

  it('Child scope should run cleanup logic between emitted values.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => skipWhile<number>(() => true)(inputSource));

    scope.children()[0].add(() => log.push('A'));
    inputSource.set(1);

    expect(log).toEqual([ 'A' ]);
  });
});
