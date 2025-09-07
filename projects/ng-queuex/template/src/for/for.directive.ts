import { isPlatformServer } from "@angular/common"
import {
  assertNotInReactiveContext,
  computed,
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  InjectionToken,
  Input,
  NgIterable,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Signal,
  TemplateRef,
  TrackByFunction,
  ValueEqualityFn,
  ValueProvider,
  ViewContainerRef,
  ViewRef,
} from "@angular/core"
import {
  consumerAfterComputation,
  consumerBeforeComputation,
  consumerDestroy,
  consumerMarkDirty,
  consumerPollProducersForChange,
  createSignal,
  createWatch,
  isInNotificationPhase,
  REACTIVE_NODE, ReactiveNode,
  setActiveConsumer,
  Watch
} from "@angular/core/primitives/signals"
import {
  AbortTaskFunction,
  AddedIterableChangeRecord,
  detectChangesSync,
  PriorityLevel,
  PriorityName,
  priorityNameToNumber,
  QueuexIterableChangeOperationHandler,
  QueuexIterableDiffer,
  QueuexIterableDiffers,
  RemovedIterableChangeRecord,
  StillPresentIterableChangeRecord,
  scheduleChangeDetection,
  scheduleTask,
  isInConcurrentTaskContext,
  onTaskExecuted,
  priorityInputTransform,
  assertNgQueuexIntegrated,
  sharedSignal,
  value,
  advancePriorityInputTransform,
  ValueRef
} from "@ng-queuex/core"
import { assertSignal } from "../utils/utils"

declare const ngDevMode: boolean | undefined

type Num =
  0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  20 | 21 | 22 | 23 | 24 | 25 | 16 | 27 | 28 | 29
  30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39
  40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49
  50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59
  60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69
  70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79
  80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89
  90 | 92 | 93 | 94 | 95 | 96 | 97 | 97 | 98 | 99;


type Flatten<T> = T extends infer U ? U : never;

type KeysToUse<T> = T extends Function
  ? Exclude<keyof T, 'prototype' | 'arguments'>
  : Exclude<keyof T, 'prototype'>;

type PrefixedKeys<
  T,
  Prefix extends string = "item",
  Seen = never
> =
  T extends (infer U)[]
    ? | `${Prefix}.${Num}`
      | PrefixedKeys<U, `${Prefix}.${Num}`, Seen>
    : Flatten<{
        [K in KeysToUse<T>]:
          T[K] extends (infer U)[]
            ? | `${Prefix}.${Extract<K, string>}`
              | `${Prefix}.${Extract<K, string>}.${Num}`
              | PrefixedKeys<U, `${Prefix}.${Extract<K, string>}.${Num}`, Seen>
            : T[K] extends Record<string, any>
              ? T[K] extends Seen
                ? `${Prefix}.${Extract<K, string>}`
                : | `${Prefix}.${Extract<K, string>}`
                  | PrefixedKeys<T[K], `${Prefix}.${Extract<K, string>}`, Seen | T[K]>
              : `${Prefix}.${Extract<K, string>}`
      }[KeysToUse<T>]>;

// type TrackBy = 'item' | 'index';
type TrackBy<T> = T extends object ? 'index' | 'item' | PrefixedKeys<T> : 'index' | 'item'

type QueuexForOfInput<T, U extends NgIterable<T> = NgIterable<T>> = U & NgIterable<T> | null | undefined;

const QX_FOR_OF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_FOR_OF_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });

interface NgIterableItemNode<T, U extends NgIterable<T> = NgIterable<T>> extends ReactiveNode {
  hasRun: boolean
  scheduled: boolean;
  destroyed: boolean;
  forOfView: ClientQueuexForOfView<T, U>;
  context: ClientQueuexForOfContext<T, U>;
  viewRef: ViewRef | null;
  vcRef: ViewContainerRef;
  tmpRef: TemplateRef<any>
  run(): void;
  schedule(): void;
  destroy(): void;
}

