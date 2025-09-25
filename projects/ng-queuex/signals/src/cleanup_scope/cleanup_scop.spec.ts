import { ɵglobal } from "@angular/core"
import { CleanupScope, createTestCleanupScope, DefaultCleanupScope } from "./cleanup_scope";

describe('Testing DefaultCleanupScope class.', () => {
  it('Should run added teardown logic when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope();
    scope.add(() => log.push('a'));
    scope.cleanup();
    expect(log).toEqual(['a']);
    expect(scope._listeners.length).toBe(0)
  });

  it('Should run multiple added teardown logics when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope();
    scope.add(() => log.push('a'));
    scope.add(() => log.push('b'));
    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
    expect(scope._listeners.length).toBe(0)
  });

  it('Should not run removed teardown logic when CleanupScope#cleanup() runs.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope();

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
  })

  it('Method CleanupScope.current() should return scope object if is used in function body provided to CleanupScope#run() method.', () => {
    let returnedScope: CleanupScope | null = null;
    const scope = new DefaultCleanupScope();
    scope.run(() => {
      returnedScope = CleanupScope.current();
    })
    expect(returnedScope).toBe(scope as any);
  });

  it('Method CleanupScope.assertCurrent() should return scope object if is used in function body provided to CleanupScope#run() method.', () => {
    let returnedScope: CleanupScope | null = null;
    const scope = new DefaultCleanupScope();
    scope.run(() => {
      returnedScope = CleanupScope.assertCurrent();
    })
    expect(returnedScope).toBe(scope as any);
  });

  it('Parent scope should clean child scope.', () => {
    const log: string[] = [];
    const scope = new DefaultCleanupScope();
    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
  });

  it('Child scope should clean parent scope.', () => {
    let log: string[] = [];
    const scope = new DefaultCleanupScope();

    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    childScope.cleanup();
    expect(log).toEqual(['b']);
    log = [];
    scope.cleanup();
    expect(log).toEqual(['a']);
  });

  it('Should throw error if cleanup is disallowed.', () => {
    const scope = new DefaultCleanupScope();
    scope._allowCleanup = false;
    scope._errorMessage = 'XYZ';
    expect(() => scope.cleanup()).toThrowError('XYZ');
  })
});

describe('Testing TestCleanupScopeForTest', () => {
  it('Parent scope should clean child scope.', () => {
    const log: string[] = [];
    const scope = createTestCleanupScope();
    scope.add(() => log.push('a'));

    const childScope = scope.createChild();
    childScope.add(() => log.push('b'));

    scope.cleanup();
    expect(log).toEqual(['a', 'b']);
  });

  it('Child scope should clean parent scope.', () => {
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

  it('createTestCleanupScope() function should throw error if supported test runner is not detected', () => {
    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined
    expect(() => {
      createTestCleanupScope();
    }).toThrowError(
      'Function createTestCleanupScope() can be only used in supported test runner (jasmine/jest)!'
    )
    ɵglobal.jasmine = _jasmine;
  })
})
