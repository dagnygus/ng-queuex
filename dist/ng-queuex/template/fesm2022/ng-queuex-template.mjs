import { isPlatformServer, isPlatformBrowser } from '@angular/common';
import * as i0 from '@angular/core';
import { InjectionToken, assertNotInReactiveContext, inject, ViewContainerRef, TemplateRef, effect, PLATFORM_ID, Input, Directive, computed, ChangeDetectorRef, ɵmarkForRefresh as _markForRefresh, signal, Injector, output } from '@angular/core';
import { REACTIVE_NODE, consumerDestroy, isInNotificationPhase, consumerPollProducersForChange, consumerBeforeComputation, consumerAfterComputation, consumerMarkDirty, createWatch, setActiveConsumer, createSignal } from '@angular/core/primitives/signals';
import { detectChangesSync, scheduleChangeDetection, priorityNameToNumber, QueuexIterableDiffers, scheduleTask, isInConcurrentTaskContext, onTaskExecuted, sharedSignal, value, assertNgQueuexIntegrated, advancePriorityInputTransform, priorityInputTransform } from '@ng-queuex/core';

// export function assertSignal(arg: any, propertyName: string): void {
//   if (typeof arg === 'function' && arg[SIGNAL]) { return; }
//   let typeName: string
//   if ((typeof arg === 'object' || typeof arg === 'function') && arg !== null) {
//     typeName = arg.constructor.name;
//   } else {
//     typeName = typeof arg;
//   }
//   throw new Error(`'${propertyName}' must be a signal, but received '${typeName}'`);
// }
const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode;

