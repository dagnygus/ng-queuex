import { isPlatformServer } from "@angular/common";
import { Directive, inject, InjectionToken, Input, OnDestroy, OnInit, PLATFORM_ID, TemplateRef, ValueProvider, ViewContainerRef, ɵmarkForRefresh } from "@angular/core";
import { AbortTaskFunction, assertNgQueuexIntegrated, priorityInputTransform, PriorityLevel, PriorityName, priorityNameToNumber, scheduleTask } from "@ng-queuex/core";

const QX_LAZY_VIEW_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('PriorityLevel', { factory: () => 3 /* Priority.Normal */ });

export function provideQueuexLazyViewDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_LAZY_VIEW_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexLazyViewDefaultPriority) }
}

@Directive({ selector: 'ng-template[lazyView]' })
export class QueuexLazyView implements OnInit, OnDestroy {
  private _abortTask: AbortTaskFunction | null = null;
  private _renderCbAbortTask: AbortTaskFunction | null = null;
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _isServer = false;

  @Input({ alias: 'lazyView', transform: priorityInputTransform }) priority = inject(QX_LAZY_VIEW_DEFAULT_PRIORITY);
  @Input() lazyViewRenderCallback: (() => void) | null = null;

  constructor() {
    assertNgQueuexIntegrated('[lazyView]: Assertion failed! "@ng-queuex/core" integration not provided.');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._vcRef.createEmbeddedView(this._tmpRef);
      this._isServer = true
    }
  }

  ngOnInit(): void {
    if (this._isServer) { return; }
    this._abortTask = scheduleTask(() => {
      const viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      ɵmarkForRefresh(viewRef as any);
    }, this.priority);
    this._renderCbAbortTask = scheduleTask(() => {
      this.lazyViewRenderCallback?.();
    }, this.priority)
  }

  ngOnDestroy(): void {
    this._abortTask?.();
    this._renderCbAbortTask?.();
  }
}

