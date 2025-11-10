import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { filter } from "./filter";
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

describe('Testing filter() function', () => {

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
    expect(() => filter(() => true)(inputSource)).toThrowError(
      'filter(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used in reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => filter(() => true)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => filter<number | undefined>((value) => value % 2 === 0)(inputSource));

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

    expect(log).toEqual([ 2, 4, 6, 8, 10 ]);
  });

  it('Should run project function in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => filter<string | undefined>((value) => {
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      log.push(value);
      return true;
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic on every value change.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => filter<string | undefined>((value) => {
      CleanupScope.assertCurrent().add(() => log.push('B'))
      log.push(value)
      return true;
    })(inputSource));

    inputSource.set('A');
    inputSource.set('C');
    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should run cleanup logic after user immediate cleanup in predicate() function body.', () => {
    const log: string[] = [];
    const inputSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => filter(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return true;
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

});