10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;
20 | 21 | 22 | 23 | 24 | 25 | 16 | 27 | 28 | 29;
30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39;
40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49;
50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59;
60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69;
70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79;
80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89;
90 | 92 | 93 | 94 | 95 | 96 | 97 | 97 | 98 | 99;
const QX_FOR_OF_DEFAULT_PRIORITY = new InjectionToken('QX_FOR_OF_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });
const BASE_NG_ITERABLE_ITEM_NODE = 
/* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    consumerMarkedDirty() {
        if (NG_DEV_MODE) {
            assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!');
        }
        this.schedule();
    },
    schedule() {
        if (this.scheduled) {
            return;
        }
        this.scheduled = true;
        if (!this.forOfView.iterating) {
            // For sure this is a notification from signal consumed in embedded view.
            this.context._needsCheck = true;
        }
        const abortTask = scheduleChangeDetection(() => {
            if (this.viewRef) {
                if (this.context._currentIndex === -1) {
                    this.vcRef.remove(this.context._adjPrevIndex);
                    this.forOfView.shouldRunRenderCallback = true;
                    this.destroy();
                    return;
                }
                else if (this.context._adjPrevIndex !== -1) {
                    this.vcRef.move(this.viewRef, this.context._currentIndex);
                    this.forOfView.shouldRunRenderCallback = true;
                }
                else if (this.context._needsCheck) {
                    this.context._needsCheck = false;
                    consumerMarkDirty(this);
                }
            }
            else {
                this.viewRef = this.vcRef.createEmbeddedView(this.tmpRef, this.context, this.context._currentIndex);
                this.viewRef.detach();
                this.forOfView.shouldRunRenderCallback = true;
                consumerMarkDirty(this);
            }
            if (this.dirty) {
                this.run();
            }
            this.forOfView.removeAborter(abortTask);
            this.scheduled = false;
        }, this.forOfView.priorityRef.value, this.viewRef);
        if (abortTask) {
            abortTask.addAbortListener(() => {
                this.forOfView.removeAborter(abortTask);
                this.scheduled = false;
            });
            this.forOfView.addAborter(abortTask);
        }
    },
    run() {
        if (NG_DEV_MODE && isInNotificationPhase()) {
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
            }
            finally {
                consumerAfterComputation(this, prevConsumer);
            }
        }
    },
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        consumerDestroy(this);
    }
}))();
function createItemNode(context, forOfView) {
    const node = Object.create(BASE_NG_ITERABLE_ITEM_NODE);
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
function assertValidPropertyPath(obj, propPath) {
    if (obj == null) {
        throw new Error(`[qxFor][trackBy]: Tracking by property path '${propPath}' is imposable for null or undefined!`);
    }
    let start = 0;
    let current = obj;
    while (start < propPath.length) {
        const dotIndex = propPath.indexOf(".", start);
        const key = dotIndex === -1 ? propPath.substring(start) : propPath.substring(start, dotIndex);
        if (current == null) {
            throw new Error(`[qxFor][trackBy]: Invalid property path '${propPath}'! Property '${propPath.substring(0, start - 1)}' is null or undefined.`);
        }
        current = current[key];
        start = dotIndex === -1 ? propPath.length : dotIndex + 1;
        if (dotIndex !== -1 && current == null) {
            throw new Error(`[qxFor][trackBy]: Invalid property path '${propPath}'! Property '${propPath.substring(0, start - 1)}' is null or undefined.`);
        }
    }
    if (current == null) {
        console.warn(`[qxFor][trackBy]: Provided property path '${propPath}' for tracking changes is null or undefined!`);
    }
}
/**
 * @description
 * Provides an override for `QueuexForOf` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
function provideQueuexForOfDefaultPriority(priority) {
    return { provide: QX_FOR_OF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexForOfDefaultPriority) };
}
function trackByIndex(index, item) {
    return index;
}
function trackByItem(index, item) {
    return item;
}
class ClientQueuexForOfView {
    forOfDir;
    dataSource;
    priorityRef;
    vcRef = inject(ViewContainerRef);
    tmpRef = inject(TemplateRef);
    differs = inject(QueuexIterableDiffers);
    differ = null;
    iterating = false;
    rendering = false;
    shouldRunRenderCallback = false;
    aborting = false;
    updateScheduled = false;
    disposed = false;
    count = 0;
    aborters = [];
    inputWatcher = null;
    trackByFn = null;
    constructor(forOfDir, dataSource, priorityRef) {
        this.forOfDir = forOfDir;
        this.dataSource = dataSource;
        this.priorityRef = priorityRef;
    }
    init(trackByFn) {
        this.trackByFn = trackByFn;
        this.inputWatcher = createWatch(() => this.update(), () => this.scheduleUpdate(), true);
        this.inputWatcher.notify();
    }
    add(record) {
        const { currentIndex, item } = record;
        new ClientQueuexForOfContext(currentIndex, this.count, item, this.dataSource, this);
    }
    remove(record, adjustedIndex) {
        const context = this.vcRef.get(record.previousIndex).context;
        context._currentIndex = -1;
        context._adjPrevIndex = adjustedIndex;
        context._setItem(record.item);
        context._node.schedule();
    }
    move(record, adjustedPreviousIndex, changed) {
        const { currentIndex, item } = record;
        const context = this.vcRef.get(record.previousIndex).context;
        context._currentIndex = currentIndex;
        context._adjPrevIndex = adjustedPreviousIndex;
        context._setIndex(currentIndex);
        context._setCount(this.count);
        context._setItem(item);
        context._node.schedule();
    }
    noop(record, changed) {
        const { currentIndex, item } = record;
        const context = this.vcRef.get(record.previousIndex).context;
        context._currentIndex = currentIndex;
        context._adjPrevIndex = -1;
        context._setIndex(currentIndex);
        context._setCount(this.count);
        context._setItem(item);
        context._node.schedule();
    }
    done() {
        const abortTask = scheduleTask(() => {
            this.rendering = false;
            if (this.shouldRunRenderCallback) {
                this.shouldRunRenderCallback = false;
                this.forOfDir.qxForRenderCallback?.(this.dataSource());
            }
        }, this.priorityRef.value);
        this.addAborter(abortTask);
    }
    update() {
        const data = this.dataSource();
        const prevConsumer = setActiveConsumer(null);
        try {
            if (!this.differ && data) {
                this.differ = this.differs.find(data).create(this.trackByFn);
            }
            if (this.differ) {
                if (this.rendering) {
                    const currentState = [];
                    for (let i = 0; i < this.vcRef.length; i++) {
                        const context = this.vcRef.get(i).context;
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
                    this.count = changes.length;
                    changes.applyOperations(this);
                    this.iterating = false;
                }
                else if (this.rendering) {
                    this.done();
                }
            }
        }
        finally {
            setActiveConsumer(prevConsumer);
            this.updateScheduled = false;
        }
    }
    scheduleUpdate() {
        if (this.updateScheduled) {
            return;
        }
        this.updateScheduled = true;
        if (isInConcurrentTaskContext()) {
            onTaskExecuted(() => {
                if (this.disposed) {
                    return;
                }
                this.inputWatcher.run();
            });
        }
        else {
            scheduleTask(() => this.inputWatcher.run(), 1 /* Highest */);
        }
    }
    abort() {
        this.aborting = true;
        while (this.aborters.length) {
            this.aborters.shift()();
        }
        this.aborting = false;
    }
    addAborter(abortTask) {
        this.aborters.push(abortTask);
    }
    removeAborter(abortTask) {
        if (this.aborting) {
            return;
        }
        const index = this.aborters.indexOf(abortTask);
        if (index > -1) {
            this.aborters.splice(index, 1);
        }
    }
    dispose() {
        this.disposed = true;
        this.abort();
        for (let i = 0; i < this.vcRef.length; i++) {
            this.vcRef.get(i).context._node.destroy();
        }
    }
}
class ServerQueuexForOfView {
    _dataSource;
    _vcRef = inject(ViewContainerRef);
    _tmpRef = inject(TemplateRef);
    _differs = inject(QueuexIterableDiffers);
    _differ = null;
    _count = 0;
    _trackByFn = null;
    constructor(_dataSource) {
        this._dataSource = _dataSource;
        effect(() => {
            this._update(this._dataSource());
        });
    }
    add(record) {
        const { currentIndex, item } = record;
        const context = new ServerQueuexForOfContext(currentIndex, this._count, item, this._dataSource);
        this._vcRef.createEmbeddedView(this._tmpRef, context, currentIndex);
    }
    remove(_, adjustedIndex) {
        this._vcRef.remove(adjustedIndex);
    }
    move(record, adjustedPreviousIndex) {
        const { item, currentIndex } = record;
        const viewRef = this._vcRef.get(adjustedPreviousIndex);
        this._vcRef.move(viewRef, currentIndex);
        this._updateContext(viewRef.context, currentIndex, item);
    }
    noop(record) {
        const { item, currentIndex } = record;
        const viewRef = this._vcRef.get(currentIndex);
        this._updateContext(viewRef.context, currentIndex, item);
    }
    done() { }
    init(trackByFn) {
        this._trackByFn = trackByFn;
    }
    dispose() { }
    _update(data) {
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
    _updateContext(context, index, item) {
        context._setIndex(index);
        context._setItem(item);
        context._setCount(this._count);
    }
}
/**
 * @Directive QueuexForOf
 *
 * This directive serves as a modern, high-performance replacement for Angular’s built-in `NgForOf` **(restricted to immutable objects)**. It leverages a concurrent scheduling
 * mechanism to transform immutable data collections into fully synchronized UI views while seamlessly managing local change detection within embedded views.
 * Unlike traditional approaches, every signal change read directly in the template automatically triggers its own localized change detection cycle.
 *
 * What makes this unique is that these updates are completely independent — they do not rely on the host component’s change detection, nor are they tied
 * to Angular’s global change detection cycles. Instead, each embedded view is deliberately detached from the logical tree and operates within its own dedicated
 * reactive context. This architecture not only improves rendering efficiency and responsiveness but also empowers developers to build highly dynamic, scalable interfaces
 * that remain smooth and predictable, even under heavy data or interaction loads.
 *
 * In addition, the directive introduces a streamlined approach to configuring `trackBy`, making it both easier to use and more powerful thanks to advanced autocompletion support.
 * Instead of writing verbose functions, developers can simply reference built-in identifiers such as `index` or `item`, or directly target object properties using the `item.` prefix.
 * For instance, given a `Person { id: number; name: string; age: number }` interface, the `trackBy` input can be set to `index`, item, or `item.id`. This not only reduces boilerplate
 * code but also improves developer productivity by offering intelligent suggestions right inside the editor.
 *
 * ### Server side fallback
 *
 * On the server side, the directive behaves just like Angular’s native NgForOf. The advanced features designed for client-side rendering — such as concurrent scheduling,
 * localized change detection, and reactive embedded contexts — are not only unnecessary during server-side rendering but could even introduce unwanted overhead. By falling back
 * to the simpler NgForOf behavior, the directive ensures optimal performance in SSR scenarios, producing clean, predictable HTML output without sacrificing rendering speed or efficiency.
 *
 * ### Inputs
 *
 * ```ts
 * // A collection of data for display.
 * *@Input({ required: true })
 *  set qxForOf(data: QueuexForOfInput<T, U> )
 *
 * //A priority for concurrent scheduler to manage views.
 * *@Input({ transform: advancePriorityInputTransform })
 *  set qxForPriority(priority: PriorityLevel | Signal<PriorityLevel>);
 *
 * //A strategy for tracking changes in collection what can improve user experience (e.g. 'item', 'index', 'item.id').
 * *@Input({ required: true })
 * set qxForTrackBy(trackBy: TrackBy<T>)
 *
 *
 * //A hook what will be used in browser where at least one view gets created, destroyed or moved
 * *@Input()
 * qxForRenderCallback: ((data: QueuexForOfInput<T, U>) => void) | null;
 * ```
 *
 * ### Context variables
 *
 * ```ts
 *  interface QueuexForOfContext<T, U extends NgIterable<T> = NgIterable<T>> {
 *
 *    readonly $implicit: Signal<T>;
 *    readonly qxForOf: Signal<QueuexForOfInput<T, U>>;
 *    readonly index: Signal<number>;
 *    readonly count: Signal<number>;
 *    readonly first: Signal<boolean>;
 *    readonly last: Signal<boolean>;
 *    readonly even: Signal<boolean>;
 *    readonly odd: Signal<boolean>;
 *
 *  }
 * ```
 */
class QueuexForOf {
    _trackBy = null;
    _itemPropPath = undefined;
    _view = null;
    _dataSource = sharedSignal(undefined, NG_DEV_MODE ? 'qxForOf' : undefined);
    _priorityRef = value(inject(QX_FOR_OF_DEFAULT_PRIORITY), NG_DEV_MODE ? 'qxForOfPriority' : undefined);
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set qxForPriority(priority) {
        this._priorityRef.set(priority);
    }
    /**
     * A collection of data for display.
     */
    set qxForOf(data) {
        this._dataSource.set(data);
    }
    /**
     * A strategy for tracking changes in collection what can improve user experience.
     *
     * When items are added, moved, or removed in the iterable, the directive must re-render the appropriate DOM nodes.
     * To minimize churn in the DOM, only nodes that have changed are re-rendered.
     *
     * If is set to `index`, each item will be compared by index position.
     *
     * If is set to item, each item will be compared by strick equality (===).
     *
     * If item contains a uniq identifier (e.g `{ id: string }`), it is preferred to use that for comparison
     * by setting `trackBy: 'item.id'`.
     *
     * @throws Error if invalid string value is provided.
     */
    set qxForTrackBy(trackBy) {
        if (this._trackBy) {
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
            this._trackBy = (function (index, item) {
                if (NG_DEV_MODE) {
                    assertValidPropertyPath(item, this._itemPropPath);
                }
                return item[this._itemPropPath];
            }).bind(this);
            return;
        }
        throw new Error('[qxFor][trackBy]: Incorrect value provided to "trackBy" function! It only accepts \'index\', \'item\' ' +
            'or any value of type string prefixed with \'item.\' where it should be a path to property. For example ' +
            'if item is an instance of class Person { id: string, name: string } you should provide \'item.id\'.');
    }
    /**
     * A callback what will be called when at least one of the template gets created, removed or moved. This enables developers to perform actions when rendering has been done.
     * The `qxForRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `qxForRenderCallback` emits the latest value causing the view to update.
     */
    qxForRenderCallback = null;
    constructor() {
        assertNgQueuexIntegrated('[qxFor]: Assertion failed! "@ng-queuex/core" integration not provided!');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._view = new ServerQueuexForOfView(this._dataSource.ref);
        }
        else {
            this._view = new ClientQueuexForOfView(this, this._dataSource.ref, this._priorityRef);
        }
    }
    /**
     * @internal
     */
    ngOnInit() {
        this._view.init(this._trackBy);
    }
    /**
     * @internal
     */
    ngOnDestroy() {
        this._view.dispose();
    }
    static ngTemplateContextGuard(dir, ctx) {
        return true;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexForOf, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "16.1.0", version: "20.1.0", type: QueuexForOf, isStandalone: true, selector: "ng-template[qxFor]", inputs: { qxForPriority: ["qxForPriority", "qxForPriority", advancePriorityInputTransform], qxForOf: "qxForOf", qxForTrackBy: "qxForTrackBy", qxForRenderCallback: "qxForRenderCallback" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexForOf, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[qxFor]' }]
        }], ctorParameters: () => [], propDecorators: { qxForPriority: [{
                type: Input,
                args: [{ transform: advancePriorityInputTransform }]
            }], qxForOf: [{
                type: Input,
                args: [{ required: true }]
            }], qxForTrackBy: [{
                type: Input,
                args: [{ required: true }]
            }], qxForRenderCallback: [{
                type: Input
            }] } });
