import { computed, DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { debounce } from "./debounce";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";
import { audit } from "rxjs";

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

describe('Testing debounce() function.', () => {

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
    expect(() => debounce(() => signal(undefined))(signal(undefined))).toThrowError(
      'audit(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => debounce(() => signal(undefined))(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const durationNotifier1 = signal(0);
    const durationNotifier2 = signal(0);
    const durationNotifier3 = signal(0);
    const durationNotifier4 = signal(0);
    const durationNotifier5 = signal(0);
    const durationNotifier6 = signal(0);

    let durationNotifier = durationNotifier1;
    const outputSource = scope.run(() => debounce<string | undefined>(() => durationNotifier)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    durationNotifier1.update((v) => ++v);
    durationNotifier = durationNotifier2;
    expect(log).toEqual([ 'A' ]);
    inputSource.set('B');
    durationNotifier = durationNotifier3;
    inputSource.set('C');
    durationNotifier2.update((v) => ++v);
    expect(log).toEqual([ 'A' ]);
    durationNotifier3.update((v) => ++v);
    expect(log).toEqual([ 'A', 'C' ]);
    durationNotifier = durationNotifier4;
    inputSource.set('D');
    durationNotifier = durationNotifier5;
    inputSource.set('E');
    durationNotifier = durationNotifier6;
    inputSource.set('F');
    durationNotifier4.update((v) => ++v);
    durationNotifier5.update((v) => ++v);
    expect(log).toEqual([ 'A', 'C' ]);
    durationNotifier6.update((v) => ++v);
    expect(log).toEqual([ 'A', 'C', 'F' ]);
  });

  it('Should run durationSelector() function in child cleanup scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => debounce(() => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return signal(undefined);
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic after when cleanup scope gets immediate cleaned in durationSelector() function.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => debounce(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return signal(undefined);
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic after cleanup scope gets cleaned during duration notifier read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => debounce(() => computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return undefined;
    }))(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should not subscribe to duration notifier if cleanup scope gets immediate cleaned in durationSelector() function.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal('A');
    const durationNotifier = signal(0);
    const outputSource = scope.run(() => debounce<string>(() => {
      CleanupScope.assertCurrent().cleanup();
      return durationNotifier;
    })(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);
    durationNotifier.update((v) => ++v);
    expect(log).toEqual([]);
  });

})