interface QueuexForOfView<T> extends QueuexIterableChangeOperationHandler<T> {
  init(trackByFn: TrackByFunction<T>, itemEqualFn: ValueEqualityFn<T> | null): void;
  dispose(): void;
}

type OmitFromNode = 'forOfView' |'destroyed' | 'scheduled' | 'hasRun' | 'context' | 'directive' | 'viewRef' | 'vcRef' | 'tmpRef'

const BASE_NG_ITERABLE_ITEM_NODE: Omit<NgIterableItemNode<any>, OmitFromNode> =
  /* @__PURE__ */(() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    consumerMarkedDirty() {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!')
      }
      this.schedule();
    },
    schedule(this: NgIterableItemNode<any>) {
      if (this.scheduled) { return; }
      this.scheduled = true;

      if (!this.forOfView.iterating) {
        // For sure this is a notification from signal consumed in embedded view.
        this.context._needsCheck = true;
      }

      const abortTask = scheduleChangeDetection(() => {
        if (this.viewRef) {
          if (this.context._currentIndex === -1) {
            this.vcRef.remove(this.context._adjPrevIndex);
            this.viewRef.detectChanges();
            this.forOfView.shouldRunRenderCallback = true;
            this.destroy();
            return;
          } else if (this.context._adjPrevIndex !== -1) {
            this.vcRef.move(this.viewRef, this.context._currentIndex);
            this.forOfView.shouldRunRenderCallback = true;
          } else if (this.context._needsCheck) {
            this.context._needsCheck = false;
            consumerMarkDirty(this);
          }
        } else {
          this.viewRef = this.vcRef.createEmbeddedView(this.tmpRef, this.context, this.context._currentIndex);
          this.viewRef.detach();
          this.forOfView.shouldRunRenderCallback = true;
          consumerMarkDirty(this);
        }

        if (this.dirty) {
          this.run();
        }

        this.forOfView.removeAborter(abortTask!);

        this.scheduled = false;
      }, this.forOfView.priorityRef.value, this.viewRef);

      if (abortTask) {
        abortTask(() => {
          this.forOfView.removeAborter(abortTask)
          this.scheduled = false;
        });
        this.forOfView.addAborter(abortTask)
      }
    },
    run(this: NgIterableItemNode<any>) {
      if ((typeof ngDevMode === 'undefined' || ngDevMode) && isInNotificationPhase()) {
        throw new Error(`Schedulers cannot synchronously execute watches while scheduling.`);
      }

      this.dirty = false;
      if (this.hasRun && !consumerPollProducersForChange(this)) {
      return;
      }
      this.hasRun = true;

      if (this.viewRef) {
        const prevConsumer = consumerBeforeComputation(this);
        try {
          detectChangesSync(this.viewRef);
        } finally {
          consumerAfterComputation(this, prevConsumer);
        }
      }
    },
    destroy(this: NgIterableItemNode<any>) {
      if (this.destroyed) { return; }
      this.destroyed = true;
      consumerDestroy(this);
    }
  }))()

function createItemNode<T, U extends NgIterable<T> = NgIterable<T>>(
  context: ClientQueuexForOfContext<T, U>,
  forOfView: ClientQueuexForOfView<T, U>
): NgIterableItemNode<T, U> {
  const node = Object.create(BASE_NG_ITERABLE_ITEM_NODE) as NgIterableItemNode<T, U>;
  node.context = context;
  node.forOfView = forOfView;
  node.vcRef = forOfView.vcRef;
  node.tmpRef = forOfView.tmpRef;
  node.viewRef = null;
  node.destroyed = false;
  node.scheduled = false;
  node.hasRun = false;
  node.dirty = false;

  return node;
}