class ServerQueuexForOfContext {
    $implicit;
    qxForOf;
    index;
    count;
    first;
    last;
    even;
    odd;
    _setIndex;
    _setCount;
    _setItem;
    constructor(index, count, item, qxForOf) {
        const [indexGetFn, indexSetFn] = createSignal(index);
        this.index = indexGetFn;
        this._setIndex = indexSetFn;
        const [countGetFn, countSetFn] = createSignal(count);
        this.count = countGetFn;
        this._setCount = countSetFn;
        const [itemGetFn, itemSetFn] = createSignal(item);
        this.$implicit = itemGetFn;
        this._setItem = itemSetFn;
        this.qxForOf = qxForOf;
        this.first = computed(() => this.index() === 0, ...(ngDevMode ? [{ debugName: "first" }] : []));
        this.last = computed(() => this.index() === this.count() - 1, ...(ngDevMode ? [{ debugName: "last" }] : []));
        this.even = computed(() => this.index() % 2 === 0, ...(ngDevMode ? [{ debugName: "even" }] : []));
        this.odd = computed(() => this.index() % 2 !== 0, ...(ngDevMode ? [{ debugName: "odd" }] : []));
        if (NG_DEV_MODE) {
            indexGetFn.toString = () => `[Signal: ${indexGetFn()}]`;
            indexGetFn.debugName = 'QueuexFotOfContextIndexSignal';
            countGetFn.toString = () => `[Signal: ${countGetFn()}]`;
            countGetFn.debugName = 'QueuexFotOfContextCountSignal';
            itemGetFn.toString = () => `[Signal: ${itemGetFn()}]`;
            itemGetFn.debugName = 'QueuexFotOfContextItemSignal';
        }
    }
}
class ClientQueuexForOfContext extends ServerQueuexForOfContext {
    _currentIndex;
    _adjPrevIndex = -1;
    _needsCheck = false;
    _node;
    constructor(index, count, item, qxForOf, forOfView) {
        super(index, count, item, qxForOf);
        this._currentIndex = index;
        this._node = createItemNode(this, forOfView);
        consumerMarkDirty(this._node);
    }
}

