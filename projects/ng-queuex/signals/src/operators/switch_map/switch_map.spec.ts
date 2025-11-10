import { computed, DestroyableInjector, DestroyRef, Injector, signal } from "@angular/core";
import { ReactiveNode, REACTIVE_NODE, consumerBeforeComputation, consumerAfterComputation } from "@angular/core/primitives/signals";
import { switchMap } from "./switch_map";
import { CleanupScope, createTestCleanupScope, subscribe } from "../../signals";

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

describe('Testing switchMap() function.', () => {

  let injector: DestroyableInjector = null!;
  let destroyRef: DestroyRef = null!;

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  })

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  })

  it('Should throw en error if it is used outside cleanup scope context.', () => {
    const inputSource = signal(undefined);
    expect(() => switchMap(() => signal(undefined))(inputSource)).toThrowError(
      'switchMap(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Should throw error if it is used in reactive context.', () => {
    const inputSource = signal(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => expect(() => runInReactiveContext(() => {
      switchMap(() => signal(undefined))(inputSource);
    })).toThrowError());
  });

  it('Should project output signal correctly.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchMap(() => externalSource)(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('A');
    expect(log).toEqual([]);
    externalSource.set('B');
    externalSource.set('C');
    expect(log).toEqual([ 'B', 'C' ]);
  });

  it('Should switch between sources.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const externalSource1 = signal<string | undefined>(undefined);
    const externalSource2 = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    let externalSource = externalSource1;

    const outputSource = scope.run(() => switchMap(() => externalSource)(inputSource));
    subscribe(outputSource, (value) => log.push(value), destroyRef);

    inputSource.set('0');
    externalSource1.set('A');
    externalSource = externalSource2;
    inputSource.set('1');
    externalSource2.set('B');
    externalSource1.set('C');

    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should run project function in child cleanup scope context.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();

    scope.run(() => switchMap<string | undefined, undefined>((value) => {
      log.push(value);
      expect(CleanupScope.current()).toBe(scope.children()[0]);
      return signal(undefined);
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic between sources.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => switchMap<string | undefined, undefined>((value) => {
      log.push(value);
      CleanupScope.assertCurrent().add(() => log.push('B'));
      return signal(undefined);
    })(inputSource));

    inputSource.set('A');
    inputSource.set('C');

    expect(log).toEqual([ 'A', 'B', 'C' ]);
  });

  it('Should run cleanup logic if cleanup scope gets cleaned.', () => {
    const log: string[] = [];
    const inputSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    scope.run(() => switchMap<string | undefined, undefined>((value) => {
      log.push(value);
      CleanupScope.assertCurrent().add(() => log.push('B'));
      return signal(undefined);
    })(inputSource));

    inputSource.set('A');
    expect(log).toEqual([ 'A' ]);
    scope.cleanup();
    expect(log).toEqual([ 'A', 'B' ]);
  });

  it('Should not connect to signal if cleanup scope gets immediate cleaned.', () => {
    const log: string[] = [];
    const inputSource = signal<number | undefined>(undefined);
    const externalSource = signal<string | undefined>(undefined);
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchMap<number | undefined, string | undefined>(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('C'));
      return externalSource;
    })(inputSource));

    subscribe(outputSource, (value) => log.push(value), destroyRef);
    inputSource.set(0);
    externalSource.set('A');
    externalSource.set('B');
    expect(log).toEqual([ 'C' ]);
  });

  it('Should run cleanup logic after user cleanup during signal read.', () => {
    const log: string[] = [];
    const inputSource = signal<number>(0);
    const externalSource = computed(() => {
      CleanupScope.assertCurrent().cleanup();
      CleanupScope.assertCurrent().add(() => log.push('A'));
      return 0;
    });
    const scope = createTestCleanupScope();
    scope.run(() => switchMap(() => externalSource)(inputSource))
    expect(log).toEqual([ 'A' ]);
    expect()
  });

  it('Output value should not be undefined if cleanup scope gest cleaned in project() function and external source has defined value and where input source has defined value.', () => {
    const inputSource = signal(0);
    const externalSource = signal('ABC');
    const scope = createTestCleanupScope();
    const outputSource = scope.run(() => switchMap(() => {
      CleanupScope.assertCurrent().cleanup();
      return externalSource
    })(inputSource));


    expect(outputSource()).toEqual(externalSource());
  });

});
