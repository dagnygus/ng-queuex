import { DestroyRef, InjectOptions, Injector, ProviderToken } from "@angular/core";

declare const jasmine: any;
declare const jest: any;
declare const vi: any;

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
   * Indicates that current scope is destroyed or not.
   */
  abstract readonly destroyed: boolean;

  // /**
  //  * An injector related to root cleanup scope.
  //  */
  // abstract readonly injector: Injector;

  /**
   * Runs provided callback in cleanup scope.
   * @param callback A callback to run in scope.
   */
  abstract run<T>(callback: () => T): T;

  /**
   * Adds teardown logic to this scope.
   * @param teardownLogic The teardown logic to run.
   * @throws Error during cleanup faze.
   * @throws Error if scope is destroyed.
   */
  abstract add(teardownLogic: VoidFunction): void;

  /**
   * Removes teardown logic from this scope.
   * @param teardownLogic The teardown logic to remove
   */
  abstract remove(teardownLogic: VoidFunction): void;

  /**
   * Runs all teardown logics added to this scope and removes them.
   * With it runs all teardown logics of child scopes and destroys them.
   */
  abstract cleanup(): void;

  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract getService<T>(token: ProviderToken<T>, notFoundValue: undefined, options: InjectOptions & {
      optional?: false;
  }): T;
  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract getService<T>(token: ProviderToken<T>, notFoundValue: null | undefined, options: InjectOptions): T | null;
  /**
   * Retrieves an instance from the injector based on the provided token.
   * @returns The instance from the injector if defined, otherwise the `notFoundValue`.
   * @throws When the `notFoundValue` is `undefined` or `Injector.THROW_IF_NOT_FOUND`.
   */
  abstract getService<T>(token: ProviderToken<T>, notFoundValue?: T, options?: InjectOptions): T;

  /**
   * Runs all teardown logics added to this scope and removes them.
   * Then removes this scope from its parent if exist.
   *
   * @throws Error if this scope is root cleanup scope (without parent).
   */
  abstract destroy(): void;

  /**
   * Creates child cleanup scope. Parent scope can cleanup child scope but not reverse.
   */
  abstract createChild(): CleanupScope;

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
  _listeners: (VoidFunction | DefaultCleanupScope)[] = [];
  _cleaning = false;
  _destroyed = false;
  _parent: DefaultCleanupScope | null = null;

  constructor(public _injector: Injector) {}


  get destroyed(): boolean { return this._destroyed; }

  // get injector(): Injector { return this._injector; }

  run<T>(callback: () => T): T {
    if (this._destroyed) {
      throw new Error('CleanupScope#run(): Destroyed cleanup scope can not be reused!');
    }

    const prevScope = cleanupScope;
    cleanupScope = this
    try {
      return callback();
    } finally {
      cleanupScope = prevScope;
    }
  }

  add(teardownLogic: VoidFunction): void {
    if (this._destroyed) {
      throw new Error('CleanupScope#add(): This cleanup scope is already destroyed!');
    }
    if (this._cleaning) {
      throw new Error('CleanupScope#add(): Adding teardown logic during cleanup is not allowed!');
    }
    this._listeners.push(teardownLogic);
  }

  remove(teardownLogic: VoidFunction): void {
    if (this._destroyed) { return; }
    const index = this._listeners.indexOf(teardownLogic);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  cleanup(): void {
    if (this._destroyed || this._cleaning) { return; }
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
        const listener = this._listeners.shift()!
        if (typeof listener === 'function') {
          listener();
        } else {
          listener.destroy();
        }
      }
    } finally {
      if (this._listeners.length) {
        this._cleanup();
      }
    }
  }

  getService<T>(token: ProviderToken<T>, notFoundValue: undefined, options: InjectOptions & {
    optional?: false;
  }): T;
  getService<T>(token: ProviderToken<T>, notFoundValue: null | undefined, options: InjectOptions): T | null;
  getService<T>(token: ProviderToken<T>, notFoundValue?: T, options?: InjectOptions): T;
  getService<T>(token: ProviderToken<T>, notFoundValue?: T | null | undefined, options?: InjectOptions): T | null {
    if (this._destroyed) {
      throw new Error('CleanupScope#getService(): This cleanup scope is already destroyed!');
    }
    if (token === Injector as any) {
      return this._injector as any;
    }
    return this._injector.get(token, notFoundValue, options);
  }

  createChild(): CleanupScope {
    const child = new DefaultCleanupScope(this._injector);
    child._parent = this;
    this._listeners.push(child);
    return child;
  }

  destroy(): void {
    if (this._parent == null) {
      throw new Error('CleanupScope#destroy(): It is disallowed to destroy root cleanup scope!');
    }
    this.cleanup();
    this._parent._removeChild(this);

    this._destroyed = true;
  }

  _removeChild(child: DefaultCleanupScope): void {
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
    child._parent = this;
    this._children.push(child);
    this._listeners.push(child);
    return child;
  }

  override _removeChild(child: TestCleanupScopeImpl): void {
    super._removeChild(child);
    const index = this._children.indexOf(child);
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
  if (!((typeof jasmine === 'object' && jasmine !== null) || (typeof jest === 'object' && jest !== null) || (typeof vi === 'object' && vi !== null))) {
    throw new Error('Function createTestCleanupScope() can be only used in supported test runner (jasmine/jest/vi)!');
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
