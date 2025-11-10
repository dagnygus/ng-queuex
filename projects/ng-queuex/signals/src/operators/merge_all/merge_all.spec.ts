import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { mergeAll } from "./merge_all";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
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

describe('Testing mergeAll() function.', () => {

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
    const inputSource = signal(signal(undefined));
    expect(() => mergeAll()(inputSource)).toThrowError(
      'mergeAll(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(signal(undefined));
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => mergeAll()(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string | undefined> | undefined>(undefined);
    const scope = createTestCleanupScope();
    const externalSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => mergeAll<string | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(externalSource);
    externalSource.set('A');
    externalSource.set('B');
    externalSource.set('C');

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should work correctly with multiple external signals.', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string | undefined> | undefined>(undefined);
    const scope = createTestCleanupScope();
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);

    const outputSource = scope.run(() => mergeAll<string | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(externalSource1);
    inputSource.set(externalSource2);

    externalSource1.set('A');
    externalSource2.set('B');
    externalSource1.set('C');
    externalSource2.set('D');

    expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
  });

  it('Should run cleanup logic after user immediate cleanup during signal read.', () => {
    const log: string[] = [];
    const inputSource = signal(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    }));
    const scope = createTestCleanupScope();
    scope.run(() => mergeAll()(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

});
