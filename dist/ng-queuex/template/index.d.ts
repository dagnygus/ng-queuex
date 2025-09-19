import * as i0 from '@angular/core';
import { NgIterable, OnInit, OnDestroy, Signal, ValueProvider, TemplateRef, OnChanges, AfterContentChecked, SimpleChanges, DoCheck } from '@angular/core';
import * as i1 from '@ng-queuex/core';
import { PriorityLevel, PriorityName } from '@ng-queuex/core';

type Num = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Flatten<T> = T extends infer U ? U : never;
type KeysToUse<T> = T extends Function ? Exclude<keyof T, 'prototype' | 'arguments'> : Exclude<keyof T, 'prototype'>;
type PrefixedKeys<T, Prefix extends string = "item", Seen = never> = T extends (infer U)[] ? `${Prefix}.${Num}` | PrefixedKeys<U, `${Prefix}.${Num}`, Seen> : Flatten<{
    [K in KeysToUse<T>]: T[K] extends (infer U)[] ? `${Prefix}.${Extract<K, string>}` | `${Prefix}.${Extract<K, string>}.${Num}` | PrefixedKeys<U, `${Prefix}.${Extract<K, string>}.${Num}`, Seen> : T[K] extends Record<string, any> ? T[K] extends Seen ? `${Prefix}.${Extract<K, string>}` : `${Prefix}.${Extract<K, string>}` | PrefixedKeys<T[K], `${Prefix}.${Extract<K, string>}`, Seen | T[K]> : `${Prefix}.${Extract<K, string>}`;
}[KeysToUse<T>]>;
type TrackBy<T> = T extends object ? 'index' | 'item' | PrefixedKeys<T> : 'index' | 'item';
type QueuexForOfInput<T, U extends NgIterable<T> = NgIterable<T>> = U & NgIterable<T> | null | undefined;
/**
 * @description
 * Provides an override for `QueuexForOf` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
declare function provideQueuexForOfDefaultPriority(priority: PriorityName): ValueProvider;
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
declare class QueuexForOf<T, U extends NgIterable<T> = NgIterable<T>> implements OnInit, OnDestroy {
    private _trackBy;
    private _itemPropPath;
    private _view;
    private _dataSource;
    private _priorityRef;
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set qxForPriority(priority: PriorityLevel | Signal<PriorityLevel>);
    /**
     * A collection of data for display.
     */
    set qxForOf(data: QueuexForOfInput<T, U> | Signal<QueuexForOfInput<T, U>>);
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
    set qxForTrackBy(trackBy: TrackBy<T>);
    /**
     * A callback what will be called when at least one of the template gets created, removed or moved. This enables developers to perform actions when rendering has been done.
     * The `qxForRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `qxForRenderCallback` emits the latest value causing the view to update.
     */
    qxForRenderCallback: ((data: QueuexForOfInput<T, U>) => void) | null;
    constructor();
    /**
     * @internal
     */
    ngOnInit(): void;
    /**
     * @internal
     */
    ngOnDestroy(): void;
    static ngTemplateContextGuard<T, U extends NgIterable<T>>(dir: QueuexForOf<T, U>, ctx: any): ctx is QueuexForOfContext<T, U>;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexForOf<any, any>, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexForOf<any, any>, "ng-template[qxFor]", never, { "qxForPriority": { "alias": "qxForPriority"; "required": false; }; "qxForOf": { "alias": "qxForOf"; "required": true; }; "qxForTrackBy": { "alias": "qxForTrackBy"; "required": true; }; "qxForRenderCallback": { "alias": "qxForRenderCallback"; "required": false; }; }, {}, never, never, true, never>;
    static ngAcceptInputType_qxForPriority: i1.PriorityInput | i0.Signal<i1.PriorityInput>;
}
interface QueuexForOfContext<T, U extends NgIterable<T> = NgIterable<T>> {
    readonly $implicit: Signal<T>;
    readonly qxForOf: Signal<QueuexForOfInput<T, U>>;
    readonly index: Signal<number>;
    readonly count: Signal<number>;
    readonly first: Signal<boolean>;
    readonly last: Signal<boolean>;
    readonly even: Signal<boolean>;
    readonly odd: Signal<boolean>;
}

