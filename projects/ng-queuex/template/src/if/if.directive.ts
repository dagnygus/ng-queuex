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
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Signal,
  SimpleChanges,
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
  SIGNAL,
  SignalNode,
  Watch
} from "@angular/core/primitives/signals";
import {
  PriorityLevel,
  assertNgQueuexIntegrated,
  PriorityName,
  priorityNameToNumber,
  priorityInputTransform,
  scheduleChangeDetection,
  AbortTaskFunction,
  detectChangesSync,
  isInConcurrentTaskContext,
  onTaskExecuted,
  scheduleTask
} from "@ng-queuex/core";
import { assertSignal } from "../utils/utils";

declare const ngDevMode: boolean | undefined;

interface QxIfView<T = unknown> {
  context: QueuexIfContext<T>
  dispose(): void
}

interface QueuexIfEffectNode<T = unknown> extends ReactiveNode {
  hasRun: boolean;
  view: ClientQxIfView;
  scheduled: boolean;
  destroyed: boolean;
  run(): void;
  schedule(): void;
  destroy(): void;
  abortTask: AbortTaskFunction | null
}

const BASE_THEN_QUEUEX_EFFECT_NODE: Omit<QueuexIfEffectNode, 'view' | 'destroyed' |  'scheduled' | 'hasRun' | 'abortTask'> =
  /* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    abortTask: null,
    consumerMarkedDirty(this: QueuexIfEffectNode) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
      }
      this.schedule();
    },
    schedule(this: QueuexIfEffectNode) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
      }

      if (this.destroyed || this.scheduled) { return; }
      this.scheduled = true;

      this.abortTask = scheduleChangeDetection(() => {
        if (this.destroyed) { return; }


        let thenViewRef = this.view.thenViewRef;
        const vcRef = this.view.vcRef;

        if (this.view.thenTmpHasChange) {
          this.view.thenTmpHasChange = false;
          if (thenViewRef) {
            const index = vcRef.indexOf(thenViewRef);
            vcRef.remove(index);
            thenViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will down bellow this file;
            this.view.thenViewRef = null;
            thenViewRef = null;
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
          }
        } else {
          if (thenViewRef) {
            const index = vcRef.indexOf(thenViewRef)
            vcRef.remove(index);
            thenViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will down bellow this file;
            this.view.thenViewRef = null;
          }
        }

        if (this.dirty) {
          this.run();
        }

        this.scheduled = false;
      }, this.view.priorityNode.value, this.view.thenViewRef);
    },
    run(this: QueuexIfEffectNode) {
      if ((typeof ngDevMode === 'undefined' || ngDevMode) && isInNotificationPhase()) {
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

  const BASE_ELSE_QUEUEX_EFFECT_NODE: Omit<QueuexIfEffectNode, 'view' | 'destroyed' |  'scheduled' | 'shouldRerender' | 'hasRun' | 'abortTask'> =
  /* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    consumerMarkedDirty(this: QueuexIfEffectNode) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!')
      }
      this.schedule();
    },
    schedule(this: QueuexIfEffectNode) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!')
      }

      if (this.destroyed || this.scheduled) { return; }
      this.scheduled = true;

      this.abortTask = scheduleChangeDetection(() => {
        if (this.destroyed) { return; }

        let elseViewRef = this.view.elseViewRef;
        const vcRef = this.view.vcRef;

        if (this.view.elseTmpHasChange) {
          this.view.elseTmpHasChange = false;
          if (elseViewRef) {
            const index = vcRef.indexOf(elseViewRef);
            vcRef.remove(index);
            elseViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will down bellow this file;
            this.view.elseViewRef = null;
            elseViewRef = null;
          }
        }

        if (this.view.context.$implicit()) {
          if (elseViewRef) {
            const index = vcRef.indexOf(elseViewRef)
            vcRef.remove(index);
            elseViewRef.detectChanges();//To immediately clear dom. There is some issue with destroyed view. Explanation will down bellow this file;
            this.view.elseViewRef = null;
          }
        } else {
          if (!elseViewRef && this.view.elseTmpRef) {
            this.view.elseViewRef = vcRef.createEmbeddedView(
              this.view.elseTmpRef,
              this.view.context
            );
            this.view.elseViewRef.detach();
            consumerMarkDirty(this);
          }
        }

        if (this.dirty) {
          this.run();
        }

        this.scheduled = false;
      }, this.view.priorityNode.value, this.view.elseViewRef);
    },
    run(this: QueuexIfEffectNode) {
      if ((typeof ngDevMode === 'undefined' || ngDevMode) && isInNotificationPhase()) {
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
    return node;
  }

const QX_IF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_IF_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });

export function provideQxIfDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_IF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, 'provideQxIfDefaultPriority()') }
}

class ClientQxIfView<T = unknown> implements QxIfView<T> {

  ifDir: QueuexIf<T>
  priorityNode: SignalNode<PriorityLevel>;
  context: QueuexIfContext<T> = null!;
  inputWatch: Watch
  thenNode: QueuexIfEffectNode<T>;
  elseNode: QueuexIfEffectNode<T>;
  thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  thenTmpRef: TemplateRef<QueuexIfContext<T>>;
  elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  thenTmpHasChange: boolean = false;
  elseTmpHasChange: boolean = false
  vcRef = inject(ViewContainerRef)
  disposed = false
  abortTask: AbortTaskFunction | null = null
  inputWatchScheduled = false

  constructor(directive: QueuexIf<T>) {
    this.ifDir = directive;
    this.priorityNode = directive.qxIfPriority[SIGNAL];
    this.thenTmpRef = directive.qxIfThen();

    this.inputWatch = createWatch(
      () => this.inputWatchCallback(),
      () => this.scheduleInputWatchCallback(),
      false
    );

    this.thenNode = createThenNode(this);
    this.elseNode = createElseNode(this);

    this.inputWatch.notify();
  }

  inputWatchCallback(): void {
    this.ifDir.qxIf();
    const thenTmpRef = assertTemplateRef(this.ifDir.qxIfThen(), 'qxIfThen');
    if (this.thenTmpRef !== thenTmpRef) {
      this.thenTmpHasChange = true;
      this.thenTmpRef = thenTmpRef;
    }
    const elseTmpRef = assertTemplateRef(this.ifDir.qxIfElse(), 'qxIfElse');
    if (this.elseTmpRef !== elseTmpRef) {
      this.elseTmpHasChange = true;
      this.elseTmpRef = elseTmpRef
    }

    const prevConsumer = setActiveConsumer(null);
    try {
      this.thenNode.schedule()
      this.elseNode.schedule();
    } finally {
      setActiveConsumer(prevConsumer);
    }

    this.inputWatchScheduled = false;
  }

  scheduleInputWatchCallback(): void {
    if (this.inputWatchScheduled) { return; }
    this.inputWatchScheduled = true;

    if (isInConcurrentTaskContext()) {
      onTaskExecuted(() => {
        if (this.disposed) { return; }
        this.inputWatch.run();
      });
    } else {
      this.abortTask = scheduleTask(
        () => this.inputWatch.run(),
        1 //Highest
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abortTask?.();
    this.inputWatch.destroy();
    this.thenNode.destroy();
    this.elseNode.destroy();
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

  constructor(directive: QueuexIf<T>) {
    effect(() => {
      this.update(
        directive.qxIf(),
        assertTemplateRef(directive.qxIfThen(), 'qxIfThen'),
        assertTemplateRef(directive.qxIfElse(), 'qxIfElse')
      );
    })
  }

  private update(
    value: T,
    thenTmpRef: TemplateRef<QueuexIfContext<T>>,
    elseTmpRef: TemplateRef<QueuexIfContext<T>> | null
  ): void {
    let shouldRefresh = false

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
        )
      }
    } else {
      if (!this.elseViewRef) {
        this.vcRef.clear();
        this.thenViewRef = null;
        if (this.elseTmpRef) {
          this.elseViewRef = this.vcRef.createEmbeddedView(
            this.elseTmpRef,
            this.context
          )
        }
      }
    }
  }

  dispose(): void { /* noop */ }
}

