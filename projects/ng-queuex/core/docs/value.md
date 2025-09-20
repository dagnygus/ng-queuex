## Overloads
```ts
function value<T>(initialValue: T | Signal<T>): ValueRef<T>;
function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef): ValueRef<T>;
function value<T>(initialValue: T | Signal<T>, debugName: string | undefined): ValueRef<T>;
function value<T>(initialValue: T | Signal<T>, destroyRef: DestroyRef, debugName: string | undefined): ValueRef<T>;
```

### Description
Creates a value reference.

A `ValueRef` is a lightweight wrapper that always exposes
the most recent value of either:
  - a plain value of type `T`, or
   - a reactive `Signal<T>`.

Unlike reading a signal directly, accessing `.value` on a `ValueRef`
is always safe — even during the signal notification phase, when
normal signal reads are disallowed. The reference never touches
the internal signal node and does not participate in dependency tracking.

The `set()` method does not update the underlying signal. Instead,
it rebinds the `ValueRef` to a new value or to another signal.

**Params:**
  - initialValue - The initial value or signal to bind.
  - destroyRef (optional) - The object that implements `DestroyRef` abstract class.
  - debugName - Optional developer-friendly label for debugging purposes.
**Throws:** Error if is used in reactive context and if is not in reactive context when destroyRef is not provided.<br>
**Returns:** A [ValueRef](./value_ref.md) object.
