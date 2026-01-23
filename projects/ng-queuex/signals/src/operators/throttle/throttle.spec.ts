import { computed, DestroyableInjector, DestroyRef, Injector, input, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { throttle } from "./throttle";
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

describe('Testing throttle() function.', () => {

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
    expect(() => throttle(() => signal(undefined))(signal(undefined))).toThrowError(
      'audit(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => throttle(() => signal(undefined))(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal('A');
    const durationNotifier = signal(0);
    const outputSignal = scope.run(() => throttle<string>(() => durationNotifier)(inputSource));

    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    expect(log).toEqual(['A']);

    inputSource.set('B');
    inputSource.set('C');
    durationNotifier.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    durationNotifier.update((v) => ++v);
    inputSource.set('G');

    expect(log).toEqual([ 'A', 'D', 'G' ]);
  });

  it('Duration notifier should be omitted until current active duration notifier will change its own value', () => {
      const log: string[] = [];
      const scope = createTestCleanupScope();
      const inputSource = signal<undefined | string>(undefined);
      const durationNotifier1 = signal(0);
      const durationNotifier2 = signal(0);

      let durationNotifier = durationNotifier1
      const outputSignal = scope.run(() => throttle<string | undefined>(() => durationNotifier)(inputSource));

      subscribe(outputSignal, (value) => log.push(value), destroyRef);

      inputSource.set('A');
      inputSource.set('B');
      durationNotifier = durationNotifier2
      expect(log).toEqual(['A']);
      durationNotifier2.update((v) => ++v);
      inputSource.set('C');
      expect(log).toEqual(['A']);
      durationNotifier1.update((v) => ++v);
      inputSource.set('D');
      expect(log).toEqual([ 'A', 'D' ]);
      inputSource.set('E');
      expect(log).toEqual([ 'A', 'D' ]);
      durationNotifier2.update((v) => ++v);
      inputSource.set('F');
      expect(log).toEqual([ 'A', 'D', 'F']);
    });

  it('Should run durationSelector() function in child cleanup scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(0);
    scope.run(() => throttle(() => {
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
    scope.run(() => throttle(() => {
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
    scope.run(() => throttle(() => computed(() => {
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
    const outputSource = scope.run(() => throttle<string>(() => {
      CleanupScope.assertCurrent().cleanup();
      return durationNotifier;
    })(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    expect(log).toEqual([ 'A' ]);
    inputSource.set('B');
    inputSource.set('C');
    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

});
