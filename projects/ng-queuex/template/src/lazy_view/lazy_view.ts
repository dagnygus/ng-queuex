import { isPlatformServer } from "@angular/common";
import { Directive, inject, InjectionToken, Input, OnDestroy, OnInit, PLATFORM_ID, TemplateRef, ValueProvider, ViewContainerRef, ɵmarkForRefresh } from "@angular/core";
import { AbortTaskFunction, assertNgQueuexIntegrated, priorityInputTransform, PriorityLevel, PriorityName, priorityNameToNumber, scheduleTask } from "@ng-queuex/core";

const QX_LAZY_VIEW_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('PriorityLevel', { factory: () => 3 /* Priority.Normal */ });
/**
 * @deprecated
 * Provides an override for `QueuexLazyView` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
export function provideQueuexLazyViewDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_LAZY_VIEW_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexLazyViewDefaultPriority) }
}

/**
 * @Directive QueuexLazyView
 *
 * `QueuexLazyView` (`*lazyView`) is a lightweight structural directive that lazily instantiates its template without detaching it
 * from Angular’s logical tree  and without creating a separate reactive context.
 *
 * Unlike `QueuexReactiveView`, this directive does not create isolated reactive contexts. However, it still supports
 * **prioritized lazy rendering** through its main input. The priority determines when the view is instantiated relative to other scheduled tasks.
 *
 * Priority can be provided in several ways:
 * - Numeric value: `*lazyView="3"` (1–5, default is `3` – Normal)
 * - Property binding: `*lazyView="priorityLevel"`
 * - String literal: `*lazyView="'highest'" | 'high' | 'normal' | 'low' | 'lowest'`
 *
 * This makes `QueuexLazyView` suitable for medium-sized UI fragments that benefit from lazy creation, while keeping standard Angular change detection.
 *
 * @example
 * ```html
 * <!-- Default priority (Normal) -->
 * <section *lazyView>
 *   <p>{{ message }}</p>
 * </section>
 *
 * <!-- Explicit numeric priority -->
 * <section *lazyView="1">
 *   <p>High priority content</p>
 * </section>
 *
 * <!-- Priority from component property -->
 * <section *lazyView="priorityLevel">
 *   <p>Dynamic priority content</p>
 * </section>
 *
 * <!-- Priority as string literal -->
 * <section *lazyView="'low'">
 *   <p>Low priority content</p>
 * </section>
 * ```
 *
 * ### Inputs
 *
 * ```ts
 * // A priority for concurrent scheduler to create view.
 * *@Input({ alias: 'lazyView', transform: priorityInputTransform })
 * priority: PriorityLevel;
 *
 * // A callback what will be called after view creation.
 * *@Input()
 * lazyViewRenderCallback: (() => void) | null = null;
 * ```
 */
@Directive({ selector: 'ng-template[lazyView]' })
export class QueuexLazyView implements OnInit, OnDestroy {
  private _abortTask: AbortTaskFunction | null = null;
  private _renderCbAbortTask: AbortTaskFunction | null = null;
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _isServer = false;

  /**
   * A priority for concurrent scheduler to create view. It can be set as numeric value (1-5) or as
   * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
   */
  @Input({ alias: 'lazyView', transform: priorityInputTransform }) priority = inject(QX_LAZY_VIEW_DEFAULT_PRIORITY);

  /**
   * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
   * The `lazyViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
   *
   * The `lazyViewRenderCallback` emits the latest value causing the view to update.
   */
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

