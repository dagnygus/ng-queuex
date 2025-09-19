# QueuexForOf<span style="color: purple">\<T = unknown, U extends NgIterable<T> = NgIterable<T>></span> class

## Selector `'ng-template[qxFor]'`

## Description
This directive serves as a modern, high-performance replacement for Angular’s built-in `NgForOf` **(restricted to immutable objects)**. It leverages a concurrent scheduling mechanism to transform immutable data collections into fully synchronized UI views while seamlessly managing local change detection within embedded views. Unlike traditional approaches, every signal change read directly in the template automatically triggers its own localized change detection cycle.

What makes this unique is that these updates are completely independent — they do not rely on the host component’s change detection, nor are they tied to Angular’s global change detection cycles. Instead, each embedded view is deliberately detached from the logical tree and operates within its own dedicated reactive context. This architecture not only improves rendering efficiency and responsiveness but also empowers developers to build highly dynamic, scalable interfaces that remain smooth and predictable, even under heavy data or interaction loads.

In addition, the directive introduces a streamlined approach to configuring `trackBy`, making it both easier to use and more powerful thanks to advanced autocompletion support. Instead of writing verbose functions, developers can simply reference built-in identifiers such as `index` or `item`, or directly target object properties using the `item.` prefix. For instance, given a `Person { id: number; name: string; age: number }` interface, the `trackBy` input can be set to `index`, item, or `item.id`. This not only reduces boilerplate code but also improves developer productivity by offering intelligent suggestions right inside the editor.

## Server side fallback
On the server side, the directive behaves just like Angular’s native NgForOf. The advanced features designed for client-side rendering — such as concurrent scheduling, localized change detection, and reactive embedded contexts — are not only unnecessary during server-side rendering but could even introduce unwanted overhead. By falling back to the simpler NgForOf behavior, the directive ensures optimal performance in SSR scenarios, producing clean, predictable HTML output without sacrificing rendering speed or efficiency.

## Overriding default priority
To override default priority for `*qxFor`, use `provideQueuexForOfDefaultPriority()` in providers array. 

## Inputs

**<span style="color: seaGreen">@Input(</span>{ required: <span style="color: blue">true</span> }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxForOf(data: <span style="color: purple">QueuexForOfInput<T, U> | Signal\<QueuexForOfInput<T, U>></span>)**
  - A collection of data for display.
```ts
type QueuexForOfInput<T, U extends NgIterable<T> = NgIterable<T>> = U & NgIterable<T> | null | undefined;
```

**<span style="color: seaGreen">@Input(</span>{ transform: advancePriorityInputTransform }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxIfPriority(priority: <span style="color: purple"> PriorityLevel | Signal\<PriorityLevel></span>)**
  - A priority for concurrent scheduler to manage views. It can be set as numeric value (1-5) or as string literal with valid options: `'highest' | 'high' | 'normal' | 'low' | 'lowest'`. Default is normal (3). This input also accepts the signal of the previously mentioned values.

**<span style="color: seaGreen">@Input(</span>{ required: <span style="color: blue">true</span> }<span style="color: seaGreen">)</span><br>
<span style="color: blue">set</span> qxForOfTrackBy(trackBy: <span style="color: purple">TrackBy</span>)**
  - A strategy for tracking changes in collection what can improve user experience.  When items are added, moved, or removed in the iterable, the directive must re-render the appropriate DOM nodes. To minimize churn in the DOM, only nodes that have changed are re-rendered. If is set to `index`, each item will be compared by index position. If is set to item, each item will be compared by strick equality (===). If item contains a uniq identifier (e.g `{ id: string }`), it is preferred to use that for comparison by setting `trackBy: 'item.id'`.
  **Throws** error if invalid string value is provided.

```ts
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

type TrackBy<T> = T extends object ? 'index' | 'item' | PrefixedKeys<T> : 'index' | 'item'
```

**<span style="color: seaGreen">@Input()</span><br>
qxForOfRenderCallback: ((arg: <span style="color: purple">U</span><span style="color: blue">) => void </span>) | <span style="color: blue">null</span>**
  - A callback what will be called when at least one of the template gets created, removed or moved. This enables developers to perform actions when rendering has been done. The `qxForOfRenderCallback` is useful in situations where you rely on specific DOM properties like the dimensions of an item after it got rendered. The `qxForOfRenderCallback` emits the latest value causing the view to update.

## Context variables
```ts
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
```
