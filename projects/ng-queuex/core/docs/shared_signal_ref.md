## Declaration
```ts
interface SharedSignalRef<T> {
  readonly ref: Signal<T>
  set<T>(value: T | Signal<T>): void
}
```
 Represents a reference to a shared signal.

Provides access to the underlying signal (`ref`)
and a method (`set`) to update its value directly or
by linking it to another signal.

### Properties
**<span style="color: blue">readonly</span> ref: Signal\<T>** - The underlying signal reference.
### Methods
**set<T>(value: T | Signal<T>)** - Updates the signal value.
If a plain value is provided, the signal is set directly.
If another signal is provided, the reference will follow that signal.

See also [sharedSignal()](./shared_signal.md).
