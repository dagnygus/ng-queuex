import { Injector, ɵglobal } from "@angular/core"
import { CleanupScope, createTestCleanupScope, DefaultCleanupScope, TestCleanupScope } from "./cleanup_scope";
import { TestBed } from "@angular/core/testing";

describe('Testing DefaultCleanupScope class.', () => {
  it('Should run added teardown logic when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);
    scope.add(() => log.push('a'));
    scope.cleanup();
    expect(log).toEqual(['a']);
    expect(scope._listeners.length).toBe(0)
  });

  it('Should run multiple added teardown logics when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);
    scope.add(() => log.push('a'));
    scope.add(() => log.push('b'));
    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
    expect(scope._listeners.length).toBe(0)
  });

  it('Should not run removed teardown logic when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);

    scope.add(() => log.push('a'));

    const logic = () => { log.push('b'); };
    scope.add(logic);

    scope.add(() => log.push('c'));

    scope.remove(logic);

    scope.cleanup();
    expect(log).toEqual(['a', 'c']);
    expect(scope._listeners.length).toBe(0)
  });

  it('Method CleanupScope.current() should return null if is used outside cleanup scope.', () => {
    expect(CleanupScope.current()).toBeNull();
  })

  it('Method CleanupScope.assetCurrent() should throw error if is used outside cleanup scope.', () => {
    function someCallerFn(): void {}
    expect(() => CleanupScope.assertCurrent(someCallerFn)).toThrowError(
      'someCallerFn(): Current stack frame is not within cleanup scope.'
    );
  });

  it('Method CleanupScope.current() should return scope object if is used in function body provided to CleanupScope#run() method.', () => {
    let returnedScope: CleanupScope | null = null;
    const scope = new DefaultCleanupScope(Injector.NULL);
    scope.run(() => {
      returnedScope = CleanupScope.current();
    })
    expect(returnedScope).toBe(scope as any);
  });

  it('Method CleanupScope.assertCurrent() should return scope object if is used in function body provided to CleanupScope#run() method.', () => {
    let returnedScope: CleanupScope | null = null;
    const scope = new DefaultCleanupScope(Injector.NULL);
    scope.run(() => {
      returnedScope = CleanupScope.assertCurrent();
    })
    expect(returnedScope).toBe(scope as any);
  });

  it('Should throw error if there is attempt to destroy root cleanup scope (scope without parent).', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    expect(() => scope.destroy()).toThrowError('CleanupScope#destroy(): It is disallowed to destroy root cleanup scope!');
  });

  it('Parent scope should clean child scope and destroys it.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);
    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
    expect(childScope.destroyed).toBeTrue();
  });

  it('Child scope should not clean parent scope.', () => {
    let log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);

    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    childScope.cleanup();
    expect(log).toEqual(['b']);
    log = [];
    scope.cleanup();
    expect(log).toEqual(['a']);
  });

  it('Child scope should be in parent listeners list.', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    expect(scope._listeners.includes(childScope as DefaultCleanupScope)).toBeTrue();
  });

  it('Child scope should have reference to parent scope.', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    //@ts-expect-error
    expect(childScope._parent).toBe(scope);
  });

  it('Destroyed scope should be cleaned.', () => {
    let log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    childScope.add(() => log.push('A'));
    childScope.destroy();
    expect(log).toEqual(['A']);
  });

  it('Should throw an error if there is attempt to add teardown logic to destroyed scope.', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    childScope.destroy();
    expect(() => childScope.add(() => {})).toThrowError('CleanupScope#add(): This cleanup scope is already destroyed!')
  });

  it('Should throw error if there is attempt to use destroyed scope.', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    expect(childScope.destroyed).toBeFalse();
    childScope.destroy();
    expect(childScope.destroyed).toBeTrue();
    expect(() => childScope.run(() => {})).toThrowError('CleanupScope#run(): Destroyed cleanup scope can not be reused!');
  });

  it('Should be destroyed in teardown logic without any problem', () => {
    const scope = new DefaultCleanupScope(Injector.NULL);
    const childScope = scope.createChild();
    childScope.add(() => childScope.destroy());
    childScope.cleanup();
    //@ts-expect-error
    expect(childScope._destroyed).toBeTrue();
  });

  it('Should handle circular cleanup call without any problem.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope(Injector.NULL);

    scope.add(() => {
      log.push('a');
      scope.cleanup();
      log.push('b');
    });

    scope.cleanup();
    expect(log).toEqual([ 'a', 'b' ]);
  })
});

