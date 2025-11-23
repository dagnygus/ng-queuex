import { computed, DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { bufferWhen } from "./buffer_when";
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

describe('Testing bufferWhen() function.', () => {
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
    expect(() => bufferWhen(() => signal(undefined))(inputSource)).toThrowError(
      'bufferWhen(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => bufferWhen(() => signal(undefined))(inputSource))).toThrowError());
  });

  it('Should run closingSelector() function in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => bufferWhen(() => {
      log.push('A');
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return signal(undefined);
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should open buffer if source emits first defined value.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => bufferWhen(() => {
      log.push('A')
      return closingNotifier
    })(inputSource));

    inputSource.set('X');
    expect(log).toEqual([ 'A' ]);
  });

  it('Should close and flush buffer if closing notifier change value, and after that should open new buffer when main source emits value.', () => {
    const log: string[] = [];
    const buffers: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferWhen(() => {
      log.push('X')
      return closingNotifier
    })(inputSource));


    subscribe(outputSource, (buf) => buffers.push(buf as any), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    expect(log).toEqual([ 'X' ]);
    expect(buffers).toEqual([
      []
    ]);

    closingNotifier.update((v) => ++v);
    expect(buffers).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);

    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');

    expect(log).toEqual([ 'X', 'X' ]);
    expect(buffers).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
    closingNotifier.update((v) => ++v);
    expect(buffers).toEqual([
      [],
      [ 'A', 'B', 'C' ],
      [ 'D', 'E', 'F' ],
    ]);
  });


  it('Should clear and not emit buffer when if child cleanup scope gets clean by user.', () => {
    const log: string[] = [];
    const buffers: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();

    let childScope: CleanupScope = null!;

    const outputSource = scope.run(() => bufferWhen(() => {
      childScope = CleanupScope.assertCurrent();
      childScope.add(() => log.push('X'));
      return closingNotifier
    })(inputSource));

    subscribe(outputSource, (buf) => buffers.push(buf as any), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    childScope.cleanup();
    closingNotifier.update((v) => ++v);

    expect(buffers).toEqual([
      []
    ]);
    expect(log).toEqual([ 'X' ]);
  });

  it('Should run cleanup logic after user immediate cleanup during closing notifier read.', () => {
    const log: string[] = [];
    const buffers: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();


    const outputSource = scope.run(() => bufferWhen(() => {
      return computed(() => {
        CleanupScope.assertCurrent().cleanup();
        CleanupScope.assertCurrent().add(() => log.push('A'));
        return 0;
      })
    })(inputSource));

    subscribe(outputSource, (buf) => buffers.push(buf as any), destroyRef);

    inputSource.set('X');

    expect(buffers).toEqual([ [] ]);
    expect(log).toEqual([ 'A' ]);
  });

  it('Buffer with same items set as previous should not be emitted.', () => {
    const buffers: string[][] = [];
    const inputSource = signal<string | undefined>(undefined);
    const closingNotifier = signal(0)
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => bufferWhen(() => closingNotifier)(inputSource));

    subscribe(outputSource, (buf) => buffers.push(buf as any), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(buffers).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');
    closingNotifier.update((v) => ++v);

    expect(buffers).toEqual([
      [],
      [ 'A', 'B', 'C' ]
    ]);
  });
});
