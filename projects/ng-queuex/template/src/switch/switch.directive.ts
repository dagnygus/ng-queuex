import {
  createWatch,
  ReactiveHookFn,
  ReactiveNode,
  setActiveConsumer,
  setPostSignalSetFn,
  Watch
} from "@angular/core/primitives/signals"
import {
  AfterContentInit,
  Directive,
  DoCheck,
  effect,
  inject,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  Signal,
  TemplateRef,
  ValueProvider,
  ViewContainerRef,
  ViewRef
} from "@angular/core";
import { isPlatformServer } from "@angular/common";
import {
  AbortTaskFunction,
  detectChangesSync,
  priorityInputTransform,
  PriorityLevel,
  PriorityName,
  priorityNameToNumber,
  scheduleChangeDetection,
  scheduleTask
} from "@ng-queuex/core";
import { assertSignal } from "../utils/utils";
import { isFlagDefined, runCbWhenFlagDefined } from "../utils/test_utils";

declare const ngDevMode: boolean | undefined;

export function syncWatch<T>(source: Signal<T>, cb: (value: T) => void): Watch {
  let prevHook: ReactiveHookFn | null = null;
  let node: ReactiveNode | null = null;
  const hook: ReactiveHookFn = (n) => {
    node = n;
    watch.run();
  }
  const watch = createWatch(
    () => {
      setPostSignalSetFn(prevHook);
      if (prevHook) {
        prevHook(node!);
      }
      const value = source();
      const prevConsumer = setActiveConsumer(null);
      try {
        cb(value);
      } finally {
        setActiveConsumer(prevConsumer);
      }
    },
    () => {
      prevHook = setPostSignalSetFn(hook);
    },
    true
  );
  watch.notify();
  watch.run();

  return watch;
}

class SwitchView {
  private _create = signal(false);
  private _viewRef: ViewRef | null = null;
  private _watcher: Watch | null = null;
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _abortTask: AbortTaskFunction | null = null;
  private _scheduled = false;
  private _shouldRunRenderCb = false;

  constructor(
    private _qxSwitch: QueuexSwitch<any>
  ) {
    runCbWhenFlagDefined('dag', () => console.log('constructor'));
    if (isPlatformServer(inject(PLATFORM_ID))) {
      effect(() => this._update(false))
    } else {
      this._watcher = createWatch(
        () => this._update(true),
        () => {
          if (this._scheduled) { return; }
          this._scheduled = true;
          this._abortTask = scheduleChangeDetection(() =>  {
            this._watcher!.run();
            this._scheduled = false;
          },
          this._qxSwitch.priority,
          this._viewRef)
        },
        false
      );
      this._watcher.notify();
    }
  }

  enforceState(create: boolean) {
    this._create.set(create)
  }

  dispose(): void {
    if (this._abortTask) {
      this._abortTask();
    }
    if (this._watcher) {
      this._watcher.destroy();
    }
  }

  private _update(isClient: boolean) {
    const create = this._create();
    if (create && !this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      if (isClient) {
        this._viewRef.detach();
        this._shouldRunRenderCb = true;
      }
    } else if (!create && this._viewRef) {
      this._vcRef.clear();
      this._viewRef = null;
      if (isClient) {
        this._shouldRunRenderCb = true;
      }
      return;
    }
    if (isClient && this._viewRef) {
      detectChangesSync(this._viewRef);
    }
  }
}

const QX_SWITCH_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_SWITCH_DEFAULT_PRIORITY', { factory: () =>  3 /* Priority.Normal */});

export function provideQueuexSwitchDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_SWITCH_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority) }
}

@Directive({ selector: '[qxSwitch]' })
export class QueuexSwitch<T> implements OnInit, AfterContentInit, OnDestroy {
  private _defaultViews: SwitchView[] = [];
  private _defaultUsed = false;
  private _caseCount = 0;
  private _lastCaseCheckIndex = 0;
  private _lastCasesMatched = false;
  private _sealed = false;
  private _watcher: Watch = null!;
  private _abortTask: AbortTaskFunction | null = null;

  @Input({ required: true }) qxSwitch: Signal<T> = null!
  @Input({ transform: priorityInputTransform }) priority = inject(QX_SWITCH_DEFAULT_PRIORITY);

  ngOnInit(): void {
    if (typeof ngDevMode === 'undefined' && ngDevMode) {
      assertSignal(this.qxSwitch, 'qxSwitch');
    }

    this._watcher = syncWatch(this.qxSwitch, () => {
      if (this._caseCount === 0) {
        this._updateDefaultCases(true);
      }
    });
  }

