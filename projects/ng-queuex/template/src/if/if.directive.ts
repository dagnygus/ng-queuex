import { isPlatformBrowser } from "@angular/common";
import {
  assertNotInReactiveContext,
  ChangeDetectorRef,
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Signal,
  TemplateRef,
  ValueProvider,
  ViewContainerRef,
} from "@angular/core";
import {
  consumerAfterComputation,
  consumerBeforeComputation,
  consumerDestroy,
  consumerMarkDirty,
  consumerPollProducersForChange,
  createWatch,
  isInNotificationPhase,
  REACTIVE_NODE,
  ReactiveNode,
  setActiveConsumer,
  Watch
} from "@angular/core/primitives/signals";
import {
  PriorityLevel,
  assertNgQueuexIntegrated,
  PriorityName,
  priorityNameToNumber,
  scheduleChangeDetection,
  AbortTaskFunction,
  detectChangesSync,
  isInConcurrentTaskContext,
  onTaskExecuted,
  scheduleTask,
  ValueRef,
  sharedSignal,
  value,
  advancePriorityInputTransform
} from "@ng-queuex/core";
import { NG_DEV_MODE } from "../utils/utils";

interface QxIfView<T = unknown> {
  init(context: QueuexIfContext<T>): void
  dispose(): void;
}

interface QueuexIfEffectNode<T = unknown> extends ReactiveNode {
  hasRun: boolean;
  view: ClientQxIfView;
  scheduled: boolean;
  destroyed: boolean;
  run(): void;
  schedule(): void;
  destroy(): void;
  abortTask: AbortTaskFunction | null;
  tmpRef: TemplateRef<T> | null;
  renderCbShouldRun: boolean;
}