const BASE_THEN_QUEUEX_EFFECT_NODE = 
/* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    abortTask: null,
    consumerMarkedDirty() {
        if (NG_DEV_MODE) {
            assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!');
        }
        this.schedule();
    },
    schedule() {
        if (NG_DEV_MODE) {
            assertNotInReactiveContext(() => 'Internal Error: Reactive context (THEN_NODE)!');
        }
        if (this.destroyed || this.scheduled) {
            return;
        }
        this.scheduled = true;
        this.abortTask = scheduleChangeDetection(() => {
            if (this.destroyed) {
                return;
            }
            let thenViewRef = this.view.thenViewRef;
            const vcRef = this.view.vcRef;
            if (this.tmpRef !== this.view.thenTmpRef) {
                this.tmpRef = this.view.thenTmpRef;
                if (thenViewRef) {
                    const index = vcRef.indexOf(thenViewRef);
                    vcRef.remove(index);
                    this.view.thenViewRef = null;
                    thenViewRef = null;
                    this.renderCbShouldRun = true;
                }
            }
            if (this.view.context.$implicit()) {
                if (!thenViewRef) {
                    this.view.thenViewRef = vcRef.createEmbeddedView(this.view.thenTmpRef, this.view.context);
                    this.view.thenViewRef.detach();
                    consumerMarkDirty(this);
                    this.renderCbShouldRun = true;
                }
            }
            else {
                if (thenViewRef) {
                    const index = vcRef.indexOf(thenViewRef);
                    vcRef.remove(index);
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
    run() {
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
            }
            finally {
                consumerAfterComputation(this, prevConsumer);
            }
        }
    },
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        consumerDestroy(this);
        this.abortTask?.();
    }
}))();
const BASE_ELSE_QUEUEX_EFFECT_NODE = 
/* @__PURE__ */ (() => ({
    ...REACTIVE_NODE,
    consumerIsAlwaysLive: true,
    consumerAllowSignalWrites: false,
    kind: 'effect',
    consumerMarkedDirty() {
        if (NG_DEV_MODE) {
            assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!');
        }
        this.schedule();
    },
    schedule() {
        if (NG_DEV_MODE) {
            assertNotInReactiveContext(() => 'Internal Error: Reactive context (ELSE_NODE)!');
        }
        if (this.destroyed || this.scheduled) {
            return;
        }
        this.scheduled = true;
        this.abortTask = scheduleChangeDetection(() => {
            if (this.destroyed) {
                return;
            }
            let elseViewRef = this.view.elseViewRef;
            const vcRef = this.view.vcRef;
            if (this.tmpRef !== this.view.elseTmpRef) {
                this.tmpRef = this.view.elseTmpRef;
                if (elseViewRef) {
                    const index = vcRef.indexOf(elseViewRef);
                    vcRef.remove(index);
                    this.view.elseViewRef = null;
                    elseViewRef = null;
                    this.renderCbShouldRun = true;
                }
            }
            if (this.view.context.$implicit()) {
                if (elseViewRef) {
                    const index = vcRef.indexOf(elseViewRef);
                    vcRef.remove(index);
                    this.view.elseViewRef = null;
                    this.renderCbShouldRun = true;
                }
            }
            else {
                if (!elseViewRef && this.view.elseTmpRef) {
                    this.view.elseViewRef = vcRef.createEmbeddedView(this.view.elseTmpRef, this.view.context);
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
    run() {
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
            }
            finally {
                consumerAfterComputation(this, prevConsumer);
            }
        }
    },
    destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        consumerDestroy(this);
        this.abortTask?.();
    }
}))();
function createThenNode(view) {
    const node = Object.create(BASE_THEN_QUEUEX_EFFECT_NODE);
    node.view = view;
    node.abortTask = null;
    node.destroyed = false;
    node.scheduled = false;
    node.hasRun = false;
    node.dirty = false;
    node.tmpRef = null;
    node.renderCbShouldRun = false;
    return node;
}
function createElseNode(view) {
    const node = Object.create(BASE_ELSE_QUEUEX_EFFECT_NODE);
    node.view = view;
    node.abortTask = null;
    node.destroyed = false;
    node.scheduled = false;
    node.hasRun = false;
    node.dirty = false;
    node.tmpRef = null;
    node.renderCbShouldRun = false;
    return node;
}
const QX_IF_DEFAULT_PRIORITY = new InjectionToken('QX_IF_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });
/**
 * @description
 * Provides an override for `QueuexIf` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
function provideQueuexIfDefaultPriority(priority) {
    return { provide: QX_IF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexIfDefaultPriority) };
}
class ClientQxIfView {
    ifDir;
    thenTmpRefSource;
    elseTmpRefSource;
    priorityRef;
    context = null;
    inputWatcher = null;
    thenNode = null;
    elseNode = null;
    thenViewRef = null;
    elseViewRef = null;
    thenTmpRef;
    elseTmpRef = null;
    vcRef = inject(ViewContainerRef);
    disposed = false;
    abortTask = null;
    renderCallbackAbortTask = null;
    renderCallbackScheduled = false;
    inputWatchScheduled = false;
    constructor(ifDir, thenTmpRefSource, elseTmpRefSource, priorityRef) {
        this.ifDir = ifDir;
        this.thenTmpRefSource = thenTmpRefSource;
        this.elseTmpRefSource = elseTmpRefSource;
        this.priorityRef = priorityRef;
        this.thenTmpRef = thenTmpRefSource();
    }
    init(context) {
        this.context = context;
        this.inputWatcher = createWatch(() => this.inputWatchCallback(), () => this.scheduleInputWatchCallback(), false);
        this.thenNode = createThenNode(this);
        this.elseNode = createElseNode(this);
        this.inputWatcher.notify();
    }
    inputWatchCallback() {
        this.context.$implicit();
        this.thenTmpRef = assertTemplateRef(this.thenTmpRefSource(), 'qxIfThen');
        this.elseTmpRef = assertTemplateRef(this.elseTmpRefSource(), 'qxIfElse');
        const prevConsumer = setActiveConsumer(null);
        try {
            this.thenNode.schedule();
            this.elseNode.schedule();
        }
        finally {
            setActiveConsumer(prevConsumer);
        }
        this.scheduleRenderCallback();
        this.inputWatchScheduled = false;
    }
    scheduleInputWatchCallback() {
        if (this.inputWatchScheduled) {
            return;
        }
        this.inputWatchScheduled = true;
        if (isInConcurrentTaskContext()) {
            onTaskExecuted(() => {
                if (this.disposed) {
                    return;
                }
                this.inputWatcher.run();
            });
        }
        else {
            this.abortTask = scheduleTask(() => this.inputWatcher.run(), 1 //Highest
            );
        }
    }
    scheduleRenderCallback() {
        if (this.renderCallbackScheduled) {
            return;
        }
        this.renderCallbackScheduled = true;
        this.renderCallbackAbortTask = scheduleTask(() => {
            if (this.thenNode.renderCbShouldRun || this.elseNode.renderCbShouldRun) {
                this.ifDir.qxIfRenderCallback?.(this.context.$implicit());
                this.thenNode.renderCbShouldRun = this.elseNode.renderCbShouldRun = false;
            }
            this.renderCallbackScheduled = false;
        });
    }
    dispose() {
        this.disposed = true;
        this.abortTask?.();
        this.renderCallbackAbortTask?.();
        this.inputWatcher?.destroy();
        this.thenNode?.destroy();
        this.elseNode?.destroy();
    }
}
class ServerQxIfView {
    context = null;
    thenViewRef = null;
    elseViewRef = null;
    thenTmpRef = null;
    elseTmpRef = null;
    vcRef = inject(ViewContainerRef);
    cdRef = inject(ChangeDetectorRef);
    value;
    directiveIsInit = false;
    constructor(thenTmpRefSource, elseTmpRefSource) {
        effect(() => {
            this.value = this.context.$implicit();
            this.update(this.value, assertTemplateRef(thenTmpRefSource(), 'qxIfThen'), assertTemplateRef(elseTmpRefSource(), 'qxIfElse'));
        });
    }
    init(context) {
        this.context = context;
    }
    update(value, thenTmpRef, elseTmpRef) {
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
                this.thenViewRef = this.vcRef.createEmbeddedView(this.thenTmpRef, this.context);
            }
        }
        else {
            if (!this.elseViewRef) {
                this.vcRef.clear();
                this.thenViewRef = null;
                if (this.elseTmpRef) {
                    this.elseViewRef = this.vcRef.createEmbeddedView(this.elseTmpRef, this.context);
                }
            }
        }
    }
    dispose() { }
}
/**
 * @Directive QueuexIf
 *
 * The `QueuexIf` directive is a structural directive that serves as a drop-in replacement for Angular’s native `NgIf` **(restricted to immutable objects)**,
 * but comes with additional advanced capabilities. Much like NgIf, it is designed for conditional rendering of templates based on the value bound to its input.
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
class QueuexIf {
    _view;
    _defaultThenTemplate = inject(TemplateRef);
    _conditionSource = sharedSignal(undefined, NG_DEV_MODE ? 'conditionSource' : undefined);
    _thenTmpRefSource = sharedSignal(this._defaultThenTemplate, NG_DEV_MODE ? 'thenTemplateRefSource' : undefined);
    _elseTmpRefSource = sharedSignal(null, NG_DEV_MODE ? 'elseTemplateRefSource' : undefined);
    _priorityRef = value(inject(QX_IF_DEFAULT_PRIORITY), NG_DEV_MODE ? 'priorityRef' : undefined);
    /**
     * A callback what will be called when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
     * The `qxIfRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `qxIfRenderCallback` emits the latest value causing the view to update.
     */
    qxIfRenderCallback = null;
    /**
     * The value to evaluate as the condition for showing a template.
     */
    set qxIf(condition) {
        this._conditionSource.set(condition);
    }
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set qxIfPriority(priorityLevel) {
        this._priorityRef.set(priorityLevel);
    }
    /**
     * A template to show if the condition evaluates to be truthy.
     */
    set qxIfThen(thenTmpRef) {
        thenTmpRef != null ? this._thenTmpRefSource.set(thenTmpRef) : this._thenTmpRefSource.set(this._defaultThenTemplate);
    }
    /**
     * A template to show if the condition evaluates to be falsy.
     */
    set qxIfElse(elseTmpRef) {
        this._elseTmpRefSource.set(elseTmpRef);
    }
    constructor() {
        assertNgQueuexIntegrated('[qxIf]: Assertion failed! "@ng-queuex/core" integration not provided.');
        if (isPlatformBrowser(inject(PLATFORM_ID))) {
            this._view = new ClientQxIfView(this, this._thenTmpRefSource.ref, this._elseTmpRefSource.ref, this._priorityRef);
        }
        else {
            this._view = new ServerQxIfView(this._thenTmpRefSource.ref, this._elseTmpRefSource.ref);
        }
    }
    /**
     * @internal
     */
    ngOnInit() {
        this._view.init(new QueuexIfContext(this._conditionSource.ref));
    }
    /**
     * @internal
     */
    ngOnDestroy() {
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
    static ngTemplateGuard_qxIf;
    static ngTemplateContextGuard(dir, ctx) {
        return true;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexIf, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "16.1.0", version: "20.1.0", type: QueuexIf, isStandalone: true, selector: "ng-template[qxIf]", inputs: { qxIfRenderCallback: "qxIfRenderCallback", qxIf: "qxIf", qxIfPriority: ["qxIfPriority", "qxIfPriority", advancePriorityInputTransform], qxIfThen: "qxIfThen", qxIfElse: "qxIfElse" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexIf, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[qxIf]' }]
        }], ctorParameters: () => [], propDecorators: { qxIfRenderCallback: [{
                type: Input
            }], qxIf: [{
                type: Input,
                args: [{ required: true }]
            }], qxIfPriority: [{
                type: Input,
                args: [{ transform: advancePriorityInputTransform }]
            }], qxIfThen: [{
                type: Input
            }], qxIfElse: [{
                type: Input
            }] } });
class QueuexIfContext {
    $implicit;
    qxIf;
    constructor(valueSource) {
        this.$implicit = this.qxIf = valueSource;
    }
}
function assertTemplateRef(templateRef, propertyName) {
    if (templateRef && typeof templateRef.createEmbeddedView !== 'function') {
        let typeName;
        if (typeof templateRef === 'object' || typeof templateRef === 'function') {
            typeName = templateRef.constructor.name;
        }
        else {
            typeName = typeof templateRef;
        }
        throw new Error(`${propertyName} must be TemplateRef, but received ${typeName}`);
    }
    return templateRef;
}

const QX_LAZY_VIEW_DEFAULT_PRIORITY = new InjectionToken('PriorityLevel', { factory: () => 3 /* Priority.Normal */ });
/**
 * @deprecated
 * Provides an override for `QueuexLazyView` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
function provideQueuexLazyViewDefaultPriority(priority) {
    return { provide: QX_LAZY_VIEW_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexLazyViewDefaultPriority) };
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
class QueuexLazyView {
    _abortTask = null;
    _renderCbAbortTask = null;
    _vcRef = inject(ViewContainerRef);
    _tmpRef = inject(TemplateRef);
    _isServer = false;
    /**
     * A priority for concurrent scheduler to create view. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     */
    priority = inject(QX_LAZY_VIEW_DEFAULT_PRIORITY);
    /**
     * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
     * The `lazyViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `lazyViewRenderCallback` emits the latest value causing the view to update.
     */
    lazyViewRenderCallback = null;
    constructor() {
        assertNgQueuexIntegrated('[lazyView]: Assertion failed! "@ng-queuex/core" integration not provided.');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._vcRef.createEmbeddedView(this._tmpRef);
            this._isServer = true;
        }
    }
    ngOnInit() {
        if (this._isServer) {
            return;
        }
        this._abortTask = scheduleTask(() => {
            const viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
            _markForRefresh(viewRef);
        }, this.priority);
        this._renderCbAbortTask = scheduleTask(() => {
            this.lazyViewRenderCallback?.();
        }, this.priority);
    }
    ngOnDestroy() {
        this._abortTask?.();
        this._renderCbAbortTask?.();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexLazyView, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "16.1.0", version: "20.1.0", type: QueuexLazyView, isStandalone: true, selector: "ng-template[lazyView]", inputs: { priority: ["lazyView", "priority", priorityInputTransform], lazyViewRenderCallback: "lazyViewRenderCallback" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexLazyView, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[lazyView]' }]
        }], ctorParameters: () => [], propDecorators: { priority: [{
                type: Input,
                args: [{ alias: 'lazyView', transform: priorityInputTransform }]
            }], lazyViewRenderCallback: [{
                type: Input
            }] } });