@Directive({ selector: '[qxIf]' })
export class QueuexIf<T = unknown> implements OnChanges, OnInit, OnDestroy {
  private _view: QxIfView
  private _init = false;
  private _defaultThenTemplate: TemplateRef<QueuexIfContext<T>> = inject(TemplateRef);

  qxIfPriority = input(inject(QX_IF_DEFAULT_PRIORITY), { transform: priorityInputTransform });
  qxIfElse = input<TemplateRef<QueuexIfContext<T>> | null>(null);
  qxIfThen = input<TemplateRef<QueuexIfContext<T>>, TemplateRef<QueuexIfContext<T>> | null>(
    this._defaultThenTemplate, { transform: (value) => value ?? this._defaultThenTemplate }
);

  @Input({ required: true }) qxIf: Signal<T> = null!

  constructor() {
    assertNgQueuexIntegrated();
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this._view = new ClientQxIfView(this)
    } else {
      this._view = new ServerQxIfView(this);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['qxIf'] && this._init) {
      throw new Error('[qxIf] Main input can not be change!');
    }
  }

  ngOnInit(): void {
    this._init = true;
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      assertSignal(this.qxIf, 'qxIf');
    }
    this._view.context = new QueuexIfContext<T>(this.qxIf);
  }

  ngOnDestroy(): void {
    this._view.dispose();
  }

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
  if (templateRef && !templateRef.createEmbeddedView) {
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
