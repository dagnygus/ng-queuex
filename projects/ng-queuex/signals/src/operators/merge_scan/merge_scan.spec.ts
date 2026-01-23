import { computed, DestroyableInjector, DestroyRef, Injector, Signal, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { mergeScan } from "./merge_scan";
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

describe('Testing mergeScan() function.', () => {

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
    expect(() => mergeScan((acc) => signal(acc), 0)(inputSource)).toThrowError(
      'mergeScan(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used inside reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() =>  mergeScan((acc) => signal(acc), 0)(inputSource))).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: number[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const outputSource = scope.run(() => mergeScan<number, number | undefined>((acc, val) => computed(() => acc + val), 0)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(1);
    inputSource.set(2);
    inputSource.set(3);
    expect(log).toEqual([ 0, 1, 3, 6 ]);
  });

  it('Should not merge with already used signal.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const externalSource = signal('A');
    const outputSource = scope.run(() => mergeScan<string, number | undefined>(() => externalSource, '')(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(1);
    inputSource.set(2);
    externalSource.set('B');
    expect(log).not.toEqual([ '', 'A', 'A', 'B', 'B' ]);
    expect(log).toEqual([ '', 'A', 'B' ]);
  });

  it('Should merge multiple sources.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const externalSource1 = signal('A1');
    const externalSource2 = signal('B1');

    let externalSource = externalSource1;
    const outputSource = scope.run(() => mergeScan<string, number | undefined>(() => externalSource, '')(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(0);
    externalSource = externalSource2;
    inputSource.set(1);

    externalSource1.set('A2');
    externalSource2.set('B2');

    expect(log).toEqual([ '', 'A1', 'B1', 'A2', 'B2' ]);
  });

  it('Should run accumalator() function in child cleanup scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    scope.run(() => mergeScan<number, number | undefined>((acc, val) => {
      log.push('A')
      expect(CleanupScope.assertCurrent()).toBe(scope.children()[0]);
      return computed(() => acc + val);
    }, 0)(inputSource));

    inputSource.set(0);
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic when cleanup scope gets cleaned.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const outputSource = scope.run(() => mergeScan<string, string | undefined>((_, value) => {
      CleanupScope.assertCurrent().add(() => log.push('C'));
      return computed(() => value);
    }, 'A')(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set('B');
    scope.cleanup();
    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should project() function create separated cleanup scopes for separated external sources.', () => {
    const childScopes: CleanupScope[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);

    scope.run(() => mergeScan<number, number | undefined>((_, value) => {
      childScopes.push(CleanupScope.assertCurrent());
      return computed(() => value);
    }, 0)(inputSource));

    inputSource.set(1);
    inputSource.set(2);

    expect(scope.children() as CleanupScope[]).toEqual(childScopes);
  });

  it('Should disconnect external source if its cleanup scope gets cleaned.', () => {
    const log: string[] = [];
    const childScopes: CleanupScope[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const externalSource1 = signal<string>('A1');
    const externalSource2 = signal<string>('B1');

    let externalSource = externalSource1;

    const outputSource = scope.run(() => mergeScan<string, number | undefined>(() => {
      childScopes.push(CleanupScope.assertCurrent());
      return externalSource;
    }, '')(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set(1);
    externalSource = externalSource2;
    inputSource.set(2);
    externalSource1.set('A2');
    externalSource2.set('B2');
    scope.children()[0].cleanup();
    externalSource1.set('A3');
    externalSource2.set('B3');
    expect(log).toEqual([ '', 'A1', 'B1', "A2", 'B2', 'B3' ]);
  });

  it('Should not merge signal if its cleanup scope gets immediate cleaned.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<number | undefined>(undefined);
    const externalSource = signal<string>('B');

    const outputSource = scope.run(() => mergeScan<string, number | undefined>(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('C'));
      return externalSource;
    }, 'A')(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(0);
    externalSource.set('D');
    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should always update output source even if child cleanup scope gets cleaned in project() function body.', () => {
    const scope = createTestCleanupScope();
    const inputSource = signal<number>(0);
    const outputSource = scope.run(() => mergeScan<number, number>((_, value) => {
      CleanupScope.assertCurrent().cleanup();
      return computed(() => value)
    }, 0)(inputSource));
    inputSource.set(1);
    expect(outputSource()).toBe(1);
    inputSource.set(2);
    expect(outputSource()).toBe(2);
    inputSource.set(3);
    expect(outputSource()).toBe(3);
  });

  it('Output value should not be changed form defined value to undefined even if cleanup scope gets cleaned in project() function and external undefined.', () => {
    const inputSource = signal(0);
    const externalSource1 = signal('ABC');
    const externalSource2 = signal(undefined);
    const scope = createTestCleanupScope();

    let externalSource: Signal<any> = externalSource1
    const outputSource = scope.run(() => mergeScan(() => {
      CleanupScope.assertCurrent().cleanup();
      return externalSource;
    }, '')(inputSource));
    subscribe(outputSource, () => {}, destroyRef);
    externalSource = externalSource2;
    inputSource.set(1);
    expect(outputSource()).toBe(externalSource1());
  });

  it('Should run cleanup logic after user immediate cleanup during signal read.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal(1);
    const externalSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 2;
    });

    scope.run(() => mergeScan<number, number>(() => externalSource, 0)(inputSource));

    expect(log).toEqual([ 'A' ]);
  });

  it('Should child cleanup scope be destroyed after cleanup.', () => {
    const inputSource = signal(0);
    const externalSource = signal(0);
    const scope = createTestCleanupScope();
    scope.run(() => mergeScan(() => externalSource, 0)(inputSource));
    const childScope = scope.children()[0];
    childScope.cleanup();
    expect(childScope.destroyed).toBeTrue();
  });
});
