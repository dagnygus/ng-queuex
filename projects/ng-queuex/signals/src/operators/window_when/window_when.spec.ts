import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { windowWhen } from "./window_when";
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

describe('Testing windowWhen() function.', () => {
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
    const source = signal(undefined);
    expect(() => windowWhen(() => signal(undefined))(source)).toThrowError('windowWhen(): Current stack frame is not within cleanup scope.')
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const source = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => windowWhen(() => signal(undefined))(source))).toThrowError());
  });

  it('Should run closing selector in child cleanup scope.', () => {
    const log: string[] = [];
    const inputSource = signal(0);
    const scope = createTestCleanupScope();

    scope.run(() => windowWhen(() => {
      log.push('A');
      expect(CleanupScope.current()).toEqual(scope.children()[0]);
      return signal(undefined);
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should open window when if source emits defined value.', () => {
    const log: string[][] = [];
    const windows: Signal<string>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    let isOpen = false

    const outputSource = scope.run(() => windowWhen<string | undefined>(() => {
      if (isOpen) { throw new Error('Window already open') }
      isOpen = true;
      return signal(undefined);
    })(inputSource));

    subscribe(outputSource, (window) => {
      let index = log.length;
      log.push([]);
      windows.push(window);
      subscribe(window, (value) => {
        log[index].push(value);
      }, destroyRef);
    }, destroyRef);

    expect(log).toEqual([]);
    expect(windows.length).toBe(0);
    expect(isOpen).toBeFalse();

    inputSource.set('A');

    expect(isOpen).toBeTrue();
    expect(log).toEqual([
      ['A']
    ]);
    expect(windows.length).toBe(1);
  });

  it('Should close widow when closing notifier emits notification and with new emitted value the new window should be open', () => {
    const log: string[][] = [];
    const windows: Signal<string>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const closingNotifier = signal(0);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => windowWhen<string | undefined>(() => closingNotifier)(inputSource));

    subscribe(outputSource, (window) => {
      let index = log.length;
      log.push([]);
      windows.push(window);
      subscribe(window, (value) => {
        log[index].push(value);
      }, destroyRef);
    }, destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    inputSource.set('C');

    closingNotifier.update((v) => ++v);

    inputSource.set('D');
    inputSource.set('E');
    inputSource.set('F');

    expect(log).toEqual([
      [ 'A', 'B', 'C' ],
      [ 'D', 'E', 'F' ]
    ]);

    expect(windows.length).toBe(2);
  });

  it('Should close window if child cleanup scope gets cleaned.', () => {
    const log: string[][] = [];
    const windows: Signal<string>[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    let childScope: CleanupScope = null!;

    const outputSource = scope.run(() => windowWhen<string | undefined>(() => {
      childScope = CleanupScope.assertCurrent();
      return signal(undefined);
    })(inputSource));

    subscribe(outputSource, (window) => {
      let index = log.length;
      log.push([]);
      windows.push(window);
      subscribe(window, (value) => {
        log[index].push(value);
      }, destroyRef);
    }, destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    childScope.cleanup();
    inputSource.set('C');
    inputSource.set('D');

    expect(log).toEqual([
      [ 'A', 'B' ],
      [ 'C', 'D' ]
    ]);
    expect(windows.length).toBe(2);
  });

  it('Should run cleanup logic after immediate user cleanup in closing selector function body.', () => {
    const log: string[] = [];
    const inputSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowWhen(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return signal(undefined);
    })(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic after user immediate cleanup during closing notifier read.', () => {
    const log: string[] = [];
    const inputSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => windowWhen(() => computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return undefined
    }))(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

});
