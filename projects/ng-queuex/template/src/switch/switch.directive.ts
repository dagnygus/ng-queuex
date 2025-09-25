import {
  createWatch,
  setActiveConsumer,
  Watch
} from "@angular/core/primitives/signals"
import {
  AfterContentChecked,
  ChangeDetectorRef,
  Directive,
  DoCheck,
  effect,
  inject,
  InjectionToken,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  Signal,
  SimpleChanges,
  TemplateRef,
  ValueProvider,
  ViewContainerRef,
  ViewRef,
  ɵmarkForRefresh
} from "@angular/core";
import { isPlatformServer } from "@angular/common";
import {
  AbortTaskFunction,
  advancePriorityInputTransform,
  assertNgQueuexIntegrated,
  detectChangesSync,
  isInConcurrentTaskContext,
  onTaskExecuted,
  PriorityLevel,
  PriorityName,
  priorityNameToNumber,
  scheduleChangeDetection,
  scheduleTask,
  sharedSignal,
  value,
  ValueRef
} from "@ng-queuex/core";
import { NG_DEV_MODE } from "../utils/utils";

interface CaseView {
  isChecking: boolean;
  initialize(): void;
  enforceState(create: boolean): boolean;
  check(): void;
  dispose(): void;
}

class ServerCaseView implements CaseView {
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _viewRef: ViewRef | null = null;
  private _cdRef = inject(ChangeDetectorRef);
  private _caseSource: Signal<any> | null = null;
  private _switchView: SwitchView;

  isChecking = false;

  constructor(caseSource: Signal<any> | null) {
    const switchView = inject(SwitchView, { optional: true,  host: true });
    if (NG_DEV_MODE && !switchView) {
      if (caseSource) {
        throwQxSwitchProviderNotFoundError('qxSwitchCase', 'QueuexSwitchCase');
      } else {
        throwQxSwitchProviderNotFoundError('qxSwitchDefault', 'QueuexSwitchDefault');
      }
    }

    this._switchView = switchView!;

    if (caseSource) {
      switchView!.addCase(this, caseSource);
      this._caseSource = caseSource;
      effect(() => {
        caseSource();
        if (this.isChecking) { return; }
        ɵmarkForRefresh(this._cdRef as any)
      });
    } else {
      switchView!.addDefault(this);
    }
  }

  initialize(): void { /** noop */ }

  enforceState(create: boolean): boolean {
    if (create && !this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
    } else if (!create && this._viewRef) {
      this._vcRef.clear();
      this._viewRef = null;
    }
    return create;
  }

  check(): void {
    this.enforceState(this._switchView.match(this._caseSource!()));
  }

  dispose(): void { /* noop */ }
}

class ClientCaseView implements CaseView {
  private _create = signal(false);
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _viewRef: ViewRef | null = null;
  private _switchView: SwitchView;
  private _watcher: Watch | null = null;
  private _abortTask: AbortTaskFunction | null = null;
  private _scheduled = false;

  constructor(caseSource: Signal<any> | null) {
    const switchView = inject(SwitchView, { optional: true,  host: true });
    if (NG_DEV_MODE && !switchView) {
      if (caseSource) {
        throwQxSwitchProviderNotFoundError('qxSwitchCase', 'QueuexSwitchCase');
      } else {
        throwQxSwitchProviderNotFoundError('qxSwitchDefault', 'QueuexSwitchDefault');
      }
    }

    this._switchView = switchView!;

    if (caseSource) {
      switchView!.addCase(this, caseSource);
    } else {
      switchView!.addDefault(this);
    }
  }

  isChecking = false;

  initialize(): void {
    this._watcher = createWatch(
      () => this._runEffect(),
      () => this._scheduleEffect(),
      false
    );
    this._watcher.notify();
  }

  enforceState(create: boolean): boolean {
    this._create.set(create);
    return create;
  }

  check(): void { /** noop */ }

  dispose(): void {
    if (this._watcher) { this._watcher.destroy(); }
    if (this._abortTask) { this._abortTask(); }
  }