/**
 * @description
 * Provides an override for `QueuexIf` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
declare function provideQueuexIfDefaultPriority(priority: PriorityName): ValueProvider;
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
declare class QueuexIf<T = unknown> implements OnInit, OnDestroy {
    private _view;
    private _defaultThenTemplate;
    private _conditionSource;
    private _thenTmpRefSource;
    private _elseTmpRefSource;
    private _priorityRef;
    /**
     * A callback what will be called when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
     * The `qxIfRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `qxIfRenderCallback` emits the latest value causing the view to update.
     */
    qxIfRenderCallback: ((arg: T) => void) | null;
    /**
     * The value to evaluate as the condition for showing a template.
     */
    set qxIf(condition: T | Signal<T>);
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set qxIfPriority(priorityLevel: PriorityLevel | Signal<PriorityLevel>);
    /**
     * A template to show if the condition evaluates to be truthy.
     */
    set qxIfThen(thenTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined);
    /**
     * A template to show if the condition evaluates to be falsy.
     */
    set qxIfElse(elseTmpRef: TemplateRef<QueuexIfContext<T>> | Signal<TemplateRef<QueuexIfContext<T>>> | null | undefined);
    constructor();
    /**
     * @internal
     */
    ngOnInit(): void;
    /**
     * @internal
     */
    ngOnDestroy(): void;
    /**
     * Assert the correct type of the expression bound to the `qxIf` input within the template.
     *
     * The presence of this static field is a signal to the Ivy template type check compiler that
     * when the `QueuexIf` structural directive renders its template, the type of the expression bound
     * to `qxIf` should be narrowed in some way. For `QueuexIf`, the binding expression itself is used to
     * narrow its type, which allows the strictNullChecks feature of TypeScript to work with `QueuexIf`.
     */
    static ngTemplateGuard_qxIf: 'binding';
    static ngTemplateContextGuard<T>(dir: QueuexIf<T>, ctx: any): ctx is QueuexIfContext<Exclude<T, false | 0 | '' | null | undefined>>;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexIf<any>, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexIf<any>, "ng-template[qxIf]", never, { "qxIfRenderCallback": { "alias": "qxIfRenderCallback"; "required": false; }; "qxIf": { "alias": "qxIf"; "required": true; }; "qxIfPriority": { "alias": "qxIfPriority"; "required": false; }; "qxIfThen": { "alias": "qxIfThen"; "required": false; }; "qxIfElse": { "alias": "qxIfElse"; "required": false; }; }, {}, never, never, true, never>;
    static ngAcceptInputType_qxIfPriority: i1.PriorityInput | i0.Signal<i1.PriorityInput>;
}
declare class QueuexIfContext<T = unknown> {
    $implicit: Signal<T>;
    qxIf: Signal<T>;
    constructor(valueSource: Signal<T>);
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
declare class QueuexLazyView implements OnInit, OnDestroy {
    private _abortTask;
    private _renderCbAbortTask;
    private _vcRef;
    private _tmpRef;
    private _isServer;
    /**
     * A priority for concurrent scheduler to create view. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     */
    priority: PriorityLevel;
    /**
     * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
     * The `lazyViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `lazyViewRenderCallback` emits the latest value causing the view to update.
     */
    lazyViewRenderCallback: (() => void) | null;
    constructor();
    ngOnInit(): void;
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexLazyView, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexLazyView, "ng-template[lazyView]", never, { "priority": { "alias": "lazyView"; "required": false; }; "lazyViewRenderCallback": { "alias": "lazyViewRenderCallback"; "required": false; }; }, {}, never, never, true, never>;
    static ngAcceptInputType_priority: i1.PriorityInput;
}

/**
 * @description
 * Provides an override for `QueuexReactiveView` default priority.
 *
 * @param priority Valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`
 * @returns A value provider
 */
declare function provideQueuexReactiveViewDefaultPriority(priority: PriorityName): ValueProvider;
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
declare class QueuexReactiveView implements OnInit, OnDestroy {
    private _tmpRef;
    private _vcRef;
    private _watcher;
    private _viewRef;
    private _scheduled;
    private _abortTask;
    private _renderCbAbortTask;
    private _isServer;
    private _priorityRef;
    /**
     * A priority for concurrent scheduler to manage view. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values.
     */
    set priority(value: PriorityLevel | Signal<PriorityLevel>);
    /**
     * A callback what will be called after view creation. This enables developers to perform actions when rendering has been done.
     * The `reactiveViewRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `reactiveViewRenderCallback` emits the latest value causing the view to update.
     */
    reactiveViewRenderCallback: (() => void) | null;
    constructor();
    ngOnInit(): void;
    private _effectCallback;
    private _scheduleEffectCallback;
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexReactiveView, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexReactiveView, "ng-template[reactiveView]", never, { "priority": { "alias": "reactiveView"; "required": false; }; "reactiveViewRenderCallback": { "alias": "reactiveViewRenderCallback"; "required": false; }; }, {}, never, never, true, never>;
    static ngAcceptInputType_priority: i1.PriorityInput | i0.Signal<i1.PriorityInput>;
}

declare function provideQueuexSwitchDefaultPriority(priority: PriorityName): ValueProvider;
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
declare class QueuexSwitch implements OnChanges, OnInit, AfterContentChecked, OnDestroy {
    private _priorityRef;
    private _switchSource;
    private _view;
    private _cdRef;
    /**
     * A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as
     * string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3).
     *
     * This input also accepts the signal of the previously mentioned values
     */
    set priority(priority: PriorityLevel | Signal<PriorityLevel>);
    set qxSwitch(value: any | Signal<any>);
    /**
     * A output what will be emitted when at least one of the template gets created or removed. This enables developers to perform actions when rendering has been done.
     * The `render` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered.
     *
     * The `render` emits the latest value causing the view to update.
     */
    render: i0.OutputEmitterRef<any>;
    constructor();
    /**
     * @internal
     */
    ngOnChanges(changes: SimpleChanges): void;
    /**
     * @internal
     */
    ngOnInit(): void;
    /**
     * @internal
     */
    ngAfterContentChecked(): void;
    /**
     * @internal
     */
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexSwitch, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexSwitch, "[qxSwitch]:not(ng-template)", never, { "priority": { "alias": "priority"; "required": false; }; "qxSwitch": { "alias": "qxSwitch"; "required": true; }; }, { "render": "render"; }, never, never, true, never>;
    static ngAcceptInputType_priority: i1.PriorityInput | i0.Signal<i1.PriorityInput>;
}
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
declare class QueuexSwitchCase implements OnChanges, DoCheck, AfterContentChecked, OnDestroy {
    private _caseSource;
    private _caseView;
    set qxSwitchCase(value: any | Signal<any>);
    constructor();
    /**
     * @internal
     */
    ngOnChanges(changes: SimpleChanges): void;
    /**
     * @internal
     */
    ngDoCheck(): void;
    /**
     * @internal
     */
    ngAfterContentChecked(): void;
    /**
     * @internal
     */
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexSwitchCase, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexSwitchCase, "ng-template[qxSwitchCase]", never, { "qxSwitchCase": { "alias": "qxSwitchCase"; "required": true; }; }, {}, never, never, true, never>;
}
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
declare class QueuexSwitchDefault implements OnDestroy {
    private _view;
    constructor();
    /**
     * @internal
     */
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexSwitchDefault, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexSwitchDefault, "ng-template[qxSwitchDefault]", never, {}, {}, never, never, true, never>;
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
declare class QueuexWatch implements OnDestroy {
    private _viewRef;
    private _watcher;
    private _abortTask;
    private _vcRef;
    private _tmpRef;
    private _destroyed;
    private _scheduled;
    constructor();
    ngOnDestroy(): void;
    private _runEffect;
    private _scheduleEffect;
    static ɵfac: i0.ɵɵFactoryDeclaration<QueuexWatch, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<QueuexWatch, "ng-template[watch]", never, {}, {}, never, never, true, never>;
}

export { QueuexForOf, QueuexIf, QueuexIfContext, QueuexLazyView, QueuexReactiveView, QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault, QueuexWatch, provideQueuexForOfDefaultPriority, provideQueuexIfDefaultPriority, provideQueuexReactiveViewDefaultPriority, provideQueuexSwitchDefaultPriority };
export type { Flatten, KeysToUse, Num, PrefixedKeys, QueuexForOfContext, QueuexForOfInput, TrackBy };