function assertValidPropertyPath(obj: any, propPath: string): void {
  if (obj == null) {
    throw new Error(`[qxFor][trackBy]: Tracking by property path '${propPath}' is imposable for null or undefined!`)
  }

  let start = 0;
  let current: any = obj;

  while (start < propPath.length) {
    const dotIndex = propPath.indexOf(".", start);
    const key =
      dotIndex === -1 ? propPath.substring(start) : propPath.substring(start, dotIndex);

    if (current == null) {
      throw new Error(
        `[qxFor][trackBy]: Invalid property path '${propPath}'! Property '${propPath.substring(0, start - 1)}' is null or undefined.`
      );
    }

    current = current[key];
    start = dotIndex === -1 ? propPath.length : dotIndex + 1;

    if (dotIndex !== -1 && current == null) {
      throw new Error(
        `[qxFor][trackBy]: Invalid property path '${propPath}'! Property '${propPath.substring(0, start - 1)}' is null or undefined.`
      );
    }
  }

  if (current == null) {
    console.warn(`[qxFor][trackBy]: Provided property path '${propPath}' for tracking changes is null or undefined!`)
  }
}

export function provideQueuexForOfDefaultPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_FOR_OF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, 'provideQueuexForOfDefaultPriority()') }
}

export function trackByIndex<T, U extends T>(index: number, item: U): any {
  return index;
}

export function trackByItem<T, U extends T>(index: number, item: U): any {
  return item;
}

class ClientQueuexForOfView<T, U extends NgIterable<T> = NgIterable<T>> implements QueuexForOfView<T> {

  vcRef = inject(ViewContainerRef);
  tmpRef = inject(TemplateRef);
  differs = inject(QueuexIterableDiffers);
  differ: QueuexIterableDiffer<T> | null = null
  iterating = false;
  rendering = false;
  shouldRunRenderCallback = false;
  aborting = false;
  updateScheduled = false;
  disposed = false;
  count = 0;
  aborters: AbortTaskFunction[] = [];
  inputWatcher: Watch = null!;
  trackByFn: TrackByFunction<T> = null!;
  itemEqualFn: ValueEqualityFn<T> | null = null;

  constructor(
    public forOfDir: QueuexForOf<T, U>,
    public dataSource: Signal<QueuexForOfInput<T, U>>,
    public priorityRef: ValueRef<PriorityLevel>
  ) { }

  init(trackByFn: TrackByFunction<T>, itemEqualFn: ValueEqualityFn<T> | null): void {
    this.trackByFn = trackByFn;
    this.itemEqualFn = itemEqualFn;

    this.inputWatcher = createWatch(
      () => this.update(),
      () => this.scheduleUpdate(),
      true
    );
    this.inputWatcher.notify();
  }

  add(record: AddedIterableChangeRecord<T>): void {
    const { currentIndex, item } = record;
    new ClientQueuexForOfContext(
      currentIndex,
      this.count,
      item,
      this.itemEqualFn,
      this.dataSource,
      this
    );
  }
  remove(record: RemovedIterableChangeRecord<T>, adjustedIndex: number): void {
    const context = (this.vcRef.get(record.previousIndex) as EmbeddedViewRef<ClientQueuexForOfContext<T, U>>).context;
    context._currentIndex = -1;
    context._adjPrevIndex = adjustedIndex;
    context._setItem(record.item)
    context._node.schedule();
  }
  move(record: StillPresentIterableChangeRecord<T>, adjustedPreviousIndex: number, changed: boolean): void {
    const { currentIndex, item } = record;
    const context = (this.vcRef.get(record.previousIndex) as EmbeddedViewRef<ClientQueuexForOfContext<T, U>>).context;
    context._currentIndex = currentIndex;
    context._adjPrevIndex = adjustedPreviousIndex;
    context._setIndex(currentIndex);
    context._setCount(this.count);
    context._setItem(item);
    if (changed) {
      consumerMarkDirty(context._node);
    } else {
      context._node.schedule()
    }
  }
  noop(record: StillPresentIterableChangeRecord<T>, changed: boolean): void {
    const { currentIndex, item } = record;
    const context = (this.vcRef.get(record.previousIndex) as EmbeddedViewRef<ClientQueuexForOfContext<T, U>>).context;
    context._currentIndex = currentIndex;
    context._adjPrevIndex = -1
    context._setIndex(currentIndex);
    context._setCount(this.count);
    context._setItem(item);
    if (changed) {
      consumerMarkDirty(context._node);
    } else {
      context._node.schedule()
    }
  }
  done(): void {
    const abortTask = scheduleTask(() => {
      this.rendering = false;
      if (this.shouldRunRenderCallback) {
        this.shouldRunRenderCallback = false;
        this.forOfDir.qxForRenderCallback?.(this.dataSource());
      }
    }, this.priorityRef.value);

    this.addAborter(abortTask);
  }