  ngAfterContentInit(): void {
    this._sealed = true;
  }

  ngOnDestroy(): void {
    this._watcher.destroy();
    this._abortTask?.();
  }

  _isSealed(): boolean {
    return this._sealed;
  }

  _addCase(): void {
    this._caseCount++;
  }

  _addDefault(defaultView: SwitchView) {
    this._defaultViews.push(defaultView);
  }

  _matchCase(value: any): boolean {
    const matched = value === this.qxSwitch();
    this._lastCasesMatched ||= matched;
    this._lastCaseCheckIndex++;
    if (this._lastCaseCheckIndex === this._caseCount) {
      this._updateDefaultCases(!this._lastCasesMatched);
      this._lastCaseCheckIndex = 0;
      this._lastCasesMatched = false;
    }
    return matched;
  }

  private _updateDefaultCases(useDefault: boolean) {
    if (this._defaultViews.length && this._defaultUsed !== useDefault){
      this._defaultUsed = useDefault;
      for (let i = 0; i < this._defaultViews.length; i++) {
        this._defaultViews[i].enforceState(useDefault);
      }
    }
  }
}

@Directive({ selector: '[qxSwitchCase]' })
export class QueuexSwitchCase implements OnInit, DoCheck, AfterContentInit, OnDestroy {
  private _qxSwitch: QueuexSwitch<any> = inject(QueuexSwitch, { host: true, optional: true })!;
  private _view: SwitchView;
  private _watcher: Watch | null = null;
  private _init = false;
  private _isServer = isPlatformServer(inject(PLATFORM_ID));

  @Input({ required: true }) qxSwitchCase: any;
  @Input() qxSwitchCaseRenderCallback: ((arg: any) => void) | null = null;

  constructor() {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (!this._qxSwitch) {
        throwQxSwitchProviderNotFoundError('qxSwitchCase', 'QueuexSwitchCase');
      }
      if (this._qxSwitch._isSealed()) {
        throwQxSwitchSealedError('qxSwitchCase', 'QueuexSwitchCase');
      }
    }
    this._qxSwitch._addCase();
    this._view = new SwitchView(this._qxSwitch);
  }

  ngOnInit(): void {
    if (this._isServer) { return; }
    this._watcher = syncWatch(this._qxSwitch.qxSwitch, () => {
      if (this._init) {
        this._view.enforceState(this._qxSwitch._matchCase(this.qxSwitchCase));
      }
    });
  }

  ngDoCheck(): void {
    this._view.enforceState(this._qxSwitch._matchCase(this.qxSwitchCase));
  }

  ngAfterContentInit(): void {
    this._init = true;
  }

  ngOnDestroy(): void {
    if (this._watcher) {
      this._watcher.destroy();
    }
    this._view.dispose();
  }
}

@Directive({ selector: '[qxSwitchDefault]' })
export class QueuexSwitchDefault implements OnDestroy {
  private _qxSwitch: QueuexSwitch<any>;
  private _view: SwitchView

  @Input() qxSwitchDefaultRenderCallback: ((arg: any) => void) | null = null;

  constructor() {
    const qxSwitch = inject(QueuexSwitch, { host: true, optional: true })!;
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (!qxSwitch) {
        throwQxSwitchProviderNotFoundError('qxSwitchDefault', 'QueuexSwitchDefault');
      }
      if (qxSwitch._isSealed()) {
        throwQxSwitchSealedError('qxSwitchDefault', 'QueuexSwitchDefault');
      }
    }
    this._qxSwitch = qxSwitch;
    this._view = new SwitchView(qxSwitch);
    qxSwitch._addDefault(this._view);
  }

  ngOnDestroy(): void {
    this._view.dispose();
  }
}

function throwQxSwitchProviderNotFoundError(attrName: string, directiveName: string): never {
  throw new Error(
    `An element with the "${attrName}" attribute ` +
    `(matching the "${directiveName}" directive) must be located inside an element with the "qxSwitch" attribute ` +
    `(matching "QueuexSwitch" directive)`,
  );
}

function throwQxSwitchSealedError(attrName: string, directiveName: string): never {
  throw new Error(
    `An element with the "${attrName}" attribute ` +
    `(matching the "${directiveName}" directive) was dynamically added to content of element with "qxSwitch" attribute` +
    `(matching "QueuexSwitch" directive) after "QueuexSwitch" directive initialization, what is forbidden.`
  )
}
