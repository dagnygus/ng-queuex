import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { mergeWith } from "./merge_with";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
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

describe('Testing mergeWith() function.', () => {

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
    expect(() => mergeWith(signal(undefined))(inputSource)).toThrowError(
      'mergeWith(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope  = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => mergeWith(signal(undefined))(inputSource))).toThrowError());
  });

  it('Should merge with additional signal.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => mergeWith<string | undefined, [Signal<string | undefined>]>(externalSource)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set('A');
    externalSource.set('B');
    externalSource.set('C');
    inputSource.set('D');

    expect(log).toEqual([ 'A', 'B', 'C', 'D' ]);
  });

  it('Should merge with multiple additional signals.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => mergeWith<string | undefined, [Signal<string | undefined>, Signal<string | undefined>]>(externalSource1, externalSource2)(inputSource))

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set('A');
    externalSource1.set('B');
    externalSource2.set('C');
    externalSource2.set('D');
    externalSource1.set('E');
    inputSource.set('F');

    expect(log).toEqual([ 'A', 'B', 'C', 'D', 'E', 'F' ]);
  });

  it('Should run cleanup logic after user immediate cleanup during signal read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    const externalSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });

    const outputSource = scope.run(() => mergeWith(externalSource)(inputSource));

    expect(log).toEqual(['A']);
  })

});