  private _runEffect() {
    const create = this._create();

    if (create && !this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      this._switchView.shouldEmitRenderEvent()
    } else if(!create && this._viewRef) {
      this._vcRef.clear();
      this._viewRef = null;
      this._switchView.shouldEmitRenderEvent();
    }

    if (this._viewRef) {
      detectChangesSync(this._viewRef);
    }

    this._scheduled = false;
  }

  private _scheduleEffect(): void {
    if (this._scheduled) { return; }
    this._scheduled = true;
    this._abortTask = scheduleChangeDetection(
      () => this._watcher!.run(),
      this._switchView.priority,
      this._viewRef
    );
  }

}

abstract class SwitchView {
  abstract isChecking: boolean;
  abstract readonly priority: PriorityLevel
  abstract initialize(directive: QueuexSwitch, cdRef: ChangeDetectorRef, switchSource: Signal<any>, priorityRef: ValueRef<PriorityLevel>): void;
  abstract addCase(caseView: CaseView, caseSource: Signal<any>): void;
  abstract addDefault(defaultView: CaseView): void;
  abstract match(value: any): boolean;
  abstract shouldEmitRenderEvent(): void;
  abstract dispose(): void;
}

class ServerSwitchView implements SwitchView {
  private _defaultViews: CaseView[] = [];
  private _defaultUsed = false;
  private _caseCount = 0;
  private _lastCaseCheckIndex = 0;
  private _lastCaseMatched = false
  private _switchSource: Signal<any> = null!;
  private _injector = inject(Injector);

  isChecking = false;

  get priority(): PriorityLevel {
    throw new Error('Internal Error: ServerSwitchView#priority not supported property');
  }

  initialize(
    directive: QueuexSwitch,
    cdRef: ChangeDetectorRef,
    switchSource: Signal<any>,
    priorityRef: ValueRef<PriorityLevel>
  ): void {
    this._switchSource = switchSource;
    effect(() => {
      switchSource()
      if (this._caseCount === 0) {
        this._updataDefaultCases(true);
      }
      if (this.isChecking) { return; }
      ɵmarkForRefresh(cdRef as any);
    }, { injector: this._injector });
  }

  addCase(caseView: CaseView, caseSource: Signal<any>): void {
    this._caseCount++
  }

  addDefault(defaultView: CaseView): void {
    this._defaultViews.push(defaultView);
  }

  match(value: any): boolean {
    const matched = value === this._switchSource();
    this._lastCaseMatched ||= matched;
    this._lastCaseCheckIndex++
    if (this._lastCaseCheckIndex === this._caseCount) {
      this._updataDefaultCases(!this._lastCaseMatched);
      this._lastCaseCheckIndex = 0;
      this._lastCaseMatched = false;
    }
    return matched;
  }

  shouldEmitRenderEvent(): void { /** noop */ }

  dispose(): void { /** noop */ }

  private _updataDefaultCases(useDefault: boolean): void {
    if (this._defaultViews.length && this._defaultUsed !== useDefault) {
      this._defaultUsed = useDefault;
      for (let i = 0; i < this._defaultViews.length; i++) {
        this._defaultViews[i].enforceState(useDefault);
      }
    }
  }
}

class ClientSwitchView implements SwitchView {
  private _directive: QueuexSwitch = null!;
  private _switchSource: Signal<any> = null!;
  private _switch: any;
  private _priorityRef: ValueRef<PriorityLevel> = null!;
  private _caseViews: [CaseView, Signal<any>][] = [];
  private _defaultViews: CaseView[] = [];
  private _viewsToInitialize: CaseView[] | null = [];
  private _watcher: Watch | null = null;
  private _abortTask: AbortTaskFunction | null = null;
  private _abortEventTask: AbortTaskFunction | null = null;
  private _emitEvent = false;
  private _scheduled = false;
  private _disposed = false;
  isChecking = false;

  get priority(): PriorityLevel {
    return this._priorityRef.value;
  }