  update(): void {
    const data = this.dataSource();
    const prevConsumer = setActiveConsumer(null)
    try {
      if (!this.differ && data) {
        this.differ = this.differs.find(data).create(this.trackByFn);
      }

      if (this.differ) {
        if (this.rendering) {
          const currentState = [];
          for (let i = 0; i < this.vcRef.length; i++) {
            const context = (this.vcRef.get(i) as EmbeddedViewRef<ClientQueuexForOfContext<T, U>>).context;
            context._currentIndex = i;
            context._adjPrevIndex = -1;
            context._setIndex(i);
            currentState[i] = context.$implicit();
          }
          this.differ.diff(currentState);
        }
        this.abort();

        const changes = this.differ.diff(data);
        if (changes) {
          this.rendering = true;
          this.iterating = true;
          this.count = changes.length
          changes.applyOperations(this);
          this.iterating = false;
        } else if (this.rendering) {
          this.done();
        }
      }
    } finally {
      setActiveConsumer(prevConsumer);
    }
  }

  scheduleUpdate(): void {
    if (this.updateScheduled) { return; }
    this.updateScheduled = true;

    if (isInConcurrentTaskContext()) {
      onTaskExecuted(() => {
        if (this.disposed) { return; }
        this.inputWatcher.run();
        this.updateScheduled = false;
      });
    } else {
      scheduleTask(() => {
        this.inputWatcher.run() ;
        this.updateScheduled = false;
    }, 1/* Highest */);
    }
  }

  abort(): void {
    this.aborting = true;
    while(this.aborters.length) {
      this.aborters.shift()!();
    }
    this.aborting = false;
  }

  addAborter(abortTask: AbortTaskFunction): void {
    this.aborters.push(abortTask);
  }

  removeAborter(abortTask: AbortTaskFunction): void {
    if (this.aborting) { return; }
    const index = this.aborters.indexOf(abortTask);
    if (index > -1) {
      this.aborters.splice(index, 1);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abort();
    for (let i = 0; i < this.vcRef.length; i++) {
      (this.vcRef.get(i) as EmbeddedViewRef<ClientQueuexForOfContext<T, U>>).context._node.destroy();
    }
  }
}

class ServerQueuexForOfView<T, U extends NgIterable<T> = NgIterable<T>> implements QueuexForOfView<T> {

  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _differs = inject(QueuexIterableDiffers);
  private _differ: QueuexIterableDiffer<T> | null = null;;
  private _count: number = 0;
  private _itemEqualFn: ValueEqualityFn<T> | null = null
  private _trackByFn: TrackByFunction<T> = null!

  constructor(
    private _dataSource: Signal<QueuexForOfInput<T, U>>
  ) {
    effect(() => {
      this._update(this._dataSource());
    });
  }

  add(record: AddedIterableChangeRecord<T>): void {
    const { currentIndex, item } = record
    const context = new ServerQueuexForOfContext(
      currentIndex,
      this._count,
      item,
      this._itemEqualFn,
      this._dataSource
    )
    this._vcRef.createEmbeddedView(this._tmpRef, context, currentIndex);
  }

  remove(_: RemovedIterableChangeRecord<T>, adjustedIndex: number): void {
    this._vcRef.remove(adjustedIndex);
  }

  move(record: StillPresentIterableChangeRecord<T>, adjustedPreviousIndex: number): void {
    const { item, currentIndex } = record
    const viewRef = this._vcRef.get(adjustedPreviousIndex) as EmbeddedViewRef<ServerQueuexForOfContext<T, U>>;
    this._vcRef.move(viewRef, currentIndex);
    this._updateContext(viewRef.context, currentIndex, item)
  }

