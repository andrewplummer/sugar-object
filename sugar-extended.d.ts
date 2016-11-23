// Extended type definitions for Sugar v2.0.3
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

// <reference path="sugar.d.ts" />

interface ObjectConstructor {
  fromQueryString<T, U>(str: string, options?: sugarjs.Object.QueryStringParseOptions): Object;
  add(instance: Object, obj: Object, options?: sugarjs.Object.ObjectMergeOptions): Object;
  addAll(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions): Object;
  clone(instance: Object, deep?: boolean): Object;
  defaults(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions): Object;
  exclude<T>(instance: Object, search: T|sugarjs.Object.searchFn): Object;
  get<T>(instance: Object, key: string, inherited?: boolean): T;
  has(instance: Object, key: string, inherited?: boolean): boolean;
  intersect(instance: Object, obj: Object): Object;
  invert(instance: Object, multi?: boolean): Object;
  isArguments(instance: Object): boolean;
  isArray<T>(instance: Object): instance is Array<T>;
  isBoolean(instance: Object): instance is boolean;
  isDate(instance: Object): instance is Date;
  isEmpty(instance: Object): boolean;
  isEqual(instance: Object, obj: Object): boolean;
  isError(instance: Object): instance is Error;
  isFunction(instance: Object): instance is Function;
  isMap<K, V>(instance: Object): instance is Map<K,V>;
  isNumber(instance: Object): instance is number;
  isObject(instance: Object): boolean;
  isRegExp(instance: Object): instance is RegExp;
  isSet<T>(instance: Object): instance is Set<T>;
  isString(instance: Object): instance is string;
  keys<T>(instance: Object): T[];
  merge<T>(instance: Object, source: Object, options?: sugarjs.Object.ObjectMergeOptions): Object;
  mergeAll(instance: Object, sources: Array<Object>, options?: sugarjs.Object.ObjectMergeOptions): Object;
  reject(instance: Object, find: string|RegExp|Array<string>|Object): Object;
  remove<T>(instance: Object, search: T|sugarjs.Object.searchFn): Object;
  select(instance: Object, find: string|RegExp|Array<string>|Object): Object;
  set<T>(instance: Object, key: string, val: T): Object;
  size(instance: Object): number;
  subtract(instance: Object, obj: Object): Object;
  tap(instance: Object, fn: (obj: Object) => any): Object;
  toQueryString<T, U>(instance: Object, options?: sugarjs.Object.QueryStringOptions): Object;
  values<T>(instance: Object): T[];
}