  initialize(
    directive: QueuexSwitch,
    cdRef: ChangeDetectorRef,
    switchSource: Signal<any>,
    priorityRef: ValueRef<PriorityLevel>
  ): void {
    this._directive = directive;
    this._switchSource = switchSource;
    this._priorityRef = priorityRef;

    this._watcher = createWatch(
      () => this._runEffect(),
      () => this._scheduleEffect(),
      true
    )
    this._watcher.notify();
  }
  addCase(caseView: CaseView, caseSource: Signal<any>): void {
    this._caseViews.push([caseView, caseSource]);
    this._viewsToInitialize!.push(caseView);
  }
  addDefault(defaultView: CaseView): void {
    this._defaultViews.push(defaultView);
    this._viewsToInitialize!.push(defaultView);
  }
  match(value: any): boolean {
    return value === this._switch;
  }
  shouldEmitRenderEvent(): void {
    this._emitEvent = true;
  }
  dispose(): void {
    this._disposed = true;
    if (this._watcher) { this._watcher.destroy(); }
    if (this._abortTask) { this._abortTask(); }
  }

  private _runEffect(): void {

    if (this._viewsToInitialize) {
      const prevConsumer = setActiveConsumer(null);
      try {
        for (let i = 0; i < this._viewsToInitialize.length; i++) {
          this._viewsToInitialize[i].initialize();
        }
        this._viewsToInitialize = null;
      } finally {
        setActiveConsumer(prevConsumer);
      }
    }

    this._switch = this._switchSource();

    let matched = false;
    for (let i = 0; i < this._caseViews.length; i++) {
      const [switchView, switchSource] = this._caseViews[i];
      matched = switchView.enforceState(this.match(switchSource())) || matched;
    }

    for (let i = 0; i < this._defaultViews.length; i++) {
      this._defaultViews[i].enforceState(!matched);
    }

    if (this._abortEventTask) { this._abortEventTask(); }
    this._abortEventTask = scheduleTask(() => {
      if (this._emitEvent) {
        this._emitEvent = false;
        this._directive.render.emit(this._switchSource());
      }
    }, this._priorityRef.value);

    this._scheduled = false;
  }

  private _scheduleEffect(): void {
    if (this._scheduled) { return; }
    this._scheduled = true;
    if(isInConcurrentTaskContext()) {
      onTaskExecuted(() => {
        if (this._disposed) { return; }
        this._watcher!.run();
      })
    } else {
      this._abortTask = scheduleTask(
        () => this._watcher!.run(),
        1 /** Priority.Highest */
      );
    }
  }

}

const QX_SWITCH_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_SWITCH_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ })

export function provideQueuexSwitchDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide:QX_SWITCH_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexSwitchDefaultPriority) }
}

/**
 * @Directive QueuexSwitch
 *
 * `QueuexSwitch` (`[qxSwitch]`) is the core structural directive of the switch family, designed as a drop-in replacement for Angular’s `NgSwitch` **(restricted to immutable objects)**.
 * It enables conditional rendering of templates based on the value of an expression, in combination with `QueuexSwitchCase` (`*qxSwitchCase`)
 * and `QueuexSwitchDefault` (`*qxSwitchDefault`).
 *
 * Each embedded view created by `QueuexSwitch` is:
 * - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, ensuring that it does not participate
 *   in the host component’s change detection cycle.
 * - Assigned its own **isolated reactive context**, which means signals read directly
 *   in the template can trigger fine-grained, independent change detection.
 *
 * When the `[qxSwitch]` expression changes, the directive activates the first matching `*qxSwitchCase` view (or the `*qxSwitchDefault` view if no case matches).
 * Because views are scheduled and detached, rendering is both efficient and predictable, even for complex UI states.
 *
 * ### Server side fallback
 *
 * On the server side, `QueuexSwitch` behaves like Angular’s native `NgSwitch`. No detached views or reactive contexts are created, and no concurrent scheduling
 * takes place. All cases are evaluated synchronously, ensuring predictable and performant SSR output.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading...</p>
 *   <p *qxSwitchCase="'success'">Data loaded successfully ✅</p>
 *   <p *qxSwitchCase="'error'">Something went wrong ❌</p>
 *   <p *qxSwitchDefault>Unknown state 🤔</p>
 * </div>
 * ```
 *
 * ### Inputs
 *
 * ```ts
 * *@Input({ required: true })
 * set qxSwitch(value: any | Signal<any>);
 *
 * // Priority level for concurrent scheduler, used for creating.
 * *@Input({ transform: advancePriorityInputTransform })
 * set priority(priority: PriorityLevel | Signal<PriorityLevel>);
 * ```
 *
 * ### Outputs
 * ```ts
 * //Emits event when at least one of templates gets created or destroyed.
 * readonly render: OutputEmitterRef<any>;
 * ```
 *
 */