  noop(record: StillPresentIterableChangeRecord<T>): void {
    const { item, currentIndex } = record;
    const viewRef = this._vcRef.get(currentIndex) as EmbeddedViewRef<ServerQueuexForOfContext<T, U>>;
    this._updateContext(viewRef.context, currentIndex, item);
  }

  done(): void { /* noop */ }

  init(trackByFn: TrackByFunction<T>, itemEqualFn: ValueEqualityFn<T> | null): void {
    this._trackByFn = trackByFn;
    this._itemEqualFn = itemEqualFn;
  }

  dispose(): void { /* noop */ }

  _update(data: QueuexForOfInput<T, U>): void {
    if (!this._differ && data) {
      this._differ = this._differs.find(data).create(this._trackByFn);
    }

    if (this._differ) {
      const changes = this._differ.diff(data);
      if (changes) {
        this._count = changes.length;
        changes.applyOperations(this);
      }
    }
  }

  _updateContext(context: ServerQueuexForOfContext<T, U>, index: number, item: T): void {
    context._setIndex(index);
    context._setItem(item);
    context._setCount(this._count);
  }
}

@Directive({ selector: 'ng-template[qxFor]' })
export class QueuexForOf<T, U extends NgIterable<T> = NgIterable<T>> implements OnInit, OnDestroy {

  private _trackBy: TrackByFunction<T> = null!;
  private _itemPropPath: string = undefined!;
  private _itemEqualFn: ValueEqualityFn<T> | null = null;
  private _view: QueuexForOfView<T> = null!;
  private _dataSource = sharedSignal<QueuexForOfInput<T, U>>(undefined, (typeof ngDevMode === 'undefined' || ngDevMode) ? 'qxForOf' : undefined);
  private _priorityRef = value<PriorityLevel>(inject(QX_FOR_OF_DEFAULT_PRIORITY), (typeof ngDevMode === 'undefined' || ngDevMode) ? 'qxForOfPriority' : undefined);

  @Input({ transform: advancePriorityInputTransform }) set qxForPriority(priority: PriorityLevel | Signal<PriorityLevel>) {
    this._priorityRef.set(priority);
  }
  @Input({ required: true }) set qxForOf(data: QueuexForOfInput<T, U> | Signal<QueuexForOfInput<T, U>>) {
    this._dataSource.set(data);
  }
  @Input({ required: true }) set qxForTrackBy(trackBy: TrackBy<T>) {
    if (this._trackBy as any) {
      throw new Error('[qxFor] "trackBy" can not be provided more then once!');
    }
    if (trackBy === 'index') {
      this._trackBy = trackByIndex;
      return;
    }
    if (trackBy === 'item') {
      this._trackBy = trackByItem;
      return;
    }
    if (trackBy.startsWith('item.')) {
      if (trackBy.includes('..')) {
        throw new Error(`[qxFor][trackBy]: Provided value '${trackBy}' is incorrect format of property patch because of '..'!`);
      }

      this._itemPropPath = trackBy.substring(5);
      this._trackBy = (function (this: QueuexForOf<T,U>, index: number, item: T) {
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          assertValidPropertyPath(item, this._itemPropPath);
        }
        return (item as any)[this._itemPropPath];
      }).bind(this);
      return;
    }

    throw new Error(
      '[qxFor][trackBy]: Incorrect value provided to "trackBy" function! It only accepts \'index\', \'item\' ' +
      'or any value of type string prefixed with \'item.\' where it should be a path to property. For example ' +
      'if item is an instance of class Person { id: string, name: string } you should provide \'item.id\'.'
    );
  }
  @Input() set qxForEqual(equal: ValueEqualityFn<T> | null) {
    if (this._itemEqualFn as any) {
      throw new Error('[qxFor]: "equal" can not be provided more then once!');
    }
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && typeof equal !== 'function') {
      throw new Error('[qxFor][equal]: Provided input is not a function!')
    }
    this._itemEqualFn = equal;
  }
  @Input() qxForRenderCallback: ((data: QueuexForOfInput<T, U>) => void) | null = null;

  constructor() {
    assertNgQueuexIntegrated('[qxFor]: Assertion failed! "@ng-queuex/core" integration not provided!');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._view = new ServerQueuexForOfView(this._dataSource.ref);
    } else {
      this._view = new ClientQueuexForOfView(this, this._dataSource.ref, this._priorityRef)
    }
  }

  ngOnInit(): void {
    this._view.init(this._trackBy, this._itemEqualFn);
  }

  ngOnDestroy(): void {
    this._view.dispose();
  }

  static ngTemplateContextGuard<T, U extends NgIterable<T>>(dir: QueuexForOf<T, U>, ctx: any): ctx is QueuexForOf<T, U> {
    return true;
  }

}