const QX_REACTIVE_VIEW_PRIORITY = new InjectionToken('QX_REACTIVE_VIEW_PRIORITY', { factory: () => 3 });
/**
 * @description
 * Provides an override for `QueuexReactiveView` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
function provideQueuexReactiveViewDefaultPriority(priority) {
    return { provide: QX_REACTIVE_VIEW_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexReactiveViewDefaultPriority) };
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
class QueuexReactiveView {
    _tmpRef = inject(TemplateRef);
    _vcRef = inject(ViewContainerRef);
    _watcher = null;
    _viewRef = null;
    _scheduled = false;
    _abortTask = null;
    _renderCbAbortTask = null;
    _isServer = false;
    _priorityRef = value(inject(QX_REACTIVE_VIEW_PRIORITY), NG_DEV_MODE ? '[reactiveView]="priorityLevel"' : undefined);
    /**
     * A priority for concurrent scheduler to manage view. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values.
     */
    set priority(value) {
        this._priorityRef.set(value);
    }
    /**
     * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
     * The `reactiveViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `reactiveViewRenderCallback` emits the latest value causing the view to update.
     */
    reactiveViewRenderCallback = null;
    constructor() {
        assertNgQueuexIntegrated('[reactiveView]: Assertion failed! "@ng-queuex/core" integration not provided.');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._vcRef.createEmbeddedView(this._tmpRef);
            this._isServer = true;
        }
    }
    ngOnInit() {
        if (this._isServer) {
            return;
        }
        this._watcher = createWatch(() => this._effectCallback(), () => this._scheduleEffectCallback(), false);
        this._watcher.notify();
        this._renderCbAbortTask = scheduleTask(() => {
            this.reactiveViewRenderCallback?.();
        }, this._priorityRef.value);
    }
    _effectCallback() {
        if (!this._viewRef) {
            this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
        }
        detectChangesSync(this._viewRef);
        this._scheduled = false;
    }
    _scheduleEffectCallback() {
        if (this._scheduled) {
            return;
        }
        this._scheduled = true;
        this._abortTask = scheduleChangeDetection(() => this._watcher.run(), this._priorityRef.value, this._viewRef);
    }
    ngOnDestroy() {
        this._abortTask?.();
        this._renderCbAbortTask?.();
        this._watcher?.destroy();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexReactiveView, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "16.1.0", version: "20.1.0", type: QueuexReactiveView, isStandalone: true, selector: "ng-template[reactiveView]", inputs: { priority: ["reactiveView", "priority", advancePriorityInputTransform], reactiveViewRenderCallback: "reactiveViewRenderCallback" }, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexReactiveView, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[reactiveView]' }]
        }], ctorParameters: () => [], propDecorators: { priority: [{
                type: Input,
                args: [{ alias: 'reactiveView', transform: advancePriorityInputTransform }]
            }], reactiveViewRenderCallback: [{
                type: Input
            }] } });

