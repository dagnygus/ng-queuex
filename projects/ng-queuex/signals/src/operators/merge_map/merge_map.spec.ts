import { value } from '@ng-queuex/core';
import { DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { mergeMap } from "./merge_map";
import { CleanupScope, createTestCleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../signals";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from '@angular/core/primitives/signals';

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

describe('Testing mergeMap() function', () => {

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
  })

  it('Should throw an error if it is used outside of a cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => mergeMap<undefined, undefined>(() => signal(undefined))(inputSource)).toThrowError(
      'mergeMap(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw an error if it is used in reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => expect(() => runInReactiveContext(() => {
      mergeMap(() => signal(undefined))(inputSource)
    })).toThrowError());
  })

  it('Should project output signal correctly', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const outputSignal = scope.run(() => mergeMap(() => externalSource)(inputSource));

    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    expect(log).toEqual([]);
    inputSource.set('A');
    expect(log).toEqual([]);
    externalSource.set('B');
    expect(log).toEqual(['B']);

    scope.cleanup()
  });

  it('Should not merge with already used signal!', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const outputSignal = scope.run(() => mergeMap(() => externalSource)(inputSource));

    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    inputSource.set('B');
    externalSource.set('C');
    expect(log).not.toEqual([ 'C', 'C' ]);
    expect(log).toEqual([ 'C' ]);
    expect(scope.children().length).toEqual(1);

    scope.cleanup();
  });

  it('Should merge multiple sources', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);

    let externalSource = externalSource1;

    const outputSignal = scope.run(() => mergeMap(() => externalSource)(inputSource));

    subscribe(outputSignal, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    externalSource = externalSource2;
    inputSource.set('B');
    expect(log).toEqual([]);
    externalSource1.set('C');
    externalSource2.set('D');
    expect(log).toEqual([ 'C', 'D' ]);

    scope.cleanup();
  });

  it('Should run project() function in child cleanup scope context.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);

    scope.run(() => mergeMap<string | undefined, string | undefined>((value) => {
      log.push(value)
      expect(CleanupScope.current()).toBe(scope.children()[0]);
      return externalSource;
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
    scope.cleanup();
  });

  it('Should run cleanup logic when cleanup scope gets cleaned.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);

    scope.run(() => mergeMap<string | undefined, string | undefined>((value) => {
      log.push(value);
      CleanupScope.assertCurrent().add(() => log.push('B'));
      return externalSource;
    })(inputSource));

    expect(log).toEqual([]);
    inputSource.set('A');
    expect(log).toEqual(['A']);
    scope.cleanup();
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should project() function create separated cleanup scopes for separated external sources.', () => {
    const childScopes: CleanupScope[] = [];
    const scope = createTestCleanupScope();
    const inputSource = signal<string | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);

    let externalSource = externalSource1;

    scope.run(() => mergeMap(() => {
      childScopes.push(CleanupScope.assertCurrent());
      return externalSource
    })(inputSource));

    inputSource.set('A');
    externalSource = externalSource2;
    inputSource.set('B');

    expect(scope.children() as CleanupScope[]).toEqual(childScopes);
  });
})
