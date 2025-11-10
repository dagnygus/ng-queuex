import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { switchAll } from "./switch_all";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { CleanupScope, createTestCleanupScope } from '../../cleanup_scope/cleanup_scope';
import { subscribe } from '../../subscribe/subscribe';

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

describe('Testing switchAll() function', () => {

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
    const source = signal(signal(undefined));
    expect(() => switchAll()(source)).toThrowError(
      'switchAll(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw an error when it is used inside reactive context.', () => {
    const source = signal(signal(undefined));
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => switchAll()(source))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string | undefined> | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchAll<string | undefined>()(inputSource))

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(externalSource);
    externalSource.set('A');
    externalSource.set('B');

    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should switch between sources.', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string | undefined> | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchAll<string | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(externalSource1);
    externalSource1.set('A');
    inputSource.set(externalSource2);
    externalSource2.set('B');
    externalSource1.set('C');

    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should run cleanup logic between sources', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string> | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchAll<string | undefined>()(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(computed(() => {
      CleanupScope.assertCurrent().add(() => log.push('B'));
      return 'A'
    }));
    inputSource.set(signal('C'));

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should run cleanup logic after user immediate cleanup during external signal read.', () => {
    const log: string[] = [];
    const inputSource = signal<Signal<string> | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => switchAll<string | undefined>()(inputSource));

    inputSource.set(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return '';
    }));

    expect(log).toEqual([ 'A' ]);
  });

});
