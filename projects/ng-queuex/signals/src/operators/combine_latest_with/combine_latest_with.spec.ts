import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { combineLatestWith } from "./combine_latest_with";
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

describe('Testing combineLatestWith() function', () => {
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

  it('Should throw error if it is used outside cleanup context.', () => {
    const inputSource = signal(undefined);
    expect(() => combineLatestWith(signal(undefined))(inputSource)).toThrowError(
      'combineLatestWith(): Current stack frame is not within cleanup scope.'
    )
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => combineLatestWith(signal(undefined))(inputSource))).toThrowError());
  });

  it('Should combine with additional signal.', () => {
    const log: [string, string][] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal('A1');
    const externalSource = signal('B1');
    const outputSource = scope.run(() => combineLatestWith<string, [Signal<string>]>(externalSource)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set('A2');
    externalSource.set('B2');

    expect(log).toEqual([
      [ 'A1', 'B1' ],
      [ 'A2', 'B1' ],
      [ 'A2', 'B2' ],
    ]);
  });

  it('Should combine with multiple additional signals.', () => {
    const log: [string, string, string][] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal('A1');
    const externalSource1 = signal('B1');
    const externalSource2 = signal('C1');
    const outputSource = scope.run(() => combineLatestWith<string, [Signal<string>, Signal<string>]>(externalSource1, externalSource2)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef)
    inputSource.set('A2');
    externalSource1.set('B2');
    externalSource2.set('C2');

    expect(log).toEqual([
      [ 'A1', 'B1', 'C1' ],
      [ 'A2', 'B1', 'C1' ],
      [ 'A2', 'B2', 'C1' ],
      [ 'A2', 'B2', 'C2' ],
    ]);
  });

  it('Should run cleanup logic after user cleanup during external signal read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    const externalSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });
    scope.run(() => combineLatestWith(externalSource)(inputSource));

    expect(log).toEqual([ 'A' ]);
  })

});
