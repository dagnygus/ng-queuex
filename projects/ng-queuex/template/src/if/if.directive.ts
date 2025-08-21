import { isPlatformBrowser } from "@angular/common";
import {
  assertNotInReactiveContext,
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  InjectionToken,
  Input,
  input,
  InputSignal,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  SimpleChanges,
  TemplateRef,
  ValueProvider,
  ViewContainerRef,
} from "@angular/core";
import { consumerAfterComputation, consumerBeforeComputation, consumerDestroy, consumerMarkDirty, consumerPollProducersForChange, createWatch, isInNotificationPhase, REACTIVE_NODE, ReactiveNode, setActiveConsumer, Watch } from "@angular/core/primitives/signals";
import {
  PriorityLevel,
  assertNgQueuexIntegrated,
  PriorityName,
  priorityNameToNumber,
  priorityInputTransform,
  scheduleChangeDetection,
  AbortTaskFunction
} from "@ng-queuex/core";
import { detectChangesSync, isInConcurrentTaskContext, onTaskExecuted, scheduleTask } from "../../../core";

declare const ngDevMode: boolean | undefined;

interface QxIfView {
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
        this.scheduled = false;

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

      }, this.view.ifDir.qxIfPriority(), this.view.thenViewRef);
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
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
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
        this.scheduled = false;

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
            consumerMarkDirty(this);
          }
        }

        if (this.dirty) {
          this.run();
        }

      }, this.view.ifDir.qxIfPriority(), this.view.elseViewRef);
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
  return { provide: QX_IF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority) }
}

class ClientQxIfView<T = unknown> implements QxIfView {

  ifDir: QueuexIf<T>
  context: QueuexIfContext<T>;
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
  abortTask: AbortTaskFunction = null!

  constructor(directive: QueuexIf<T>) {
    this.ifDir = directive;
    this.thenTmpRef = directive.qxIfThen();
    this.context = new QueuexIfContext(directive.qxIf);

    this.inputWatch = createWatch(
      () => {
        this.ifDir.qxIf();
        const thenTmpRef = this.ifDir.qxIfThen();
        if (this.thenTmpRef !== thenTmpRef) {
          this.thenTmpHasChange = true;
          this.thenTmpRef = thenTmpRef;
        }
        const elseTmpRef = this.ifDir.qxIfElse();
        if (this.elseTmpRef !== elseTmpRef) {
          this.elseTmpHasChange = true;
        }

        const prevConsumer = setActiveConsumer(null);
        try {
          this.thenNode.schedule()
          this.elseNode.schedule();
        } finally {
          setActiveConsumer(prevConsumer);
        }
      },
      () => {
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
      },
      false
    );

    this.thenNode = createThenNode(this);
    this.elseNode = createElseNode(this);

    this.inputWatch.notify();
  }

  dispose(): void {
    this.disposed = true;
    this.abortTask();
    this.inputWatch.destroy();
    this.thenNode.destroy();
    this.elseNode.destroy();
  }
}

class ServerQxIfView<T = unknown> implements QxIfView {

  context: QueuexIfContext<T>;
  thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
  thenTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
  vcRef = inject(ViewContainerRef)

  constructor(directive: QueuexIf<T>) {
    this.context = new QueuexIfContext(directive.qxIf);
    effect(() => {
      this.update(
        directive.qxIf(),
        directive.qxIfThen(),
        directive.qxIfElse()
      )
    })
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
export class QueuexIf<T = unknown> implements OnChanges, OnDestroy {
  private _view: QxIfView

  qxIfPriority = input(inject(QX_IF_DEFAULT_PRIORITY), { transform: priorityInputTransform });
  qxIfThen: InputSignal<TemplateRef<QueuexIfContext<T>>> = input(inject(TemplateRef));
  qxIfElse = input<TemplateRef<QueuexIfContext<T>> | null>(null);

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
    if (changes['qxIf']) {
      throw new Error('[qxIf] Main input can not be change!');
    }
  }

  ngOnDestroy(): void {
    this._view.dispose();
  }
}

export class QueuexIfContext<T = unknown> {

  public $implicit: Signal<T>
  public qxIf: Signal<T>

  constructor(valueSignal: Signal<T>) {
    this.$implicit = this.qxIf = valueSignal
  }
}