export interface QueuexForOfContext<T, U extends NgIterable<T> = NgIterable<T>> {
  readonly $implicit: Signal<T>;
  readonly qxForOf: Signal<QueuexForOfInput<T, U>>;
  readonly index: Signal<number>;
  readonly count: Signal<number>;
  readonly first: Signal<boolean>;
  readonly last: Signal<boolean>;
  readonly even: Signal<boolean>;
  readonly odd: Signal<boolean>;
}

class ServerQueuexForOfContext<T, U extends NgIterable<T> = NgIterable<T>> implements QueuexForOfContext<T, U> {

  readonly $implicit: Signal<T>
  readonly qxForOf: Signal<QueuexForOfInput<T, U>>
  readonly index: Signal<number>
  readonly count: Signal<number>
  readonly first: Signal<boolean>
  readonly last: Signal<boolean>
  readonly even: Signal<boolean>
  readonly odd: Signal<boolean>

  readonly _setIndex: (index: number) => void;
  readonly _setCount: (count: number) => void;
  readonly _setItem: (item: T) => void;

  constructor(
    index: number,
    count: number,
    item: T,
    equal: ValueEqualityFn<T> | null,
    qxForOf: Signal<QueuexForOfInput<T, U>>
  ) {
    const [indexGetFn, indexSetFn] = createSignal(index) as unknown as [any, any];
    this.index = indexGetFn;
    this._setIndex = indexSetFn;

    const [countGetFn, countSetFn] = createSignal(count) as unknown as [any, any];
    this.count = countGetFn;
    this._setCount = countSetFn;

    const [itemGetFn, itemSetFn] = createSignal(item, equal ?? undefined) as unknown as [any, any];
    this.$implicit = itemGetFn;
    this._setItem = itemSetFn;

    this.qxForOf = qxForOf;

    this.first = computed(() => this.index() === 0);
    this.last = computed(() => this.index() === this.count() - 1);
    this.even = computed(() => this.index() % 2 === 0);
    this.odd = computed(() => this.index() % 2 !== 0);

    if (typeof ngDevMode === 'undefined' || ngDevMode) {

      indexGetFn.toString = () => `[Signal: ${indexGetFn()}]`;
      indexGetFn.debugName = 'QueuexFotOfContextIndexSignal';

      countGetFn.toString = () => `[Signal: ${countGetFn()}]`;
      countGetFn.debugName = 'QueuexFotOfContextCountSignal';

      itemGetFn.toString = () => `[Signal: ${itemGetFn()}]`;
      itemGetFn.debugName = 'QueuexFotOfContextItemSignal'
    }
  }
}

class ClientQueuexForOfContext<T, U extends NgIterable<T> = NgIterable<T>> extends ServerQueuexForOfContext<T, U> {

  _currentIndex: number;
  _adjPrevIndex = -1;
  _needsCheck = false;
  _node: NgIterableItemNode<T, U>;

  constructor(
    index: number,
    count: number,
    item: T,
    equal: ValueEqualityFn<T> | null,
    qxForOf: Signal<QueuexForOfInput<T, U>>,
    forOfView: ClientQueuexForOfView<T, U>
  ) {
    super(index, count, item, equal, qxForOf);
    this._currentIndex = index;
    this._node = createItemNode(this, forOfView);
    consumerMarkDirty(this._node);
  }
}


