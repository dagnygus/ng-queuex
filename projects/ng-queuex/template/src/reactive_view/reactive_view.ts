import { isPlatformServer } from "@angular/common";
import { Directive, inject, InjectionToken, Input, OnDestroy, OnInit, PLATFORM_ID, Signal, TemplateRef, ValueProvider, ViewContainerRef, ViewRef } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, advancePriorityInputTransform, assertNgQueuexIntegrated, detectChangesSync, PriorityLevel, PriorityName, priorityNameToNumber, scheduleChangeDetection, scheduleTask, value } from "@ng-queuex/core";

const QX_REACTIVE_VIEW_PRIORITY = new InjectionToken<PriorityLevel>('QX_REACTIVE_VIEW_PRIORITY', { factory: () => 3 })

export function provideQueuexReactiveViewDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_REACTIVE_VIEW_PRIORITY, useValue: priorityNameToNumber(priority) }
}

@Directive({ selector: 'ng-template[reactiveView]' })
export class QueuexReactiveView implements OnInit, OnDestroy {
  private _tmpRef = inject(TemplateRef);
  private _vcRef = inject(ViewContainerRef);
  private _watcher: Watch | null = null;
  private _viewRef: ViewRef | null = null;
  private _scheduled = false;
  private _abortTask: AbortTaskFunction | null = null;
  private _renderCbAbortTask: AbortTaskFunction | null = null;
  private _isServer = false;
  private _priorityRef = value(inject(QX_REACTIVE_VIEW_PRIORITY), (typeof ngDevMode === 'undefined' || ngDevMode) ? 'reactiveView="priorityLevel"' : undefined)

  @Input({ alias: 'reactiveView', transform: advancePriorityInputTransform }) set priority(value: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(value);
  }
  @Input() reactiveViewRenderCallback: (() => void) | null = null;

  constructor() {
    assertNgQueuexIntegrated('[reactiveView]: Assertion failed! "@ng-queuex/core" not provided.');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._vcRef.createEmbeddedView(this._tmpRef);
      this._isServer = true;
    }
  }

  ngOnInit(): void {
    if (this._isServer) { return; }
    this._watcher = createWatch(
      () => this._effectCallback(),
      () => this._scheduleEffectCallback(),
      false
    );
    this._watcher.notify()
    this._renderCbAbortTask = scheduleTask(
      () => {
        this.reactiveViewRenderCallback?.();
      },
      this._priorityRef.value
    )
  }

  private _effectCallback() {
    if (!this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
    }
    detectChangesSync(this._viewRef);
    this._scheduled = false;
  }

  private _scheduleEffectCallback() {
    if (this._scheduled) { return; }
    this._scheduled = true;

    this._abortTask = scheduleChangeDetection(
      () => this._watcher!.run(),
      this._priorityRef.value,
      this._viewRef
    )
  }

  ngOnDestroy(): void {
    this._abortTask?.();
    this._renderCbAbortTask?.();
    this._watcher?.destroy();
  }
}