const BASE_THEN_QUEUEX_EFFECT_NODE: Omit<QueuexIfEffectNode, 'view' | 'destroyed' |  'scheduled' | 'hasRun' | 'abortTask' | 'tmpRef' | 'renderCbShouldRun'> =
  /* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    abortTask: null,
    consumerMarkedDirty(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
      }
      this.schedule();
    },
    schedule(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
      }

      if (this.destroyed || this.scheduled) { return; }
      this.scheduled = true;

      this.abortTask = scheduleChangeDetection(() => {
        if (this.destroyed) { return; }


        let thenViewRef = this.view.thenViewRef;
        const vcRef = this.view.vcRef;

        if (this.tmpRef !== this.view.thenTmpRef) {
          this.tmpRef = this.view.thenTmpRef;
          if (thenViewRef) {
            const index = vcRef.indexOf(thenViewRef);
            vcRef.remove(index);
            thenViewRef.detectChanges();
            this.view.thenViewRef = null;
            thenViewRef = null;
            this.renderCbShouldRun = true;
          }
        }

        if (this.view.context.$implicit()) {
          if (!thenViewRef) {
            this.view.thenViewRef = vcRef.createEmbeddedView(
              this.view.thenTmpRef,
              this.view.context
            );
            this.view.thenViewRef.detach();
            consumerMarkDirty(this);
            this.renderCbShouldRun = true;
          }
        } else {
          if (thenViewRef) {
            const index = vcRef.indexOf(thenViewRef)
            vcRef.remove(index);
            thenViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will down bellow this file;
            this.view.thenViewRef = null;
            this.renderCbShouldRun = true;
          }
        }

        if (this.dirty) {
          this.run();
        }

        this.scheduled = false;
      }, this.view.priorityRef.value, this.view.thenViewRef);
    },
    run(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE && isInNotificationPhase()) {
        throw new Error(`Schedulers cannot synchronously execute watches while scheduling.`);
      }

      this.dirty = false;
      if (this.hasRun && !consumerPollProducersForChange(this)) {
      return;
      }
      this.hasRun = true;

      const viewRef = this.view.thenViewRef;

      if (viewRef) {
        const prevConsumer = consumerBeforeComputation(this);
        try {
          detectChangesSync(viewRef);
        } finally {
          consumerAfterComputation(this, prevConsumer);
        }
      }
    },
    destroy(this: QueuexIfEffectNode) {
      if (this.destroyed) { return; }
      this.destroyed = true;
      consumerDestroy(this);
      this.abortTask?.()
    }
  }))();

  const BASE_ELSE_QUEUEX_EFFECT_NODE: Omit<QueuexIfEffectNode, 'view' | 'destroyed' |  'scheduled' | 'shouldRerender' | 'hasRun' | 'abortTask' | 'tmpRef' | 'renderCbShouldRun'> =
  /* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    consumerMarkedDirty(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!')
      }
      this.schedule();
    },
    schedule(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!')
      }

      if (this.destroyed || this.scheduled) { return; }
      this.scheduled = true;

      this.abortTask = scheduleChangeDetection(() => {
        if (this.destroyed) { return; }

        let elseViewRef = this.view.elseViewRef;
        const vcRef = this.view.vcRef;

        if (this.tmpRef !== this.view.elseTmpRef) {
          this.tmpRef = this.view.elseTmpRef
          if (elseViewRef) {
            const index = vcRef.indexOf(elseViewRef);
            vcRef.remove(index);
            elseViewRef.detectChanges()//To immediately clear dom. There is some issue with destroyed view. Explanation will be down bellow this file;
            this.view.elseViewRef = null;
            elseViewRef = null;
            this.renderCbShouldRun = true;
          }
        }

        if (this.view.context.$implicit()) {
          if (elseViewRef) {
            const index = vcRef.indexOf(elseViewRef)
            vcRef.remove(index);
            elseViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will br down bellow this file;
            this.view.elseViewRef = null;
            this.renderCbShouldRun = true;
          }
        } else {
          if (!elseViewRef && this.view.elseTmpRef) {
            this.view.elseViewRef = vcRef.createEmbeddedView(
              this.view.elseTmpRef,
              this.view.context
            );
            this.view.elseViewRef.detach();
            consumerMarkDirty(this);
            this.renderCbShouldRun = true;
          }
        }

        if (this.dirty) {
          this.run();
        }

        this.scheduled = false;
      }, this.view.priorityRef.value, this.view.elseViewRef);
    },
    run(this: QueuexIfEffectNode) {
      if (NG_DEV_MODE && isInNotificationPhase()) {
        throw new Error(`Schedulers cannot synchronously execute watches while scheduling.`);
      }

      this.dirty = false;
      if (this.hasRun && !consumerPollProducersForChange(this)) {
      return;
      }
      this.hasRun = true;

      const viewRef = this.view.elseViewRef;

      if (viewRef) {
        const prevConsumer = consumerBeforeComputation(this);
        try {
          detectChangesSync(viewRef);
        } finally {
          consumerAfterComputation(this, prevConsumer);
        }
      }
    },
    destroy(this: QueuexIfEffectNode) {
      if (this.destroyed) { return; }
      this.destroyed = true;
      consumerDestroy(this)
      this.abortTask?.()
    }
  }))();

  function createThenNode<T = unknown>(view: ClientQxIfView<T>): QueuexIfEffectNode<T> {
    const node = Object.create(BASE_THEN_QUEUEX_EFFECT_NODE) as QueuexIfEffectNode<any>
    node.view = view as any;
    node.abortTask = null;
    node.destroyed = false;
    node.scheduled = false;
    node.hasRun = false
    node.dirty = false;
    node.tmpRef = null;
    node.renderCbShouldRun = false
    return node;
  }

  function createElseNode<T = unknown>(view: ClientQxIfView<T>): QueuexIfEffectNode<T> {
    const node = Object.create(BASE_ELSE_QUEUEX_EFFECT_NODE) as QueuexIfEffectNode<T>
    node.view = view as any;
    node.abortTask = null;
    node.destroyed = false;
    node.scheduled = false;
    node.hasRun = false;
    node.dirty = false;
    node.tmpRef = null;
    node.renderCbShouldRun = false
    return node;
  }

const QX_IF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_IF_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });

/**
 * @description
 * Provides an override for `QueuexIf` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
export function provideQueuexIfDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_IF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexIfDefaultPriority) }
}

class ClientQxIfView<T = unknown> implements QxIfView<T> {

  context: QueuexIfContext<T> = null!;
  inputWatcher: Watch | null = null;
  thenNode: QueuexIfEffectNode<T> = null!;
  elseNode: QueuexIfEffectNode<T> = null!;
  thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  thenTmpRef: TemplateRef<QueuexIfContext<T>>;
  elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  vcRef = inject(ViewContainerRef)
  disposed = false;
  abortTask: AbortTaskFunction | null = null;
  renderCallbackAbortTask: AbortTaskFunction | null = null;
  renderCallbackScheduled = false;
  inputWatchScheduled = false;

  constructor(
    public ifDir: QueuexIf<T>,
    public thenTmpRefSource: Signal<TemplateRef<QueuexIfContext<T>>>,
    public elseTmpRefSource: Signal<TemplateRef<QueuexIfContext<T>> | null>,
    public priorityRef: ValueRef<PriorityLevel>
  ) {
    this.thenTmpRef = thenTmpRefSource()
  }

  init(context: QueuexIfContext<T>): void {
    this.context = context;

    this.inputWatcher = createWatch(
      () => this.inputWatchCallback(),
      () => this.scheduleInputWatchCallback(),
      false
    );

    this.thenNode = createThenNode(this);
    this.elseNode = createElseNode(this);

    this.inputWatcher.notify();
  }

  inputWatchCallback(): void {
    this.context.$implicit();
    this.thenTmpRef = assertTemplateRef(this.thenTmpRefSource(), 'qxIfThen')
    this.elseTmpRef = assertTemplateRef(this.elseTmpRefSource(), 'qxIfElse')

    const prevConsumer = setActiveConsumer(null);
    try {
      this.thenNode.schedule();
      this.elseNode.schedule();
    } finally {
      setActiveConsumer(prevConsumer);
    }
    this.scheduleRenderCallback();
    this.inputWatchScheduled = false;
  }

  scheduleInputWatchCallback(): void {
    if (this.inputWatchScheduled) { return; }
    this.inputWatchScheduled = true;

    if (isInConcurrentTaskContext()) {
      onTaskExecuted(() => {
        if (this.disposed) { return; }
        this.inputWatcher!.run();
      });
    } else {
      this.abortTask = scheduleTask(
        () => this.inputWatcher!.run(),
        1 //Highest
      );
    }
  }

  scheduleRenderCallback() {
    if (this.renderCallbackScheduled) { return; }
    this.renderCallbackScheduled = true

    this.renderCallbackAbortTask = scheduleTask(() => {
      if (this.thenNode.renderCbShouldRun || this.elseNode.renderCbShouldRun) {
        this.ifDir.qxIfRenderCallback?.(this.context.$implicit())
        this.thenNode.renderCbShouldRun = this.elseNode.renderCbShouldRun = false;
      }
      this.renderCallbackScheduled = false;
    });
  }

  dispose(): void {
    this.disposed = true;
    this.abortTask?.();
    this.renderCallbackAbortTask?.()
    this.inputWatcher?.destroy();
    this.thenNode?.destroy();
    this.elseNode?.destroy();
  }
}

class ServerQxIfView<T = unknown> implements QxIfView {

  context: QueuexIfContext<T> = null!;
  thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  thenTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  vcRef = inject(ViewContainerRef);
  cdRef = inject(ChangeDetectorRef);
  value: any
  directiveIsInit = false;

  constructor(
    thenTmpRefSource: Signal<TemplateRef<QueuexIfContext<T>>>,
    elseTmpRefSource: Signal<TemplateRef<QueuexIfContext<T>> | null>,
  ) {

    effect(() => {
      this.value = this.context.$implicit()
      this.update(
        this.value,
        assertTemplateRef(thenTmpRefSource(), 'qxIfThen'),
        assertTemplateRef(elseTmpRefSource(), 'qxIfElse')
      );
    })
  }

  init(context: QueuexIfContext<T>): void {
    this.context = context;
  }

  private update(
    value: T,
    thenTmpRef: TemplateRef<QueuexIfContext<T>>,
    elseTmpRef: TemplateRef<QueuexIfContext<T>> | null
  ): void {
    if (this.thenTmpRef !== thenTmpRef) {
      this.thenTmpRef = thenTmpRef;
      this.thenViewRef = null;
    }

    if (this.elseTmpRef !== elseTmpRef) {
      this.elseTmpRef = elseTmpRef;
      this.elseViewRef = null;
    }

    if (value) {
      if (!this.thenViewRef) {
        this.vcRef.clear();
        this.elseViewRef = null;
        this.thenViewRef = this.vcRef.createEmbeddedView(
          this.thenTmpRef,
          this.context
        );
      }
    } else {
      if (!this.elseViewRef) {
        this.vcRef.clear();
        this.thenViewRef = null;
        if (this.elseTmpRef) {
          this.elseViewRef = this.vcRef.createEmbeddedView(
            this.elseTmpRef,
            this.context
          );
        }
      }
    }
  }

  dispose(): void { /* noop */ }
}

