import { Injector, DestroyRef, DestroyableInjector, signal, computed } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { buffer } from "./buffer";
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

describe('Testing buffer() function.', () => {

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
    const notifier = signal(0);
    expect(() => buffer(notifier)(inputSource)).toThrowError(
      'buffer(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const notifier = signal(0);
    const scope = createTestCleanupScope();

    scope.run(() => expect(() => runInReactiveContext(() => buffer(notifier)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: (string[])[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const notifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => buffer<string | undefined>(notifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    notifier.update((v) => ++v);
    inputSource.set('B');
    inputSource.set('C');
    notifier.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    notifier.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A' ],
      [ 'B', 'C' ],
      [ 'D', 'E', 'F' ]
    ]);
  });

  it('Should run cleanup logic after user immediate cleanup during signal read.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const notifier = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });

    const scope = createTestCleanupScope();
    scope.run(() => buffer<string | undefined>(notifier)(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Buffer with same items set as previous should not be emitted.', () => {
    const log: (string[])[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const notifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => buffer<string | undefined>(notifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    notifier.update((value) => ++value);
    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    notifier.update((value) => ++value);
    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
  });
})