@Directive({
  selector: '[qxSwitch]:not(ng-template)',
  providers: [{
    provide: SwitchView,
    useFactory: () => {
      if (isPlatformServer(inject(PLATFORM_ID))) {
        return new ServerSwitchView();
      } else {
        return new ClientSwitchView();
      }
    }
  }]
})
export class QueuexSwitch implements OnChanges, OnInit, AfterContentChecked, OnDestroy {
  private _priorityRef = value(inject(QX_SWITCH_DEFAULT_PRIORITY), NG_DEV_MODE ? '[qxSwitch][priority]' : undefined)
  private _switchSource = sharedSignal<any>(undefined);
  private _view = inject(SwitchView);
  private _cdRef = inject(ChangeDetectorRef);

  /**
   * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
   * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
   *
   * This input also accepts the signal of the previously mentioned values
   */
  @Input({ transform: advancePriorityInputTransform }) set priority(priority: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(priority);
  }

  @Input({ required: true }) set qxSwitch(value: any | Signal<any>) {
    this._switchSource.set(value);
  }

  /**
   * A output what will be emitted when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
   * The `render` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
   *
   * The `render` emits the latest value causing the view to update.
   */
  readonly render = output<any>();

  constructor() {
    assertNgQueuexIntegrated('[qxSwitch]: Assertion failed! "@ng-queuex/core" integration not provided.');
  }

  /**
   * @internal
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qxSwitch']) {
      this._view.isChecking = true
    }
  }

  /**
   * @internal
   */
  ngOnInit(): void {
    this._view.initialize(this, this._cdRef, this._switchSource.ref, this._priorityRef);
  }

  /**
   * @internal
   */
  ngAfterContentChecked(): void {
    this._view.isChecking = false;
  }

  /**
   * @internal
   */
  ngOnDestroy(): void {
    this._view.dispose();
  }
}

/**
 * `QueuexSwitchCase` (`*qxSwitchCase`) is a companion structural directive to  `QueuexSwitch` (`[qxSwitch]`). It defines a template block that
 * is rendered when the bound `qxSwitch` expression matches the provided case value.
 *
 * Each case view created by this directive is:
 * - **Lazily instantiated** through the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, so it is not affected by the host
 *   component’s change detection cycle.
 * - Given its own **isolated reactive context**, which allows signals read directly
 *   in the template to trigger local, fine-grained change detection.
 *
 * When the parent `[qxSwitch]` value changes, `QueuexSwitchCase` views are efficiently  scheduled and activated or destroyed depending
 * on whether their case matches.
 *
 * ### Server side fallback
 *
 * During server-side rendering, `QueuexSwitchCase` falls back to the behavior of  Angular’s native `NgSwitchCase`. Views are instantiated
 * synchronously and remain part of the standard logical view tree. No detachment, no isolated reactive contexts, and no scheduling are
 * applied — ensuring clean, fast, and predictable SSR output.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading…</p>
 *   <p *qxSwitchCase="'success'">Data loaded ✅</p>
 *   <p *qxSwitchCase="'error'">Something went wrong ❌</p>
 *   <p *qxSwitchDefault>Unknown state 🤔</p>
 * </div>
 * ```
 * ### Inputs
 * ```ts
 * *@Input({ required: true })
 * set qxSwitchCase(value: any | Signal<any>);
 * ```
 */
@Directive({ selector: 'ng-template[qxSwitchCase]' })
export class QueuexSwitchCase implements OnChanges, DoCheck, AfterContentChecked, OnDestroy {
  private _caseSource = sharedSignal<any>(undefined, NG_DEV_MODE ? '[qxSwitchCase]' : undefined);
  private _caseView: CaseView;

  @Input({ required: true }) set qxSwitchCase(value: any | Signal<any>) {
    this._caseSource.set(value)
  }

