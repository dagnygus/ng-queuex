```ts
type StillPresentIterableChangeRecord<T> = IterableChangeRecord<T> & { readonly previousIndex: number; readonly currentIndex: number };
```
See also:
- [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
- [AddedIterableChangeRecord](./added_iterable_change_record.md)
