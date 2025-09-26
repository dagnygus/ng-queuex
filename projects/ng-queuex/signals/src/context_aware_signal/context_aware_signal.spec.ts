import { consumerAfterComputation, consumerBeforeComputation, consumerDestroy, REACTIVE_NODE, ReactiveNode, SIGNAL } from "@angular/core/primitives/signals";
import { ContextAwareSignalNode, ContextAwareSignalStatus, createContextAwareSignal } from "./context_aware_signal";
import { CleanupScope, createTestCleanupScope } from "../cleanup_scope/cleanup_scope";
import { DestroyRef, Injector, isSignal } from "@angular/core";
import { subscribe } from "../subscribe/subscribe";

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

describe('Testing context aware signal', () => {

  it('isSignal should return true', () => {
    const source = createContextAwareSignal(
      'A',
      () => {},
      () => {},
    );
    expect(isSignal(source)).toBeTrue();
  });

  it('Should throw error if signal is accessed outside required contexts.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      'A',
      () => {},
      () => {},
      'XYZ'
    )
    expect(() => log.push(source())).toThrowError('XYZ');
    expect(log).toEqual([]);
  });

  it('Should not throw an error if signal is read in reactive context.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      'A',
      () => {},
      () => {},
    );
    const consumer = runInReactiveContext(() => {
      expect(() => log.push(source())).not.toThrowError();
    });
    expect(log).toEqual(['A']);
    consumerDestroy(consumer);
  });

  it('Should not throw an error if signal is read in cleanup scope.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      'A',
      () => {},
      () => {},
    );
    const scope = createTestCleanupScope();
    scope.run(() => {
      expect(() => log.push(source())).not.toThrowError();
    });
    expect(log).toEqual(['A']);
    scope.cleanup();
  });

  it('Should throw an error if signal is read in reactive context and cleanup scope at the same time.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      'A',
      () => {},
      () => {},
      'XYZ'
    );
    const scope = createTestCleanupScope();
    const consumer = runInReactiveContext(() => {
      scope.run(() => {
        expect(() => log.push(source())).toThrowError('XYZ');
      });
    })
    expect(log).toEqual([]);
    scope.cleanup();
    consumerDestroy(consumer);
  });

  it('Should run onInit when signal is read in first reactive context.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {
        log.push('A')
      },
      () => {},
    );

    const consumer = runInReactiveContext(() => source());
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual(['A']);
    consumerDestroy(consumer);
  });

  it('Should not run onInit when signal is read in second reactive context.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {
        log.push('A')
      },
      () => {},
    );
    const consumer1 = runInReactiveContext(() => source());
    const consumer2 = runInReactiveContext(() => source());
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(node.consumers).toBeTruthy();
    expect(node.consumers!.nextConsumer).toBeTruthy();
    expect(log).toEqual(['A']);
    consumerDestroy(consumer1);
    consumerDestroy(consumer2);
  });

  it('Should run onInit when signal is read in first cleanup scope', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {
        log.push('A')
      },
      () => {},
    );

    const scope = createTestCleanupScope();
    scope.run(() => source());
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual(['A']);
    scope.cleanup();
  });

  it('Should not run onInit when signal is read in second cleanup scope', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {
        log.push('A')
      },
      () => {},
    );

    const scope1 = createTestCleanupScope();
    const scope2 = createTestCleanupScope();
    scope1.run(() => source());
    scope2.run(() => source());
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(node.scopeRefCount).toBe(2);
    expect(log).toEqual(['A']);
    scope1.cleanup();
    scope2.cleanup();
  });

  it(
    'For a signal that has already been read in reactive context, ' +
    'should not be run onInit when signal is read in cleanup scope.',
    () => {
      const log: string[] = [];
      const source = createContextAwareSignal(
        '',
        () => {
          log.push('A');
        },
        () => {},
      );
      const consumer = runInReactiveContext(() => source());
      const scope = createTestCleanupScope();
      scope.run(() => source());
      const node = source[SIGNAL] as ContextAwareSignalNode<any>;
      expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
      expect(node.consumers).toBeTruthy();
      expect(node.consumers).toBe(node.consumersTail);
      expect(node.scopeRefCount).toBe(1);
      expect(log).toEqual(['A']);
      consumerDestroy(consumer);
      scope.cleanup();
    }
  );

  it(
    'For a signal that has already been read in cleanup scope, ' +
    'should not be run onInit when signal is read in reactive context.',
    () => {
      const log: string[] = [];
      const source = createContextAwareSignal(
        '',
        () => {
          log.push('A');
        },
        () => {},
      );
      const scope = createTestCleanupScope();
      scope.run(() => source());
      const consumer = runInReactiveContext(() => source());
      const node = source[SIGNAL] as ContextAwareSignalNode<any>;
      expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
      expect(node.consumers).toBeTruthy();
      expect(node.consumers).toBe(node.consumersTail);
      expect(node.scopeRefCount).toBe(1);
      expect(log).toEqual(['A']);
      consumerDestroy(consumer);
      scope.cleanup();
    }
  )

  it('Should run onDeinit when last signal consumer gets destroyed.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {},
      () => {
        log.push('A');
      },
    );
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;

    const consumer1 = runInReactiveContext(() => source());
    const consumer2 = runInReactiveContext(() => source());

    consumerDestroy(consumer1);
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual([]);

    consumerDestroy(consumer2);
    expect(node.status).toBe(ContextAwareSignalStatus.Unprepared);
    expect(log).toEqual(['A']);
  });

  it('Should run onDeinit when last signal cleanup scope gets cleaned.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {},
      () => {
        log.push('A');
      },
    );
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;

    const scope1 = createTestCleanupScope();
    const scope2 = createTestCleanupScope();
    scope1.run(() => source());
    scope2.run(() => source());

    scope1.cleanup();
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual([]);

    scope2.cleanup();
    expect(node.status).toBe(ContextAwareSignalStatus.Unprepared);
    expect(log).toEqual(['A']);
  });

  it('Should run onDeinit when cleanup scope gets cleaned followed by consumer destruction', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {},
      () => {
        log.push('A');
      },
    );
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    const scope = createTestCleanupScope();

    scope.run(() => source());
    const consumer = runInReactiveContext(() => source());

    scope.cleanup();
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual([]);

    consumerDestroy(consumer);
    expect(node.status).toBe(ContextAwareSignalStatus.Unprepared);
    expect(log).toEqual(['A']);
  });

  it('Should run onDeinit when consumer gets destroyed followed by cleanup scope cleanup.', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      '',
      () => {},
      () => {
        log.push('A');
      },
    );
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    const scope = createTestCleanupScope();

    scope.run(() => source());
    const consumer = runInReactiveContext(() => source());

    consumerDestroy(consumer);
    expect(node.status).toBe(ContextAwareSignalStatus.Prepared);
    expect(log).toEqual([]);

    scope.cleanup();
    expect(node.status).toBe(ContextAwareSignalStatus.Unprepared);
    expect(log).toEqual(['A']);
  });

  it('Should gracefully update prepared signals.', () => {
    const log: number[] = [];
    const source = createContextAwareSignal(
      0,
      (set, update) => {
        log.push(source());
        set(1);
        log.push(source());
        update((value) => ++value);
        log.push(source());
      },
      () => {},
    );

    const consumer = runInReactiveContext(() => source());
    expect(log).toEqual([0, 1, 2]);
    consumerDestroy(consumer);
  });

  it('Should throw error when tries to update unprepared signal.', () => {
    let signalSet: (value: any) => void = null!;
    let signalUpdate: (updater: (value: any) => any) => void = null!

    const source = createContextAwareSignal(
      0,
      (set, update) => {
        signalSet = set;
        signalUpdate = update;

        node.status = ContextAwareSignalStatus.Unprepared;

        expect(() => set(1)).toThrowError('Unprepared signal can not be updated!');
        expect(() => update((value) => ++value)).toThrowError('Unprepared signal can not be updated!');
      },
      () => {},
    );
    const node = source[SIGNAL] as ContextAwareSignalNode<any>;
    const consumer = runInReactiveContext(() => source());
    node.status = ContextAwareSignalStatus.Unprepared;
    expect(() => signalSet(3)).toThrowError('Unprepared signal can not be updated!');
    expect(() => signalUpdate((value) => ++value)).toThrowError('Unprepared signal can not be updated!');
    node.status = ContextAwareSignalStatus.Prepared;
    consumerDestroy(consumer);
  });

  it('Should initialized, deinitialized and reinitialized without any problem!', () => {
    const log: string[] = [];
    const source = createContextAwareSignal(
      undefined,
      () => { log.push('A') },
      () => { log.push('B') });
    let consumer: ReactiveNode;
    let scope: CleanupScope;

    consumer = runInReactiveContext(() => source());
    consumerDestroy(consumer);

    scope = createTestCleanupScope();
    scope.run(() => source());
    scope.cleanup();

    consumer = runInReactiveContext(() => source());
    consumerDestroy(consumer);

    scope = createTestCleanupScope();
    scope.run(() => source());
    scope.cleanup();

    scope = createTestCleanupScope();
    scope.run(() => source());
    scope.cleanup();

    consumer = runInReactiveContext(() => source());
    consumerDestroy(consumer);

    consumer = runInReactiveContext(() => source());
    consumerDestroy(consumer);

    expect(log).toEqual([
      'A', 'B',
      'A', 'B',
      'A', 'B',
      'A', 'B',
      'A', 'B',
      'A', 'B',
      'A', 'B',
    ])
  });

  it('Should work with subscribe() function without any problem.', () => {
    const log: number[] = [];
    const injector = Injector.create({ providers: [] });
    const source = createContextAwareSignal(
      0,
      (set, update) => {
        set(1);
        update((value) => ++value);
      },
      () => {},
    );

    const unsubscribe = subscribe(source, (value) => log.push(value), injector.get(DestroyRef));
    expect(log).toEqual([2]);
    unsubscribe()
  });

});
