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
  NgModule,
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
      this._viewRef.detectChanges();
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
    )
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

  @Input({ transform: advancePriorityInputTransform }) set priority(priority: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(priority);
  }
  @Input({ required: true }) set qxSwitch(value: any) {
    this._switchSource.set(value);
  }

  render = output<any>();

  constructor() {
    assertNgQueuexIntegrated('[qxSwitch]: Assertion failed! "@ng-queuex/core" integration not provided.');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qxSwitch']) {
      this._view.isChecking = true
    }
  }

  ngOnInit(): void {
    this._view.initialize(this, this._cdRef, this._switchSource.ref, this._priorityRef);
  }

  ngAfterContentChecked(): void {
    this._view.isChecking = false;
  }

  ngOnDestroy(): void {
    this._view.dispose();
  }

}

@Directive({ selector: 'ng-template[qxSwitchCase]' })
export class QueuexSwitchCase implements OnChanges, DoCheck, AfterContentChecked, OnDestroy {
  private _caseSource = sharedSignal<any>(undefined, NG_DEV_MODE ? '[qxSwitchCase]' : undefined);
  private _caseView: CaseView;

  @Input({ required: true }) set qxSwitchCase(value: any) {
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

  ngOnChanges(changes: SimpleChanges): void {
    this._caseView.isChecking = true;
  }

  ngDoCheck(): void {
    this._caseView.check();
  }

  ngAfterContentChecked(): void {
    this._caseView.isChecking = false;
  }

  ngOnDestroy(): void {
    this._caseView.dispose();
  }

}

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

  ngOnDestroy(): void {
    this._view.dispose();
  }
}

const imports = [QueuexSwitch, QueuexSwitchDefault, QueuexSwitchDefault]

@NgModule({
  imports: imports,
  exports: imports
})
export class QueuexSwitchModule {}

function throwQxSwitchProviderNotFoundError(attrName: string, directiveName: string): never {
  throw new Error(
    `An element with the "${attrName}" attribute ` +
    `(matching the "${directiveName}" directive) must be located inside an element with the "qxSwitch" attribute ` +
    `(matching "QueuexSwitch" directive)`,
  );
}
