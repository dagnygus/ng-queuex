import { isPlatformServer } from "@angular/common";
import { Directive, inject, InjectionToken, Input, OnDestroy, OnInit, PLATFORM_ID, Signal, TemplateRef, ValueProvider, ViewContainerRef, ViewRef } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, advancePriorityInputTransform, assertNgQueuexIntegrated, detectChangesSync, PriorityLevel, PriorityName, priorityNameToNumber, scheduleChangeDetection, scheduleTask, value } from "@ng-queuex/core";
import { NG_DEV_MODE } from "../utils/utils";

const QX_REACTIVE_VIEW_PRIORITY = new InjectionToken<PriorityLevel>('QX_REACTIVE_VIEW_PRIORITY', { factory: () => 3 })

/**
 * @description
 * Provides an override for `QueuexReactiveView` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
export function provideQueuexReactiveViewDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_REACTIVE_VIEW_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexReactiveViewDefaultPriority) }
}

/**
 * @Directive QueuexReactiveView
 *
 * `QueuexReactiveView` (`*reactiveView`) is a structural directive for rendering larger portions of the UI in a reactive, scheduler-driven way.
 * It works similarly to `QueuexWatch`, but instead of creating the embedded view immediately, it instantiates it lazily and manages its
 * lifecycle through a prioritized concurrent scheduler.
 *
 * By default, the directive uses **Normal (3)** priority. The priority level controls both when the view is created and how its change detection is scheduled.
 * Developers can override this behavior by providing a priority directly through the main input:
 *
 * - As a numeric value: `*reactiveView="3"` (valid values: 1–5)
 * - As a property binding: `*reactiveView="priorityLevel"`
 * - As a string literal: `*reactiveView="'normal'"`
 *   (valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`)
 *
 * This makes it possible to fine-tune how reactive views are scheduled and updated, striking the right balance between responsiveness and performance. Because views
 * are created lazily and scheduled with explicit priorities, `QueuexReactiveView` is particularly suited for larger UI fragments or more complex sub-trees, where eager
 * rendering would be costly.
 *
 * @note
 * Change detection is triggered only for signals read directly in the template. Signals used inside child components or elsewhere in the component class will
 * not automatically trigger local change detection within the reactive view.
 *
 * ### Server side fallback
 *
 * On the server side, `QueuexReactiveView` is fully transparent. All client-side scheduling, lazy view creation, and reactive context features
 * are disabled during SSR. The directive falls back to standard Angular template rendering,  ensuring clean, predictable HTML output without introducing overhead.
 *
 * @example
 * ```html
 * <!-- Default priority (normal, 3) -->
 * <div *reactiveView>
 *   Counter: {{ counter() }}
 * </div>
 * <section *reactiveView>
 *   <app-dashboard></app-dashboard>
 * </section>
 *
 * <!-- Explicit priority as number -->
 * <div *reactiveView="1">
 *   Current user: {{ userName() }}
 * </div>
 * <section *reactiveView="1">
 *   <app-heavy-chart></app-heavy-chart>
 * </section>
 *
 * <!-- Priority bound to component property -->
 * <div *reactiveView="priorityLevel">
 *   Items total: {{ itemsCount() }}
 * </div>
 * <section *reactiveView="priorityLevel">
 *   <app-dynamic-feed></app-dynamic-feed>
 * </section>
 *
 * <!-- Priority as string literal -->
 * <div *reactiveView="'low'">
 *   Status: {{ statusSignal() }}
 * </div>
 * <section *reactiveView="'low'">
 *   <app-lazy-widget></app-lazy-widget>
 * </section>
 * ```
 *
 * ### Inputs
 *
 * ```ts
 * // A priority for concurrent scheduler to manage view.
 * *@Input({ alias: 'reactiveView', transform: advancePriorityInputTransform })
 * set priority(value: PriorityLevel | Signal<PriorityLevel>);
 *
 * // A callback what will be called after view creation.
 * *@Input()
 * reactiveViewRenderCallback: (() => void) | null = null;
 * ```
 *
 *
 *
 */
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
  private _priorityRef = value(inject(QX_REACTIVE_VIEW_PRIORITY), NG_DEV_MODE ? '[reactiveView]="priorityLevel"' : undefined)

  /**
   * A priority for concurrent scheduler to manage view. It can be set as numeric value (1-5) or as
   * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
   *
   * This input also accepts the signal of the previously mentioned values.
   */
  @Input({ alias: 'reactiveView', transform: advancePriorityInputTransform }) set priority(value: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(value);
  }

  /**
   * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
   * The `reactiveViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
   *
   * The `reactiveViewRenderCallback` emits the latest value causing the view to update.
   */
  @Input() reactiveViewRenderCallback: (() => void) | null = null;

  constructor() {
    assertNgQueuexIntegrated('[reactiveView]: Assertion failed! "@ng-queuex/core" integration not provided.');
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
