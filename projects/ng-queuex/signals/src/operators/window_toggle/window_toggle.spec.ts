import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { windowToggle } from "./window_toggle";
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

describe('Testing windowToggle() function.', () => {
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
    expect(() => windowToggle(signal(undefined), () => signal(undefined))(signal(undefined))).toThrowError(
      'windowToggle(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context', () => {
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => windowToggle(signal(undefined), () => signal(undefined))(signal(undefined)))).toThrowError());
  });

  it('Should project output source correctly.', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => closingNotifier)(inputSource))

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);
    openings.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');
    closingNotifier.update((v) => ++v);
    openings.update((v) => ++v);
    inputSource.set('G');
    inputSource.set('H');
    inputSource.set('I');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [ 'A', 'B', 'C' ],
      [ 'D', 'E', 'F' ],
      [ 'G', 'H', 'I' ],
    ]);
  });

  it('Should skip first inner emissions before opening.', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => closingNotifier)(inputSource))

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    openings.update((v) => ++v);
    inputSource.set('C');

    expect(log).toEqual([
      [ 'C' ]
    ]);
  });

  it('Should windows have shared one element', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier1 = signal(0);
    const closingNotifier2 = signal(0);
    const closingNotifier3 = signal(0);
    const scope = createTestCleanupScope();

    let closingNotifier = closingNotifier1;
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    closingNotifier = closingNotifier2;
    openings.update((v) => ++v);
    inputSource.set('C');
    closingNotifier1.update((v) => ++v);
    inputSource.set('D');
    closingNotifier = closingNotifier3;
    openings.update((v) => ++v);
    inputSource.set('E');
    closingNotifier2.update((v) => ++v);
    inputSource.set('F');
    inputSource.set('G');

    expect(log).toEqual([
      [ 'A', 'B', 'C' ],
      [ 'C', 'D', 'E' ],
      [ 'E', 'F', 'G' ]
    ])
  });

  it('Should emit two windows with one gap between.', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    closingNotifier.update((v) => ++v);
    inputSource.set('C');
    openings.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');

    expect(log).toEqual([
      [ 'A', 'B' ],
      [ 'D', 'E' ],
    ]);
  });

  it('Closing notifier should run in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowToggle(openings, () => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return signal(undefined)
    })(inputSource));

    openings.update((v) => ++v);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should close and dismiss window if cleanup scope gets cleaned in closing selector.', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => {
      CleanupScope.assertCurrent().cleanup();
      return signal(undefined);
    })(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([]);
  });

  it('Should close and dismiss window if cleanup scope gets cleaned in closing notifier.', () => {
    const log: string[][] = [];
    const innerSources: Signal<string | undefined>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowToggle<string | undefined, number>(openings, () => computed(() => {
      CleanupScope.assertCurrent().cleanup();
      return undefined
    }))(inputSource));

    subscribe(outputSource, (s) => {
      const index = innerSources.length;
      innerSources.push(s);
      log.push([]);
      subscribe(s, (value) => log[index].push(value), destroyRef);
    }, destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([]);
  });

  it('Should run cleanup logic if cleanup scope gets clean immediate in closing selector.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowToggle<string | undefined, number>(openings, () => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return closingNotifier;
    })(inputSource));

    openings.update((v) => ++v);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic if cleanup scope gets clean immediate in closing notifier.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowToggle<string | undefined, number>(openings, () => computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return closingNotifier();
    }))(inputSource));

    openings.update((v) => ++v);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should clean host cleanup scope if cleanup scope gets clean immediately during signal read.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const scope = createTestCleanupScope({ onCleanup: () => log.push('A') });
    scope.run(() => windowToggle<string | undefined, number>(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      return openings();
    }), () => signal(undefined))(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should emit open values.', () => {
    const log: string[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const openings = signal<string | undefined>(undefined);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowToggle<number | undefined, string | undefined>(openings, (openValue) => {
      log.push(openValue);
      return closingNotifier;
    })(inputSource));

    openings.set('A');
    inputSource.set(0);
    closingNotifier.update((v) => ++v);
    openings.set('B');
    inputSource.set(1);
    closingNotifier.update((v) => ++v);
    openings.set('C');
    inputSource.set(2);
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should child cleanup scope be destroyed after cleanup.', () => {
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowToggle<string | undefined, number>(openings, () => signal(undefined))(inputSource));
    openings.update((v) => ++v);

    const childScope = scope.children()[0];
    childScope.cleanup();
    expect(childScope.destroyed).toBeTrue();
  });
});
