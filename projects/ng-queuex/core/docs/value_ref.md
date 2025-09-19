## Declaration
```ts
interface ValueRef<T> {
  readonly value: T;
  set(value: T | Signal<T>): void
}
```
Represents reference to value directly provided by `set` method or
to the most recent value of provided signal. In case of signal, it allows safely
access to recent value in notification faze without touching internal signal node.

### Properties
**<span style="color: blue">readonly</span> value** - The underlying value.
### Methods
**set(value: T | Signal<T>): void** - Updates the value. If plain value is provided, directly sets the underlying value. If signal is provided, reference will fallow that signal. **Param:** value - A new value or signal to observe and extracts values in synchronic way.

See also [value()](./value.md)