class ServerCaseView {
    _vcRef = inject(ViewContainerRef);
    _tmpRef = inject(TemplateRef);
    _viewRef = null;
    _cdRef = inject(ChangeDetectorRef);
    _caseSource = null;
    _switchView;
    isChecking = false;
    constructor(caseSource) {
        const switchView = inject(SwitchView, { optional: true, host: true });
        if (NG_DEV_MODE && !switchView) {
            if (caseSource) {
                throwQxSwitchProviderNotFoundError('qxSwitchCase', 'QueuexSwitchCase');
            }
            else {
                throwQxSwitchProviderNotFoundError('qxSwitchDefault', 'QueuexSwitchDefault');
            }
        }
        this._switchView = switchView;
        if (caseSource) {
            switchView.addCase(this, caseSource);
            this._caseSource = caseSource;
            effect(() => {
                caseSource();
                if (this.isChecking) {
                    return;
                }
                _markForRefresh(this._cdRef);
            });
        }
        else {
            switchView.addDefault(this);
        }
    }
    initialize() { }
    enforceState(create) {
        if (create && !this._viewRef) {
            this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
        }
        else if (!create && this._viewRef) {
            this._vcRef.clear();
            this._viewRef = null;
        }
        return create;
    }
    check() {
        this.enforceState(this._switchView.match(this._caseSource()));
    }
    dispose() { }
}
class ClientCaseView {
    _create = signal(false, ...(ngDevMode ? [{ debugName: "_create" }] : []));
    _vcRef = inject(ViewContainerRef);
    _tmpRef = inject(TemplateRef);
    _viewRef = null;
    _switchView;
    _watcher = null;
    _abortTask = null;
    _scheduled = false;
    constructor(caseSource) {
        const switchView = inject(SwitchView, { optional: true, host: true });
        if (NG_DEV_MODE && !switchView) {
            if (caseSource) {
                throwQxSwitchProviderNotFoundError('qxSwitchCase', 'QueuexSwitchCase');
            }
            else {
                throwQxSwitchProviderNotFoundError('qxSwitchDefault', 'QueuexSwitchDefault');
            }
        }
        this._switchView = switchView;
        if (caseSource) {
            switchView.addCase(this, caseSource);
        }
        else {
            switchView.addDefault(this);
        }
    }
    isChecking = false;
    initialize() {
        this._watcher = createWatch(() => this._runEffect(), () => this._scheduleEffect(), false);
        this._watcher.notify();
    }
    enforceState(create) {
        this._create.set(create);
        return create;
    }
    check() { }
    dispose() {
        if (this._watcher) {
            this._watcher.destroy();
        }
        if (this._abortTask) {
            this._abortTask();
        }
    }
    _runEffect() {
        const create = this._create();
        if (create && !this._viewRef) {
            this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
            this._switchView.shouldEmitRenderEvent();
        }
        else if (!create && this._viewRef) {
            this._vcRef.clear();
            this._viewRef = null;
            this._switchView.shouldEmitRenderEvent();
        }
        if (this._viewRef) {
            detectChangesSync(this._viewRef);
        }
        this._scheduled = false;
    }
    _scheduleEffect() {
        if (this._scheduled) {
            return;
        }
        this._scheduled = true;
        this._abortTask = scheduleChangeDetection(() => this._watcher.run(), this._switchView.priority, this._viewRef);
    }
}
class SwitchView {
}
class ServerSwitchView {
    _defaultViews = [];
    _defaultUsed = false;
    _caseCount = 0;
    _lastCaseCheckIndex = 0;
    _lastCaseMatched = false;
    _switchSource = null;
    _injector = inject(Injector);
    isChecking = false;
    get priority() {
        throw new Error('Internal Error: ServerSwitchView#priority not supported property');
    }
    initialize(directive, cdRef, switchSource, priorityRef) {
        this._switchSource = switchSource;
        effect(() => {
            switchSource();
            if (this._caseCount === 0) {
                this._updataDefaultCases(true);
            }
            if (this.isChecking) {
                return;
            }
            _markForRefresh(cdRef);
        }, { injector: this._injector });
    }
    addCase(caseView, caseSource) {
        this._caseCount++;
    }
    addDefault(defaultView) {
        this._defaultViews.push(defaultView);
    }
    match(value) {
        const matched = value === this._switchSource();
        this._lastCaseMatched ||= matched;
        this._lastCaseCheckIndex++;
        if (this._lastCaseCheckIndex === this._caseCount) {
            this._updataDefaultCases(!this._lastCaseMatched);
            this._lastCaseCheckIndex = 0;
            this._lastCaseMatched = false;
        }
        return matched;
    }
    shouldEmitRenderEvent() { }
    dispose() { }
    _updataDefaultCases(useDefault) {
        if (this._defaultViews.length && this._defaultUsed !== useDefault) {
            this._defaultUsed = useDefault;
            for (let i = 0; i < this._defaultViews.length; i++) {
                this._defaultViews[i].enforceState(useDefault);
            }
        }
    }
}
class ClientSwitchView {
    _directive = null;
    _switchSource = null;
    _switch;
    _priorityRef = null;
    _caseViews = [];
    _defaultViews = [];
    _viewsToInitialize = [];
    _watcher = null;
    _abortTask = null;
    _abortEventTask = null;
    _emitEvent = false;
    _scheduled = false;
    _disposed = false;
    isChecking = false;
    get priority() {
        return this._priorityRef.value;
    }
    initialize(directive, cdRef, switchSource, priorityRef) {
        this._directive = directive;
        this._switchSource = switchSource;
        this._priorityRef = priorityRef;
        this._watcher = createWatch(() => this._runEffect(), () => this._scheduleEffect(), true);
        this._watcher.notify();
    }
    addCase(caseView, caseSource) {
        this._caseViews.push([caseView, caseSource]);
        this._viewsToInitialize.push(caseView);
    }
    addDefault(defaultView) {
        this._defaultViews.push(defaultView);
        this._viewsToInitialize.push(defaultView);
    }
    match(value) {
        return value === this._switch;
    }
    shouldEmitRenderEvent() {
        this._emitEvent = true;
    }
    dispose() {
        this._disposed = true;
        if (this._watcher) {
            this._watcher.destroy();
        }
        if (this._abortTask) {
            this._abortTask();
        }
    }
    _runEffect() {
        if (this._viewsToInitialize) {
            const prevConsumer = setActiveConsumer(null);
            try {
                for (let i = 0; i < this._viewsToInitialize.length; i++) {
                    this._viewsToInitialize[i].initialize();
                }
                this._viewsToInitialize = null;
            }
            finally {
                setActiveConsumer(prevConsumer);
            }
        }
        this._switch = this._switchSource();
        let matched = false;
        for (let i = 0; i < this._caseViews.length; i++) {
            const [switchView, switchSource] = this._caseViews[i];
            matched = switchView.enforceState(this.match(switchSource())) || matched;
        }
        for (let i = 0; i < this._defaultViews.length; i++) {
            this._defaultViews[i].enforceState(!matched);
        }
        if (this._abortEventTask) {
            this._abortEventTask();
        }
        this._abortEventTask = scheduleTask(() => {
            if (this._emitEvent) {
                this._emitEvent = false;
                this._directive.render.emit(this._switchSource());
            }
        }, this._priorityRef.value);
        this._scheduled = false;
    }
    _scheduleEffect() {
        if (this._scheduled) {
            return;
        }
        this._scheduled = true;
        if (isInConcurrentTaskContext()) {
            onTaskExecuted(() => {
                if (this._disposed) {
                    return;
                }
                this._watcher.run();
            });
        }
        else {
            this._abortTask = scheduleTask(() => this._watcher.run(), 1 /** Priority.Highest */);
        }
    }
}
const QX_SWITCH_DEFAULT_PRIORITY = new InjectionToken('QX_SWITCH_DEFAULT_PRIORITY', { factory: () => 3 /* Priority.Normal */ });
function provideQueuexSwitchDefaultPriority(priority) {
    return { provide: QX_SWITCH_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority, provideQueuexSwitchDefaultPriority) };
}
/**
 * @Directive QueuexSwitch
 *
 * `QueuexSwitch` (`[qxSwitch]`) is the core structural directive of the switch family, designed as a drop-in replacement for Angular’s `NgSwitch` **(restricted to immutable objects)**.
 * It enables conditional rendering of templates based on the value of an expression, in combination with `QueuexSwitchCase` (`*qxSwitchCase`)
 * and `QueuexSwitchDefault` (`*qxSwitchDefault`).
 *
 * Each embedded view created by `QueuexSwitch` is:
 * - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, ensuring that it does not participate
 *   in the host component’s change detection cycle.
 * - Assigned its own **isolated reactive context**, which means signals read directly
 *   in the template can trigger fine-grained, independent change detection.
 *
 * When the `[qxSwitch]` expression changes, the directive activates the first matching `*qxSwitchCase` view (or the `*qxSwitchDefault` view if no case matches).
 * Because views are scheduled and detached, rendering is both efficient and predictable, even for complex UI states.
 *
 * ### Server side fallback
 *
 * On the server side, `QueuexSwitch` behaves like Angular’s native `NgSwitch`. No detached views or reactive contexts are created, and no concurrent scheduling
 * takes place. All cases are evaluated synchronously, ensuring predictable and performant SSR output.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading...</p>
 *   <p *qxSwitchCase="'success'">Data loaded successfully ✅</p>
 *   <p *qxSwitchCase="'error'">Something went wrong ❌</p>
 *   <p *qxSwitchDefault>Unknown state 🤔</p>
 * </div>
 * ```
 *
 * ### Inputs
 *
 * ```ts
 * *@Input({ required: true })
 * set qxSwitch(value: any | Signal<any>);
 *
 * // Priority level for concurrent scheduler, used for creating.
 * *@Input({ transform: advancePriorityInputTransform })
 * set priority(priority: PriorityLevel | Signal<PriorityLevel>);
 * ```
 *
 * ### Outputs
 * ```ts
 * //Emits event when at least one of templates gets created or destroyed.
 * render: OutputEmitterRef<any>;
 * ```
 *
 */
