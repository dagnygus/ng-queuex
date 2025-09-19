## Declaration
```ts
class QueuexIterableDiffers {
  find(iterable: any): QueuexIterableDifferFactory;
  static extend(factories: QueuexIterableDifferFactory[]): StaticProvider
}
```
### Description
A repository of different iterable diffing strategies.

### Methods

**find(iterable: any): QueuexIterableDifferFactory** - Searching for for the right strategy. If doesn't find then throws error

**static extend(factories: QueuexIterableDifferFactory[]): StaticProvider** - 
Takes an array of [QueuexIterableDifferFactory](./queuex_iterable_differ_factory.md) and returns a provider used to extend the inherited QueuexIterableDiffers instance with the provided factories and return a new QueuexIterableDiffers

The following example shows how to extend an existing list of factories, which will only be applied to the injector for this component and its children. This step is all that's required to make a new {@link QueuexIterableDiffer} available.

```ts
@Component({
  viewProviders: [
    QueuexIterableDiffers.extend([new ImmutableListDiffer()])
  ]
})
 ```

See also:
  - [QueuexIterableDiffer](./queuex_iterable_differ.md)
  - [QueuexIterableDifferFactory](./queuex_iterable_differ_factory.md)
  - [QueuexIterableChanges](./queuex_iterable_changes.md)
  - [QueuexIterableChangeOperationHandler](./queuex_iterable_change_operation_handler.md)
  - [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
  - [AddedIterableChangeRecord](./addend_iterable_change_record.md)
  - [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
