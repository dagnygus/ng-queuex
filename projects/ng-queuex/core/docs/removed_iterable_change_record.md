```ts
type RemovedIterableChangeRecord<T> = IterableChangeRecord<T> & { readonly previousIndex: number; readonly currentIndex: null };
```
See also:
- [AddedIterableChangeRecord](./addend_iterable_change_record.md)
- [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
