import { isPlatformServer } from "@angular/common";
import { Directive, DoCheck, inject, InjectionToken, Input, OnDestroy, PLATFORM_ID, Signal, TemplateRef, ValueProvider, ViewContainerRef, ViewRef } from "@angular/core";
import { AbortTaskFunction, advancePriorityInputTransform, assertNgQueuexIntegrated, detectChangesSync, PriorityLevel, PriorityName, priorityNameToNumber, scheduleChangeDetection, scheduleTask, value } from "@ng-queuex/core";
import { NG_DEV_MODE } from "../utils/utils";

const QX_SCHEDULED_VIEW_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_SCHEDULED_VIEW_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });

export function provideQueuexScheduledViewDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_SCHEDULED_VIEW_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexScheduledViewDefaultPriority) };
}

/**
 * `QueuexScheduledView` (`*scheduledView`) is a structural directive that lazily instantiates its template and
 * detaches it from Angular’s logical view tree. Unlike `QueuexReactiveView`, it does not create an isolated reactive context.
 *
 * Instead, the directive relies on Angular’s `ngDoCheck` lifecycle hook to plan local change detection runs
 * via the concurrent scheduler from `ng-queuex/core`. This makes it suitable for scenarios where you need:
 * - A detached, lazily created view,
 * - No reactive signals directly driving change detection,
 * - But still automatic local updates scheduled on each Angular check cycle.
 *
 * In other words, the scheduler orchestrates when the detached view runs its own change detection, ensuring that rendering
 * remains efficient while independent of the host component’s CD cycle.
 *
 * ### Server side fallback
 *
 * On the server side, `QueuexScheduledView` is fully transparent. Views are created synchronously without detachment, reactive contexts,
 * or scheduling, ensuring clean and predictable SSR output.
 *
 * @example
 * ```html
 * <!-- Default priority (Normal = 3) -->
 * <section *scheduledView>
 *   Last updated: {{ lastUpdate | date:'shortTime' }}
 * </section>
 *
 * <!-- Explicit numeric priority -->
 * <section *scheduledView="1">
 *   Heavy widget content rendered with highest priority
 * </section>
 *
 * <!-- Priority from component property -->
 * <section *scheduledView="priorityLevel">
 *   Dynamic priority scheduled content
 * </section>
 *
 * <!-- Priority as string literal -->
 * <section *scheduledView="'low'">
 *   Low priority scheduled content
 * </section>
 * ```
 *
 * @note
 * `QueuexScheduledView` does not react to signals directly. Instead, local change detection is triggered by the concurrent
 * scheduler during Angular’s check cycle (`ngDoCheck`).
 *
 * ### Inputs
 *
 * ```ts
 * //A priority for concurrent scheduler to manage local change detection.
 * *@Input({ alias: 'scheduledView', transform: advancePriorityInputTransform })
 * set priority(priority: PriorityLevel | Signal<PriorityLevel>);
 *
 * //A callback what will be call after view creation.
 * *Input()
 * scheduledViewRenderCallback: (() => void) | null = null;
 * ````
 *
 */
@Directive({ selector: 'ng-template[scheduledView]' })
export class QueuexScheduledView implements DoCheck, OnDestroy {
  private _abortTask: AbortTaskFunction | null = null;
  private _renderCallbackAbortTask: AbortTaskFunction | null = null;
  private _viewRef: ViewRef | null = null;
  private _priorityRef = value<PriorityLevel>(inject(QX_SCHEDULED_VIEW_DEFAULT_PRIORITY), NG_DEV_MODE ? '[scheduledView]="priorityLevel"' : undefined);
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _isServer = isPlatformServer(inject(PLATFORM_ID));

  /**
   * A priority for concurrent scheduler to create view and manage local change detection. It can be set as numeric value (1-5) or as
   * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
   *
   * This input also accepts the signal of the previously mentioned values.
   */
  @Input({ alias: 'scheduledView', transform: advancePriorityInputTransform }) set priority(priority: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(priority);
  }

  /**
   * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
   * The `scheduledViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
   *
   * The `scheduledViewRenderCallback` emits the latest value causing the view to update.
   */
  @Input() scheduledViewRenderCallback: (() => void) | null = null;

  constructor() {
    assertNgQueuexIntegrated('[scheduledView]: Assertion failed! "@ng-queuex/core" integration not provided.');
    if (this._isServer) {
      this._vcRef.createEmbeddedView(this._tmpRef);
    }
  }

  ngDoCheck(): void {
    if (this._isServer) { return; }
    this._abortTask = scheduleChangeDetection(
      () => this._checkView(),
      this._priorityRef.value,
      this._viewRef
    )
    if (!this._viewRef) {
      this._renderCallbackAbortTask = scheduleTask(
        () => {
          if (this.scheduledViewRenderCallback) {
            this.scheduledViewRenderCallback()
          }
        }, this._priorityRef.value
      )
    }
  }

  ngOnDestroy(): void {
    if (this._abortTask) { this._abortTask(); }
    if (this._renderCallbackAbortTask) { this._renderCallbackAbortTask(); }
  }

  private _checkView(): void {
    if (!this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      this._viewRef.detach();
    }
    detectChangesSync(this._viewRef);
  }
}
