import { Signal } from "@angular/core";
import { SignalOperatorFunction } from "../../common";
import { exhaustMap } from "../exhaust_map/exhaust_map";

export function exhaustAll<T, U extends Signal<T> | undefined = Signal<T> | undefined>(): SignalOperatorFunction<U, undefined extends U ? T | undefined : T> {
  return exhaustMap<U, T>((s) => s)
}