describe('Testing createTestCleanupScope() function', () => {
  it('Should throw error if there is attempt to destroy root cleanup scope (scope without parent).', () => {
    const scope = createTestCleanupScope();
    expect(() => scope.destroy()).toThrowError('CleanupScope#destroy(): It is disallowed to destroy root cleanup scope!');
  });

  it('Parent scope should clean child scope and destroys it.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
    expect(childScope.destroyed).toBeTrue();
  });

  it('Child scope should be in parent listeners list.', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    //@ts-expect-error
    expect(scope._listeners.includes(childScope as DefaultCleanupScope)).toBeTrue();
  });

  it('Child scope should have reference to parent scope!', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    //@ts-expect-error
    expect(childScope._parent).toBe(scope);
  });

  it('Destroyed scope should be cleaned.', () => {
    let log: string[] = [];
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    childScope.add(() => log.push('A'));
    childScope.destroy();
    expect(log).toEqual(['A']);
  });

  it('Should throw an error if there is attempt to add teardown logic to destroyed scope.', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    childScope.destroy();
    expect(() => childScope.add(() => {})).toThrowError('CleanupScope#add(): This cleanup scope is already destroyed!')
  });

  it('Should throw error if there is attempt to use destroyed scope.', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    expect(childScope.destroyed).toBeFalse();
    childScope.destroy();
    expect(childScope.destroyed).toBeTrue();
    expect(() => childScope.run(() => {})).toThrowError('CleanupScope#run(): Destroyed cleanup scope can not be reused!');
  });

  it('Should be destroyed in teardown logic without any problem', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    childScope.add(() => childScope.destroy());
    childScope.cleanup();
    //@ts-expect-error
    expect(childScope._destroyed).toBeTrue();
  });

  it('Child scope should not clean parent scope.', () => {
    let log: string[] = [];
    const scope = createTestCleanupScope();

    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    childScope.cleanup();
    expect(log).toEqual(['b']);
    log = [];
    scope.cleanup();
    expect(log).toEqual(['a']);
  });

  it('Parent scope should collect child scopes', () => {
    const scope = createTestCleanupScope();
    const children = [
      scope.createChild(),
      scope.createChild(),
      scope.createChild(),
    ]
    expect(children).toEqual(scope.children());
  });

  it('Destroyed child scope should not be included in children array.', () => {
    const scope = createTestCleanupScope();
    const childScope = scope.createChild();
    childScope.destroy();
    expect(scope.children().includes(childScope as TestCleanupScope)).toBeFalse();
  })

  it('Should root scope run onCleanup listener before teardown logics', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ onCleanup: () => log.push('a') });
    scope.add(() => log.push('b'));
    scope.cleanup();
    expect(log).toEqual(['a', 'b']);

  });

  it('Should child scope run onCleanup listener before teardown logics', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope({ onCleanup: () => log.push('a') });
    const childScope = scope.createChild(() => log.push('b'))
    scope.add(() => log.push('c'));
    scope.cleanup();
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('Should root scope be destroyed after injector gets destroyed.', () => {
    const injector = Injector.create({ providers: [] });
    const scope = createTestCleanupScope({ injector });

    injector.destroy();
    expect(scope.destroyed).toBeTrue();
  });

  it('createTestCleanupScope() function should throw error if supported test runner is not detected', () => {
    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined
    expect(() => {
      createTestCleanupScope({ injector: TestBed.inject(Injector) });
    }).toThrowError(
      'Function createTestCleanupScope() can be only used in supported test runner (jasmine/jest/vi)!'
    )
    ɵglobal.jasmine = _jasmine;
  });
})