/**
 * @Directive QueuexIf
 *
 * The `QueuexIf` directive is a structural directive that serves as a drop-in replacement for Angular’s native `NgIf`, but comes with additional advanced capabilities.
 * Much like NgIf, it is designed for conditional rendering of templates based on the value bound to its input.
 *
 * When the input evaluates to a truthy value, the directive creates an embedded view from the attached ng-template (the default `“then”` template) or, more commonly,
 * from a custom template provided via the `[qxIfThen]` input. Conversely, when the input is falsy, the directive removes the active view and, if defined,
 * instantiates the template specified in `[qxIfElse]`.
 *
 * Where `QueuexIf` truly stands out is in how it manages these views. Every embedded view is instantiated lazily through the concurrent scheduler provided by `"ng-queuex/core"`,
 * ensuring efficient rendering under heavy workloads. Each view is also assigned its own isolated reactive context, enabling local change detection that runs independently from Angular’s
 * global change detection cycles — and even separately from the host component’s change detection. Because views are detached from the parent logical tree, any signal read
 * directly within the template can autonomously trigger change detection for that specific view.
 *
 * This architecture makes QueuexIf a powerful alternative to NgIf, combining familiar conditional rendering semantics with modern, high-performance rendering and granular reactivity.
 *
 * ### Server side fallback
 *
 * On the server side, QueuexIf gracefully falls back to the behavior of Angular’s native NgIf. All the advanced client-side features — such as lazy
 * instantiation via the concurrent scheduler, isolated reactive contexts, and signal-driven change detection — are intentionally disabled during server-side rendering.
 * These capabilities are unnecessary in an SSR environment and would only introduce additional overhead. By reverting to a simplified NgIf-like mode, QueuexIf ensures
 * that server-rendered output remains clean, predictable, and optimized for maximum performance.
 *
 * ### Inputs
 *
 * ```ts
 *  *@Input({ required: true })
 *  set qxIf(condition: T | Signal<T>)
 *
 * // Gets called in browser when at least one view gets created or destroyed.
 * *@Input()
 *  qxIfRenderCallback: ((arg: T) => void) | null;
 *
 * // Priority level for concurrent scheduler, used for creating.
 * *@Input({ transform: advancePriorityInputTransform })
 *  set qxIfPriority(priorityLevel: PriorityLevel | Signal<PriorityLevel>);
 *
 * //Template what will be used to render if [qxIf] input will be truthy.
 * *@Input()
 *  set qxIfThen(thenTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined);
 *
 * //Template what will be used to render if [qxIf] input will be falsy.
 * *@Input()
 *  set qxIfElse(elseTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined);
 *
 * ```
 * ### Template context variables
 *
 * ```ts
 *  class QueuexIfContext<T>  {
 *    $implicit: Signal<T>;
 *    qxIf: Signal<T>;
 *  }
 * ```
 */