class QueuexSwitch {
    _priorityRef = value(inject(QX_SWITCH_DEFAULT_PRIORITY), NG_DEV_MODE ? '[qxSwitch][priority]' : undefined);
    _switchSource = sharedSignal(undefined);
    _view = inject(SwitchView);
    _cdRef = inject(ChangeDetectorRef);
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set priority(priority) {
        this._priorityRef.set(priority);
    }
    set qxSwitch(value) {
        this._switchSource.set(value);
    }
    /**
     * A output what will be emitted when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
     * The `render` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `render` emits the latest value causing the view to update.
     */
    render = output();
    constructor() {
        assertNgQueuexIntegrated('[qxSwitch]: Assertion failed! "@ng-queuex/core" integration not provided.');
    }
    /**
     * @internal
     */
    ngOnChanges(changes) {
        if (changes['qxSwitch']) {
            this._view.isChecking = true;
        }
    }
    /**
     * @internal
     */
    ngOnInit() {
        this._view.initialize(this, this._cdRef, this._switchSource.ref, this._priorityRef);
    }
    /**
     * @internal
     */
    ngAfterContentChecked() {
        this._view.isChecking = false;
    }
    /**
     * @internal
     */
    ngOnDestroy() {
        this._view.dispose();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitch, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "16.1.0", version: "20.1.0", type: QueuexSwitch, isStandalone: true, selector: "[qxSwitch]:not(ng-template)", inputs: { priority: ["priority", "priority", advancePriorityInputTransform], qxSwitch: "qxSwitch" }, outputs: { render: "render" }, providers: [{
                provide: SwitchView,
                useFactory: () => {
                    if (isPlatformServer(inject(PLATFORM_ID))) {
                        return new ServerSwitchView();
                    }
                    else {
                        return new ClientSwitchView();
                    }
                }
            }], usesOnChanges: true, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitch, decorators: [{
            type: Directive,
            args: [{
                    selector: '[qxSwitch]:not(ng-template)',
                    providers: [{
                            provide: SwitchView,
                            useFactory: () => {
                                if (isPlatformServer(inject(PLATFORM_ID))) {
                                    return new ServerSwitchView();
                                }
                                else {
                                    return new ClientSwitchView();
                                }
                            }
                        }]
                }]
        }], ctorParameters: () => [], propDecorators: { priority: [{
                type: Input,
                args: [{ transform: advancePriorityInputTransform }]
            }], qxSwitch: [{
                type: Input,
                args: [{ required: true }]
            }] } });
/**
 * `QueuexSwitchCase` (`*qxSwitchCase`) is a companion structural directive to  `QueuexSwitch` (`[qxSwitch]`). It defines a template block that
 * is rendered when the bound `qxSwitch` expression matches the provided case value.
 *
 * Each case view created by this directive is:
 * - **Lazily instantiated** through the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, so it is not affected by the host
 *   component’s change detection cycle.
 * - Given its own **isolated reactive context**, which allows signals read directly
 *   in the template to trigger local, fine-grained change detection.
 *
 * When the parent `[qxSwitch]` value changes, `QueuexSwitchCase` views are efficiently  scheduled and activated or destroyed depending
 * on whether their case matches.
 *
 * ### Server side fallback
 *
 * During server-side rendering, `QueuexSwitchCase` falls back to the behavior of  Angular’s native `NgSwitchCase`. Views are instantiated
 * synchronously and remain part of the standard logical view tree. No detachment, no isolated reactive contexts, and no scheduling are
 * applied — ensuring clean, fast, and predictable SSR output.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading…</p>
 *   <p *qxSwitchCase="'success'">Data loaded ✅</p>
 *   <p *qxSwitchCase="'error'">Something went wrong ❌</p>
 *   <p *qxSwitchDefault>Unknown state 🤔</p>
 * </div>
 * ```
 * ### Inputs
 * ```ts
 * *@Input({ required: true })
 * set qxSwitchCase(value: any | Signal<any>);
 * ```
 */
class QueuexSwitchCase {
    _caseSource = sharedSignal(undefined, NG_DEV_MODE ? '[qxSwitchCase]' : undefined);
    _caseView;
    set qxSwitchCase(value) {
        this._caseSource.set(value);
    }
    constructor() {
        assertNgQueuexIntegrated('[qxSwitchCase]: Assertion failed! "@ng-queuex/core" integration not provided.');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._caseView = new ServerCaseView(this._caseSource.ref);
        }
        else {
            this._caseView = new ClientCaseView(this._caseSource.ref);
        }
    }
    /**
     * @internal
     */
    ngOnChanges(changes) {
        this._caseView.isChecking = true;
    }
    /**
     * @internal
     */
    ngDoCheck() {
        this._caseView.check();
    }
    /**
     * @internal
     */
    ngAfterContentChecked() {
        this._caseView.isChecking = false;
    }
    /**
     * @internal
     */
    ngOnDestroy() {
        this._caseView.dispose();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitchCase, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "20.1.0", type: QueuexSwitchCase, isStandalone: true, selector: "ng-template[qxSwitchCase]", inputs: { qxSwitchCase: "qxSwitchCase" }, usesOnChanges: true, ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitchCase, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[qxSwitchCase]' }]
        }], ctorParameters: () => [], propDecorators: { qxSwitchCase: [{
                type: Input,
                args: [{ required: true }]
            }] } });
