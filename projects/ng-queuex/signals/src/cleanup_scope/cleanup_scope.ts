import { DestroyRef, Injector } from "@angular/core";

declare const jasmine: any;
declare const jest: any;

let cleanupScope: CleanupScope | null = null;

export function setCleanupScope(scope: CleanupScope | null): CleanupScope | null {
  const prev = cleanupScope;
  cleanupScope = scope;
  return prev;
}

/**
 * CleanupScope provides a lifecycle-aware context for managing resources
 * such as subscriptions, effects, or disposable objects.
 *
 * Each scope tracks registered cleanup callbacks and ensures they are executed
 * when the scope is cleaned. This prevents memory leaks and allows
 * deterministic resource management.
 *
 * Worth to mention that every root cleanup scope is manage also by DestroyRef, what
 * can cause cascading cleanup.
 *
 * Use `CleanupScope.current()` to access the scope associated with the current
 * execution frame. If no scope is active, it returns `null`.
 *
 *
 */
export abstract class CleanupScope {

  /**
   * An injector related to root cleanup scope.
   */
  abstract readonly injector: Injector

  /**
   * runs provided callback in cleanup scope.
   * @param callback A callback to run in scope.
   */
  abstract run<T>(callback: () => T): T;

  /**
   * Adds teardown logic to this scope.
   * @param teardownLogic The teardown logic to run.
   */
  abstract add(teardownLogic: VoidFunction): void;

  /**
   * Removes teardown logic from this scope.
   * @param teardownLogic The teardown logic to remove
   */
  abstract remove(teardownLogic: VoidFunction): void;

  /**
   * Runs all teardown logics added to this scope and removes them.
   */
  abstract cleanup(): void;


  /**
   * Creates child cleanup scope. Parent scope can cleanup child scope but not reverse.
   */
  abstract createChild(): CleanupScope;

  /**
   * If a provided scope is a child of this scope, it will be removed from this scope and it
   * will not participate in the cascading cleaning execution.
   * @param child A potential child scope of this scope.
   */
  abstract removeChild(child: CleanupScope): void

  /**
   * If current stack frame is in cleanup scope then returns a current `CleanupScope` object,
   * otherwise null.
   *
   * @returns A current cleanup scope or null there is not there.
   */
  static current(): CleanupScope | null {
    return cleanupScope;
  }

  /**
   * Returns the currently active CleanupScope.
   *
   * Unlike `current()`, which may return `null` when no scope is active,
   * `assertCurrent()` guarantees a valid scope. If no scope is available,
   * it throws an error.
   *
   * Use this when a CleanupScope is strictly required for the operation
   * to proceed safely.
   *
   * @param debugFn A caller function reference for debugging purpose's.
   * @returns A current cleanup scope or null there is not there.
   * @throws Error if current stack frame is not within cleanup scope.
   */
  static assertCurrent(debugFn?: Function): CleanupScope;
  static assertCurrent(debugFn: Function = this.assertCurrent): CleanupScope {
    if (!cleanupScope) {
      throw new Error(`${debugFn.name}(): Current stack frame is not within cleanup scope.`);
    }
    return cleanupScope;
  }
}

export class DefaultCleanupScope implements CleanupScope {
  _listeners: (VoidFunction | CleanupScope)[] = [];
  _cleaning = false;

  constructor(public _injector: Injector) {}

  get injector(): Injector { return this._injector; }

  run<T>(callback: () => T): T {
    const prevScope = cleanupScope;
    cleanupScope = this
    try {
      return callback();
    } finally {
      cleanupScope = prevScope;
    }
  }

  add(teardownLogic: VoidFunction): void {
    if (this._cleaning) {
      throw new Error('CleanupScope#add(): Adding teardown logic during cleanup is not allowed!');
    }
    this._listeners.push(teardownLogic);
  }

  remove(teardownLogic: VoidFunction): void {
    const index = this._listeners.indexOf(teardownLogic);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  cleanup(): void {
    if (this._cleaning) { return; }
    this._cleaning = true;
    try {
      this._cleanup();
    } finally {
      this._cleaning = false;
    }
  }

  _cleanup(): void {
    try {
      while (this._listeners.length) {
        const listener = this._listeners.shift()!;
        if (typeof listener === 'function') {
          listener()
        } else {
          listener.cleanup();
        }
      }
    } finally {
      if (this._listeners.length) {
        this._cleanup();
      }
    }
  }

  createChild(): CleanupScope {
    const child = new DefaultCleanupScope(this._injector);
    this._listeners.push(child);
    return child;
  }

  removeChild(child: CleanupScope): void {
    const index = this._listeners.indexOf(child);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }
}

/**
 * An interface what describes a cleanup scope for test. Initially related injector to test cleanup scope
 * is Angular's NullInjector.
 */
export interface TestCleanupScope extends CleanupScope {

  /**
   * Returns an array of child cleanup scopes.
   */
  children(): TestCleanupScope[];

  /**
   * Creates child cleanup scope. Parent scope can cleanup child scope but not reverse.
   */
  createChild(onCleanup?: VoidFunction | null | undefined): CleanupScope;
}

class TestCleanupScopeImpl extends DefaultCleanupScope implements TestCleanupScope {
  private _children: TestCleanupScope[] = []

  constructor(private onCleanup?: VoidFunction | null | undefined) {
    super(Injector.NULL);
  }

  children(): TestCleanupScope[] {
    return this._children.slice();
  }

  override cleanup(): void {
    if (this.onCleanup) { this.onCleanup(); }
    super.cleanup();
  }

  override createChild(onCleanup?: VoidFunction | null | undefined): CleanupScope {
    const child = new TestCleanupScopeImpl(onCleanup);
    this._children.push(child);
    this._listeners.push(child);
    return child;
  }

  override removeChild(child: CleanupScope): void {
    super.removeChild(child);
    const index = this._children.indexOf(child as any);
    if (index > -1) {
      this._children.splice(index, 1);
    }
  }
}

/**
 * An interface representing configuration for creating test cleanup scope.
 */
export interface CreateTestCleanupOptions {

  /**
   * An injector that provide DestroyRef object to manage root cleanup scope.
   */
  injector?: Injector;

  /**
   * A callback what will by used for every `CleanupScope#cleanup()` call
   */
  onCleanup?: VoidFunction;
}

/**
 * Creates cleanup scope for tests.
 *
 * @param injector The injector that provides object of type DestroyRef.
 * @throws `Error` if this function is used outside supported test runner (jasmine/jest).
 */
export function createTestCleanupScope(options?: CreateTestCleanupOptions): TestCleanupScope {
  if (!(typeof jasmine === 'object' || typeof jest === 'object')) {
    throw new Error('Function createTestCleanupScope() can be only used in supported test runner (jasmine/jest)!');
  }
  const injector = options?.injector;
  const onCleanup = options?.onCleanup;
  const scope = new TestCleanupScopeImpl(onCleanup);
  if (injector) {
    scope._injector = injector;
  }

  if (injector) {
    injector.get(DestroyRef).onDestroy(() => scope.cleanup());
  }

  return scope;
}