@Directive({ selector: 'ng-template[qxIf]' })
export class QueuexIf<T = unknown> implements OnInit, OnDestroy {
  private _view: QxIfView
  private _defaultThenTemplate: TemplateRef<QueuexIfContext<T>> = inject(TemplateRef);
  private _conditionSource = sharedSignal<T>(undefined!, NG_DEV_MODE ? 'conditionSource' : undefined);
  private _thenTmpRefSource = sharedSignal(this._defaultThenTemplate, NG_DEV_MODE ? 'thenTemplateRefSource' : undefined);
  private _elseTmpRefSource = sharedSignal<TemplateRef<QueuexIfContext<T>> | null>(null, NG_DEV_MODE ? 'elseTemplateRefSource' : undefined);
  private _priorityRef = value<PriorityLevel>(inject(QX_IF_DEFAULT_PRIORITY), NG_DEV_MODE ? 'priorityRef' : undefined);

  /**
   * A callback what will be called when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
   * The `qxIfRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
   *
   * The `qxIfRenderCallback` emits the latest value causing the view to update.
   */
  @Input() qxIfRenderCallback: ((arg: T) => void ) | null = null;

  /**
   * The value to evaluate as the condition for showing a template.
   */
  @Input({ required: true }) set qxIf(condition: T | Signal<T>) {
    this._conditionSource.set(condition);
  }

