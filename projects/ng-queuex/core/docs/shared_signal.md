## Declaration
```ts
function sharedSignal<T>(initialValue: T | Signal<T>, debugName?: string): SharedSignalRef<T>
```
### Description
Creates a shared signal reference.

A shared signal allows you to either wrap a plain value into a signal
or forward another signal reference. The returned object provides
access to the underlying signal (`ref`) and a `set` method for updating
its value or re-linking it to a different signal.

**Params:**
  - initialValue - The initial value of the signal, or another signal to bind.
  - debugName (optional) - Optional developer-friendly label for debugging purposes.

**Returns:** A [SharedSignalRef](./shared_signal_ref) object containing the signal reference and mutation API.
