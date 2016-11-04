// Extended type definitions for Sugar v2.0.2
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

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
  isArray(instance: Object): boolean;
  isBoolean(instance: Object): boolean;
  isDate(instance: Object): boolean;
  isEmpty(instance: Object): boolean;
  isEqual(instance: Object, obj: Object): boolean;
  isError(instance: Object): boolean;
  isFunction(instance: Object): boolean;
  isMap(instance: Object): boolean;
  isNumber(instance: Object): boolean;
  isObject(instance: Object): boolean;
  isRegExp(instance: Object): boolean;
  isSet(instance: Object): boolean;
  isString(instance: Object): boolean;
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