/**
 * `QueuexSwitchDefault` (`*qxSwitchDefault`) is a companion structural directive for `QueuexSwitch` (`[qxSwitch]`). It defines a fallback template
 * that is rendered  when none of the `*qxSwitchCase` values match the parent `[qxSwitch]` expression.
 *
 * The default view created by this directive is:
 * - **Lazily instantiated** using the concurrent scheduler from `ng-queuex/core`.
 * - **Detached from Angular’s logical tree**, ensuring it is independent of the
 *   host component’s change detection.
 * - Assigned its own **isolated reactive context**, so signals read directly in the
 *   template can trigger local, fine-grained change detection.
 *
 * If present, it guarantees that the switch will always render some content when no explicit case matches.
 *
 * @example
 * ```html
 * <div [qxSwitch]="status">
 *   <p *qxSwitchCase="'loading'">Loading…</p>
 *   <p *qxSwitchCase="'success'">Data loaded ✅</p>
 *   <p *qxSwitchDefault>Nothing matched 🤷</p>
 * </div>
 * ```
 *
 */
class QueuexSwitchDefault {
    _view;
    constructor() {
        assertNgQueuexIntegrated('[qxSwitchDefault]: Assertion failed! "@ng-queuex/core" integration not provided.');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._view = new ServerCaseView(null);
        }
        else {
            this._view = new ClientCaseView(null);
        }
    }
    /**
     * @internal
     */
    ngOnDestroy() {
        this._view.dispose();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitchDefault, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "20.1.0", type: QueuexSwitchDefault, isStandalone: true, selector: "ng-template[qxSwitchDefault]", ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexSwitchDefault, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[qxSwitchDefault]' }]
        }], ctorParameters: () => [] });
// const imports: any[] = [QueuexSwitchCase, QueuexSwitchDefault]
// /**
//  * `QueuexSwitchModule` bundles together the `QueuexSwitch` family of structural  directives, providing a drop-in replacement for Angular’s `NgSwitch` system.
//  *
//  * It includes:
//  * - `QueuexSwitch` (`[qxSwitch]`) – the container directive controlling the switch context.
//  * - `QueuexSwitchCase` (`*qxSwitchCase`) – defines conditional views based on case values.
//  * - `QueuexSwitchDefault` (`*qxSwitchDefault`) – defines the fallback view when no case matches.
//  *
//  * Compared to Angular’s `NgSwitch`, the Queuex version provides:
//  * - **Lazy view creation** using the concurrent scheduler from `ng-queuex/core`.
//  * - **Detachment from Angular’s logical tree** for each embedded view.
//  * - **Isolated reactive contexts** allowing direct signals in templates
//  *   to trigger independent, fine-grained change detection.
//  *
//  * @usageNotes
//  * Import `QueuexSwitchModule` into your feature module to make the directives available:
//  *
//  * ```ts
//  * @NgModule({
//  *   imports: [CommonModule, QueuexSwitchModule],
//  *   declarations: [MyComponent]
//  * })
//  * export class MyFeatureModule {}
//  * ```
//  *
//  * @example
//  * ```html
//  * <div [qxSwitch]="status">
//  *   <p *qxSwitchCase="'loading'">Loading...</p>
//  *   <p *qxSwitchCase="'success'">Loaded ✅</p>
//  *   <p *qxSwitchDefault>Unknown state 🤔</p>
//  * </div>
//  * ```
//  *
//  * @class
//  * @name QueuexSwitchModule
//  */
// @NgModule({
//   imports: imports,
//   exports: imports,
// })
// export class QueuexSwitchModule {}
function throwQxSwitchProviderNotFoundError(attrName, directiveName) {
    throw new Error(`An element with the "${attrName}" attribute ` +
        `(matching the "${directiveName}" directive) must be located inside an element with the "qxSwitch" attribute ` +
        `(matching "QueuexSwitch" directive)`);
}

/**
 * @Directive QueuexWatch
 *
 * `QueuexWatch` is a lightweight structural directive designed for highly efficient, fine-grained property bindings on DOM elements.
 * It is particularly suited for cases where only a small number of bindings are required (e.g. one or two element properties).
 *
 * Unlike traditional bindings, `QueuexWatch` immediately creates its embedded view, detaching it from Angular’s logical
 * tree and assigning it a dedicated reactive context. This design ensures that change detection runs independently from the host
 * component or Angular’s global cycles.
 *
 * Change detection is triggered as quickly as possible, using one of the following strategies depending on the current runtime state:
 * - `onTaskExecuted(listener: VoidFunction)` hook, if a Task is currently running,
 * - otherwise, a concurrent scheduler with the highest priority.
 *
 * This makes `QueuexWatch` ideal for scenarios where reactive signals are used in detached components (`ChangeDetectorRef#detach()`),
 * and where binding directly to element properties results in a more elegant and performant solution.
 *
 * @example
 * ```html
 * <!-- Detached component with reactive signals -->
 * <span *watch textContent="personName()"></span>
 *
 * <!-- Multiple properties can be bound if needed -->
 * <input
 *   *watch
 *   [value]="personName()"
 *   [title]="personAge() + ' years old'"
 * />
 * ```
 *
 * ### Server side fallback
 *
 * On the server side, QueuexWatch is fully transparent and falls back to standard Angular property bindings, ensuring predictable SSR output without any additional overhead.
 *
 */
class QueuexWatch {
    _viewRef = null;
    _watcher = null;
    _abortTask = null;
    _vcRef = inject(ViewContainerRef);
    _tmpRef = inject(TemplateRef);
    _destroyed = false;
    _scheduled = false;
    constructor() {
        assertNgQueuexIntegrated('[watch]: Assertion failed! "@ng-queuex/core" not provided.');
        if (isPlatformServer(inject(PLATFORM_ID))) {
            this._vcRef.createEmbeddedView(this._tmpRef);
        }
        else {
            this._watcher = createWatch(() => this._runEffect(), () => this._scheduleEffect(), false);
            this._watcher.notify();
            this._watcher.run();
        }
    }
    ngOnDestroy() {
        this._destroyed = true;
        this._abortTask?.();
        this._watcher?.destroy();
    }
    _runEffect() {
        if (!this._viewRef) {
            this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
            this._viewRef.detach();
        }
        detectChangesSync(this._viewRef);
        this._scheduled = false;
    }
    _scheduleEffect() {
        if (this._scheduled) {
            return;
        }
        this._scheduled = true;
        if (this._viewRef) {
            if (isInConcurrentTaskContext()) {
                if (this._destroyed) {
                    return;
                }
                onTaskExecuted(() => this._watcher.run());
            }
            else {
                this._abortTask = scheduleChangeDetection(() => this._watcher.run(), 1, this._viewRef);
            }
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexWatch, deps: [], target: i0.ɵɵFactoryTarget.Directive });
    static ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "20.1.0", type: QueuexWatch, isStandalone: true, selector: "ng-template[watch]", ngImport: i0 });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.1.0", ngImport: i0, type: QueuexWatch, decorators: [{
            type: Directive,
            args: [{ selector: 'ng-template[watch]', standalone: true }]
        }], ctorParameters: () => [] });

// const imports = [
//   QueuexIf,
//   QueuexForOf,
//   QueuexSwitch,
//   QueuexSwitchCase,
//   QueuexSwitchDefault,
//   QueuexReactiveView,
//   QueuexLazyView,
//   QueuexWatch
// ];
// @NgModule({
//   imports: imports,
//   exports: imports
// })
// export class QueuexTemplateModule {}

/**
 * Generated bundle index. Do not edit.
 */

export { QueuexForOf, QueuexIf, QueuexIfContext, QueuexLazyView, QueuexReactiveView, QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault, QueuexWatch, provideQueuexForOfDefaultPriority, provideQueuexIfDefaultPriority, provideQueuexReactiveViewDefaultPriority, provideQueuexSwitchDefaultPriority };
//# sourceMappingURL=ng-queuex-template.mjs.map
