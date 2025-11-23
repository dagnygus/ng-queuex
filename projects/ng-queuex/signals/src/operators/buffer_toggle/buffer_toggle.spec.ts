import { computed, DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { bufferToggle } from "./buffer_toggle";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
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

describe('Testing bufferToggle function.', () => {
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
    const openings = signal(1);
    expect(() => bufferToggle(openings, () => signal(1))(inputSource)).toThrowError(
      'bufferToggle(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context', () => {
    const inputSource = signal(undefined);
    const openings = signal(1);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => bufferToggle(openings, () => signal(1))(inputSource))).toThrowError());
  });

  it('Should project output signal correctly', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(1);
    const closingNotifier = signal(1);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
  });

  it('Should skip first inner emissions before opening.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    openings.update((v) => ++v);
    inputSource.set('C');
    inputSource.set('D');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'C', 'D' ]
    ]);

  });

  it('Should buffers two arrays with one shared item.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier1 = signal(0);
    const closingNotifier2 = signal(0);
    const scope = createTestCleanupScope();

    let closingNotifier = closingNotifier1;

    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    closingNotifier = closingNotifier2;
    openings.update((v) => ++v);
    inputSource.set('C');
    closingNotifier1.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    closingNotifier2.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'C', 'D', 'E' ]
    ]);
  });

  it('Should buffers two arrays with one gap between.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier1 = signal(0);
    const closingNotifier2 = signal(0);
    const scope = createTestCleanupScope();

    let closingNotifier = closingNotifier1;

    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    closingNotifier1.update((v) => ++v);
    inputSource.set('C');
    closingNotifier = closingNotifier2;
    openings.update((v) => ++v);
    inputSource.set('D');
    inputSource.set('E');
    closingNotifier2.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A', 'B' ],
      [ 'D', 'E' ]
    ]);
  });

  it('Should not emit arrays with same set of items right after each other.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => closingNotifier)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);
    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
    ]);
  });

  it('Closing notifier should run in child cleanup scope', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();

    let closingSelectorUsed = false;

    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => {
      expect(scope.children().includes(CleanupScope.assertCurrent() as any)).toBeTrue();
      closingSelectorUsed = true;
      return closingNotifier;
    })(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
      [ 'A', 'B', 'C' ],
    ]);

    expect(closingSelectorUsed).toBeTrue();
  })

  it('Should close and dismiss buffer if cleanup scope gets cleaned in closing selector.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => {
      CleanupScope.assertCurrent().cleanup();
      return closingNotifier;
    })(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
    ]);
  });

  it('Should close and dismiss buffer if cleanup scope gets cleaned in closing notifier.', () => {
    const log: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferToggle<string | undefined>(openings, () => {
      return computed(() => {
        CleanupScope.assertCurrent().cleanup();
        return closingNotifier();
      });
    })(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    openings.update((v) => ++v);
    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(log).toEqual([
      [],
    ]);
  });

  it('Should clean host cleanup scope if cleanup scope gets clean immediately during signal read.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const openings = signal(0);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();

    scope.add(() => log.push('A'));

    const outputSource = scope.run(() => bufferToggle<string | undefined>(computed(() => {
      CleanupScope.assertCurrent().cleanup();
      return openings();
    }), () => closingNotifier)(inputSource));

    subscribe(outputSource, () => {}, destroyRef);

    expect(log).toEqual([ 'A' ]);
  });
});