  constructor() {
    assertNgQueuexIntegrated('[qxSwitchCase]: Assertion failed! "@ng-queuex/core" integration not provided.');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._caseView = new ServerCaseView(this._caseSource.ref);
    } else {
      this._caseView = new ClientCaseView(this._caseSource.ref);
    }
  }

  /**
   * @internal
   */
  ngOnChanges(changes: SimpleChanges): void {
    this._caseView.isChecking = true;
  }

  /**
   * @internal
   */
  ngDoCheck(): void {
    this._caseView.check();
  }

  /**
   * @internal
   */
  ngAfterContentChecked(): void {
    this._caseView.isChecking = false;
  }

  /**
   * @internal
   */
  ngOnDestroy(): void {
    this._caseView.dispose();
  }

}

/**
 * `QueuexSwitchDefault` (`*qxSwitchDefault`) is a companion structural directive for `QueuexSwitch` (`[qxSwitch]`). It defines a fallback template
 * that is rendered  when none of the `*qxSwitchCase` values match the parent `[qxSwitch]` expression.
 *
 * The default view created by this directive is:
 * - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, ensuring it is independent of the
 *   host component’s change detection.
 * - Assigned its own **isolated reactive context**, so signals read directly in the
 *   template can trigger local, fine-grained change detection.
 *
 * If present, it guarantees that the switch will always render some content when no explicit case matches.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading…</p>
 *   <p *qxSwitchCase="'success'">Data loaded ✅</p>
 *   <p *qxSwitchDefault>Nothing matched 🤷</p>
 * </div>
 * ```
 *
 */
@Directive({ selector: 'ng-template[qxSwitchDefault]' })
export class QueuexSwitchDefault implements OnDestroy {
  private _view: CaseView

  constructor() {
    assertNgQueuexIntegrated('[qxSwitchDefault]: Assertion failed! "@ng-queuex/core" integration not provided.');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._view = new ServerCaseView(null);
    } else {
      this._view = new ClientCaseView(null);
    }
  }

  /**
   * @internal
   */
  ngOnDestroy(): void {
    this._view.dispose();
  }
}

// const imports: any[] = [QueuexSwitchCase, QueuexSwitchDefault]

// /**
//  * `QueuexSwitchModule` bundles together the `QueuexSwitch` family of structural  directives, providing a drop-in replacement for Angular’s `NgSwitch` system.
//  *
//  * It includes:
//  * - `QueuexSwitch` (`[qxSwitch]`) – the container directive controlling the switch context.
//  * - `QueuexSwitchCase` (`*qxSwitchCase`) – defines conditional views based on case values.
//  * - `QueuexSwitchDefault` (`*qxSwitchDefault`) – defines the fallback view when no case matches.
//  *
//  * Compared to Angular’s `NgSwitch`, the Queuex version provides:
//  * - **Lazy view creation** using the concurrent scheduler from `ng-queuex/core`.
//  * - **Detachment from Angular’s logical tree** for each embedded view.
//  * - **Isolated reactive contexts** allowing direct signals in templates
//  *   to trigger independent, fine-grained change detection.
//  *
//  * @usageNotes
//  * Import `QueuexSwitchModule` into your feature module to make the directives available:
//  *
//  * ```ts
//  * @NgModule({
//  *   imports: [CommonModule, QueuexSwitchModule],
//  *   declarations: [MyComponent]
//  * })
//  * export class MyFeatureModule {}
//  * ```
//  *
//  * @example
//  * ```html
//  * <div [qxSwitch]="status">
//  *   <p *qxSwitchCase="'loading'">Loading...</p>
//  *   <p *qxSwitchCase="'success'">Loaded ✅</p>
//  *   <p *qxSwitchDefault>Unknown state 🤔</p>
//  * </div>
//  * ```
//  *
//  * @class
//  * @name QueuexSwitchModule
//  */
// @NgModule({
//   imports: imports,
//   exports: imports,
// })
// export class QueuexSwitchModule {}

function throwQxSwitchProviderNotFoundError(attrName: string, directiveName: string): never {
  throw new Error(
    `An element with the "${attrName}" attribute ` +
    `(matching the "${directiveName}" directive) must be located inside an element with the "qxSwitch" attribute ` +
    `(matching "QueuexSwitch" directive)`,
  );
}