  /**
   * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
   * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
   *
   * This input also accepts the signal of the previously mentioned values
   */
  @Input({ transform: advancePriorityInputTransform }) set qxIfPriority(priorityLevel: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(priorityLevel)
  }

  /**
   * A template to show if the condition evaluates to be truthy.
   */
  @Input() set qxIfThen(thenTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined) {
    thenTmpRef != null ? this._thenTmpRefSource.set(thenTmpRef) : this._thenTmpRefSource.set(this._defaultThenTemplate);
  }

  /**
   * A template to show if the condition evaluates to be falsy.
   */
  @Input() set qxIfElse(elseTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined) {
    this._elseTmpRefSource.set(elseTmpRef);
  }

  constructor() {
    assertNgQueuexIntegrated('[qxIf]: Assertion failed! "@ng-queuex/core" integration not provided.');
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this._view = new ClientQxIfView(this, this._thenTmpRefSource.ref, this._elseTmpRefSource.ref, this._priorityRef)
    } else {
      this._view = new ServerQxIfView(this._thenTmpRefSource.ref, this._elseTmpRefSource.ref);
    }
  }

  /**
   * @internal
   */
  ngOnInit(): void {
    this._view.init(new QueuexIfContext<T>(this._conditionSource.ref));
  }

  /**
   * @internal
   */
  ngOnDestroy(): void {
    this._view.dispose();
  }

  /**
   * Assert the correct type of the expression bound to the `qxIf` input within the template.
   *
   * The presence of this static field is a signal to the Ivy template type check compiler that
   * when the `QueuexIf` structural directive renders its template, the type of the expression bound
   * to `qxIf` should be narrowed in some way. For `QueuexIf`, the binding expression itself is used to
   * narrow its type, which allows the strictNullChecks feature of TypeScript to work with `QueuexIf`.
   */
  static ngTemplateGuard_qxIf: 'binding';
  static ngTemplateContextGuard<T>(dir: QueuexIf<T>, ctx: any): ctx is QueuexIfContext<Exclude<T, false | 0 | '' | null | undefined>> {
    return true;
  }

}

export class QueuexIfContext<T = unknown> {

  public $implicit: Signal<T>
  public qxIf: Signal<T>

  constructor(valueSource: Signal<T>) {
    this.$implicit = this.qxIf = valueSource;
  }
}

function assertTemplateRef<T>(templateRef: TemplateRef<T>, propertyName: string): TemplateRef<T>;
function assertTemplateRef<T>(templateRef: TemplateRef<T> | null, propertyName: string): TemplateRef<T> | null;
function assertTemplateRef<T>(templateRef: TemplateRef<T> | null, propertyName: string): TemplateRef<T> | null {
  if (templateRef && typeof templateRef.createEmbeddedView !== 'function') {
    let typeName: string;
    if (typeof templateRef === 'object' || typeof templateRef === 'function') {
      typeName = (templateRef as any).constructor.name;
    } else {
      typeName = typeof templateRef;
    }
    throw new Error(`${propertyName} must be TemplateRef, but received ${typeName}`)
  }
  return templateRef
}
