import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { takeWhile } from "./take_while";
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

describe('Testing takeWhile() function.', () => {
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
    expect(() => takeWhile(() => true)(signal(undefined))).toThrowError(
      'takeWhile(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => takeWhile(() => true)(signal(undefined)))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSignal = scope.run(() => takeWhile<number | undefined>((value) => value < 5)(inputSource));
    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);
    inputSource.set(6);
    inputSource.set(7);

    expect(log).toEqual([ 0, 1, 2, 3, 4 ]);
  });

  it('Should emit value that causes predicate to return false if inclusive is set to true.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSignal = scope.run(() => takeWhile<number | undefined>((value) => value < 5, true)(inputSource));
    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    inputSource.set(4);
    inputSource.set(5);

    expect(log).toEqual([ 0, 1, 2, 3, 4, 5 ]);
  });

  it('Should run predicate() function in child cleanup scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSignal = signal(0);
    scope.run(() => takeWhile<number>((value) => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return value < 5;
    })(inputSignal));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should run teardown logics of root cleanup scope if predicate return false.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    scope.add(() => log.push('A'));
    scope.run(() => takeWhile<number | undefined>((value) => value < 2)(inputSource));

    inputSource.set(0);
    inputSource.set(1);
    expect(log).toEqual([]);
    inputSource.set(2);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should provide value index correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    scope.run(() => takeWhile<number | undefined>((value, index) => {
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
});
