// Type definitions for Sugar v2.0.4
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

declare namespace sugarjs {

  type SugarDefaultChainable<RawValue> = Array.Chainable<any, RawValue> &
                                         Date.Chainable<RawValue> &
                                         Function.Chainable<RawValue> &
                                         Number.Chainable<RawValue> &
                                         Object.Chainable<RawValue> &
                                         RegExp.Chainable<RawValue> &
                                         String.Chainable<RawValue>;

  type NativeConstructor = ArrayConstructor |
                           DateConstructor |
                           FunctionConstructor |
                           NumberConstructor |
                           ObjectConstructor |
                           RegExpConstructor |
                           StringConstructor |
                           BooleanConstructor |
                           ErrorConstructor;

  interface ExtendOptions {
    methods?: Array<string>;
    except?: Array<string|NativeConstructor>;
    namespaces?: Array<NativeConstructor>;
    enhance?: boolean;
    enhanceString?: boolean;
    enhanceArray?: boolean;
    objectPrototype?: boolean;
  }

  interface Sugar {
    (opts?: ExtendOptions): Sugar;
    createNamespace(name: string): SugarNamespace;
    extend(opts?: ExtendOptions): Sugar;
    Array: Array.Constructor;
    Date: Date.Constructor;
    Function: Function.Constructor;
    Number: Number.Constructor;
    Object: Object.Constructor;
    RegExp: RegExp.Constructor;
    String: String.Constructor;
  }

  interface SugarNamespace {
    alias(toName: string, from: string|Function): this;
    alias(toName: string, fn: undefined): this;
    defineInstance(methods: Object): this;
    defineInstance(methodName: string, methodFn: Function): this;
    defineInstanceAndStatic(methods: Object): this;
    defineInstanceAndStatic(methodName: string, methodFn: Function): this;
    defineInstancePolyfill(methods: Object): this;
    defineInstancePolyfill(methodName: string, methodFn: Function): this;
    defineInstanceWithArguments(methods: Object): this;
    defineInstanceWithArguments(methodName: string, methodFn: Function): this;
    defineStatic(methods: Object): this;
    defineStatic(methodName: string, methodFn: Function): this;
    defineStaticPolyfill(methods: Object): this;
    defineStaticPolyfill(methodName: string, methodFn: Function): this;
    defineStaticWithArguments(methods: Object): this;
    defineStaticWithArguments(methodName: string, methodFn: Function): this;
    extend(opts?: ExtendOptions): this;
  }

  namespace Array {

    type Chainable<T, RawValue> = ChainableBase<T, RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<T, RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      concat(...items: (T | T[])[]): SugarDefaultChainable<T[]>;
      concat(...items: T[][]): SugarDefaultChainable<T[]>;
      copyWithin(target: number, start: number, end?: number): SugarDefaultChainable<this>;
      every(callbackfn: (value: T, index: number, array: T[]) => boolean, thisArg?: any): SugarDefaultChainable<boolean>;
      fill(value: T, start?: number, end?: number): SugarDefaultChainable<this>;
      filter(callbackfn: (value: T, index: number, array: T[]) => any, thisArg?: any): SugarDefaultChainable<T[]>;
      find(predicate: (value: T, index: number, obj: Array<T>) => boolean, thisArg?: any): SugarDefaultChainable<T | undefined>;
      findIndex(predicate: (value: T, index: number, obj: Array<T>) => boolean, thisArg?: any): SugarDefaultChainable<number>;
      forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): SugarDefaultChainable<void>;
      indexOf(searchElement: T, fromIndex?: number): SugarDefaultChainable<number>;
      join(separator?: string): SugarDefaultChainable<string>;
      lastIndexOf(searchElement: T, fromIndex?: number): SugarDefaultChainable<number>;
      map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): SugarDefaultChainable<U[]>;
      pop(): SugarDefaultChainable<T | undefined>;
      push(...items: T[]): SugarDefaultChainable<number>;
      reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): SugarDefaultChainable<T>;
      reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): SugarDefaultChainable<U>;
      reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): SugarDefaultChainable<T>;
      reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): SugarDefaultChainable<U>;
      reverse(): SugarDefaultChainable<T[]>;
      shift(): SugarDefaultChainable<T | undefined>;
      slice(start?: number, end?: number): SugarDefaultChainable<T[]>;
      some(callbackfn: (value: T, index: number, array: T[]) => boolean, thisArg?: any): SugarDefaultChainable<boolean>;
      sort(compareFn?: (a: T, b: T) => number): SugarDefaultChainable<this>;
      splice(start: number): SugarDefaultChainable<T[]>;
      splice(start: number, deleteCount: number, ...items: T[]): SugarDefaultChainable<T[]>;
      toLocaleString(): SugarDefaultChainable<string>;
      unshift(...items: T[]): SugarDefaultChainable<number>;
    }

  }

  namespace Date {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      getDate(): SugarDefaultChainable<number>;
      getDay(): SugarDefaultChainable<number>;
      getFullYear(): SugarDefaultChainable<number>;
      getHours(): SugarDefaultChainable<number>;
      getMilliseconds(): SugarDefaultChainable<number>;
      getMinutes(): SugarDefaultChainable<number>;
      getMonth(): SugarDefaultChainable<number>;
      getSeconds(): SugarDefaultChainable<number>;
      getTime(): SugarDefaultChainable<number>;
      getTimezoneOffset(): SugarDefaultChainable<number>;
      getUTCDate(): SugarDefaultChainable<number>;
      getUTCDay(): SugarDefaultChainable<number>;
      getUTCFullYear(): SugarDefaultChainable<number>;
      getUTCHours(): SugarDefaultChainable<number>;
      getUTCMilliseconds(): SugarDefaultChainable<number>;
      getUTCMinutes(): SugarDefaultChainable<number>;
      getUTCMonth(): SugarDefaultChainable<number>;
      getUTCSeconds(): SugarDefaultChainable<number>;
      setDate(date: number): SugarDefaultChainable<number>;
      setFullYear(year: number, month?: number, date?: number): SugarDefaultChainable<number>;
      setHours(hours: number, min?: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setMilliseconds(ms: number): SugarDefaultChainable<number>;
      setMinutes(min: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setMonth(month: number, date?: number): SugarDefaultChainable<number>;
      setSeconds(sec: number, ms?: number): SugarDefaultChainable<number>;
      setTime(time: number): SugarDefaultChainable<number>;
      setUTCDate(date: number): SugarDefaultChainable<number>;
      setUTCFullYear(year: number, month?: number, date?: number): SugarDefaultChainable<number>;
      setUTCHours(hours: number, min?: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setUTCMilliseconds(ms: number): SugarDefaultChainable<number>;
      setUTCMinutes(min: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setUTCMonth(month: number, date?: number): SugarDefaultChainable<number>;
      setUTCSeconds(sec: number, ms?: number): SugarDefaultChainable<number>;
      toDateString(): SugarDefaultChainable<string>;
      toISOString(): SugarDefaultChainable<string>;
      toJSON(key?: any): SugarDefaultChainable<string>;
      toLocaleDateString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toLocaleDateString(): SugarDefaultChainable<string>;
      toLocaleString(): SugarDefaultChainable<string>;
      toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toLocaleTimeString(): SugarDefaultChainable<string>;
      toLocaleTimeString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toTimeString(): SugarDefaultChainable<string>;
      toUTCString(): SugarDefaultChainable<string>;
    }

  }

  namespace Function {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      apply(thisArg: any, argArray?: any): SugarDefaultChainable<any>;
      bind(thisArg: any, ...argArray: any[]): SugarDefaultChainable<any>;
      call(thisArg: any, ...argArray: any[]): SugarDefaultChainable<any>;
    }

  }

  namespace Number {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      toExponential(fractionDigits?: number): SugarDefaultChainable<string>;
      toFixed(fractionDigits?: number): SugarDefaultChainable<string>;
      toLocaleString(locales?: string | string[], options?: Intl.NumberFormatOptions): SugarDefaultChainable<string>;
      toPrecision(precision?: number): SugarDefaultChainable<string>;
    }

  }

  namespace Object {

    type Chainable<RawValue> = ChainableBase<RawValue>;
    type resolveFn = <T>(key: string, targetVal: T, sourceVal: T, target: Object, source: Object) => boolean;
    type searchFn = <T>(key: string, val: T, obj: Object) => boolean;

    interface Constructor extends SugarNamespace {
      (raw?: Object): Chainable<Object>;
      new(raw?: Object): Chainable<Object>;
      fromQueryString(str: string, options?: QueryStringParseOptions): Object;
      add(instance: Object, obj: Object, options?: ObjectMergeOptions): Object;
      addAll(instance: Object, sources: Array<Object>, options?: ObjectMergeOptions): Object;
      clone(instance: Object, deep?: boolean): Object;
      defaults(instance: Object, sources: Array<Object>, options?: ObjectMergeOptions): Object;
      exclude<T>(instance: Object, search: T|searchFn): Object;
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
      merge(instance: Object, source: Object, options?: ObjectMergeOptions): Object;
      mergeAll(instance: Object, sources: Array<Object>, options?: ObjectMergeOptions): Object;
      reject(instance: Object, find: string|RegExp|Array<string>|Object): Object;
      remove<T>(instance: Object, search: T|searchFn): Object;
      select(instance: Object, find: string|RegExp|Array<string>|Object): Object;
      set<T>(instance: Object, key: string, val: T): Object;
      size(instance: Object): number;
      subtract(instance: Object, obj: Object): Object;
      tap(instance: Object, fn: (obj: Object) => any): Object;
      toQueryString(instance: Object, options?: QueryStringOptions): Object;
      values<T>(instance: Object): T[];
    }

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      add(obj: Object, options?: ObjectMergeOptions): SugarDefaultChainable<Object>;
      addAll(sources: Array<Object>, options?: ObjectMergeOptions): SugarDefaultChainable<Object>;
      clone(deep?: boolean): SugarDefaultChainable<Object>;
      defaults(sources: Array<Object>, options?: ObjectMergeOptions): SugarDefaultChainable<Object>;
      exclude<T>(search: T|searchFn): SugarDefaultChainable<Object>;
      get<T>(key: string, inherited?: boolean): SugarDefaultChainable<T>;
      has(key: string, inherited?: boolean): SugarDefaultChainable<boolean>;
      intersect(obj: Object): SugarDefaultChainable<Object>;
      invert(multi?: boolean): SugarDefaultChainable<Object>;
      isArguments(): SugarDefaultChainable<boolean>;
      isArray(): SugarDefaultChainable<boolean>;
      isBoolean(): SugarDefaultChainable<boolean>;
      isDate(): SugarDefaultChainable<boolean>;
      isEmpty(): SugarDefaultChainable<boolean>;
      isEqual(obj: Object): SugarDefaultChainable<boolean>;
      isError(): SugarDefaultChainable<boolean>;
      isFunction(): SugarDefaultChainable<boolean>;
      isMap(): SugarDefaultChainable<boolean>;
      isNumber(): SugarDefaultChainable<boolean>;
      isObject(): SugarDefaultChainable<boolean>;
      isRegExp(): SugarDefaultChainable<boolean>;
      isSet(): SugarDefaultChainable<boolean>;
      isString(): SugarDefaultChainable<boolean>;
      keys<T>(): SugarDefaultChainable<T[]>;
      merge(source: Object, options?: ObjectMergeOptions): SugarDefaultChainable<Object>;
      mergeAll(sources: Array<Object>, options?: ObjectMergeOptions): SugarDefaultChainable<Object>;
      reject(find: string|RegExp|Array<string>|Object): SugarDefaultChainable<Object>;
      remove<T>(search: T|searchFn): SugarDefaultChainable<Object>;
      select(find: string|RegExp|Array<string>|Object): SugarDefaultChainable<Object>;
      set<T>(key: string, val: T): SugarDefaultChainable<Object>;
      size(): SugarDefaultChainable<number>;
      subtract(obj: Object): SugarDefaultChainable<Object>;
      tap(fn: (obj: Object) => SugarDefaultChainable<any>): SugarDefaultChainable<Object>;
      toQueryString(options?: QueryStringOptions): SugarDefaultChainable<Object>;
      values<T>(): SugarDefaultChainable<T[]>;
    }

    interface QueryStringParseOptions {
      deep?: boolean;
      auto?: boolean;
      transform?: <T, U>(key: string, val: T, obj: Object) => U;
      separator?: string;
    }

    interface QueryStringOptions {
      deep?: boolean;
      prefix?: string;
      transform?: <T, U>(key: string, val: T, obj: Object) => U;
      separator?: string;
    }

    interface ObjectMergeOptions {
      deep?: boolean;
      hidden?: boolean;
      descriptor?: boolean;
      resolve?: boolean|resolveFn;
    }

  }

  namespace RegExp {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      exec(string: string): SugarDefaultChainable<RegExpExecArray | null>;
      test(string: string): SugarDefaultChainable<boolean>;
    }

  }

  namespace String {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      anchor(name: string): SugarDefaultChainable<string>;
      big(): SugarDefaultChainable<string>;
      blink(): SugarDefaultChainable<string>;
      bold(): SugarDefaultChainable<string>;
      charAt(pos: number): SugarDefaultChainable<string>;
      charCodeAt(index: number): SugarDefaultChainable<number>;
      codePointAt(pos: number): SugarDefaultChainable<number | undefined>;
      concat(...strings: string[]): SugarDefaultChainable<string>;
      endsWith(searchString: string, endPosition?: number): SugarDefaultChainable<boolean>;
      fixed(): SugarDefaultChainable<string>;
      fontcolor(color: string): SugarDefaultChainable<string>;
      fontsize(size: number): SugarDefaultChainable<string>;
      fontsize(size: string): SugarDefaultChainable<string>;
      includes(searchString: string, position?: number): SugarDefaultChainable<boolean>;
      indexOf(searchString: string, position?: number): SugarDefaultChainable<number>;
      italics(): SugarDefaultChainable<string>;
      lastIndexOf(searchString: string, position?: number): SugarDefaultChainable<number>;
      link(url: string): SugarDefaultChainable<string>;
      localeCompare(that: string): SugarDefaultChainable<number>;
      localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): SugarDefaultChainable<number>;
      match(regexp: RegExp): SugarDefaultChainable<RegExpMatchArray | null>;
      match(regexp: string): SugarDefaultChainable<RegExpMatchArray | null>;
      normalize(form?: string): SugarDefaultChainable<string>;
      normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): SugarDefaultChainable<string>;
      repeat(count: number): SugarDefaultChainable<string>;
      replace(searchValue: string, replaceValue: string): SugarDefaultChainable<string>;
      replace(searchValue: string, replacer: (substring: string, ...args: any[]) => string): SugarDefaultChainable<string>;
      replace(searchValue: RegExp, replaceValue: string): SugarDefaultChainable<string>;
      replace(searchValue: RegExp, replacer: (substring: string, ...args: any[]) => string): SugarDefaultChainable<string>;
      search(regexp: RegExp): SugarDefaultChainable<number>;
      search(regexp: string): SugarDefaultChainable<number>;
      slice(start?: number, end?: number): SugarDefaultChainable<string>;
      small(): SugarDefaultChainable<string>;
      split(separator: string, limit?: number): SugarDefaultChainable<string[]>;
      split(separator: RegExp, limit?: number): SugarDefaultChainable<string[]>;
      startsWith(searchString: string, position?: number): SugarDefaultChainable<boolean>;
      strike(): SugarDefaultChainable<string>;
      sub(): SugarDefaultChainable<string>;
      substr(from: number, length?: number): SugarDefaultChainable<string>;
      substring(start: number, end?: number): SugarDefaultChainable<string>;
      sup(): SugarDefaultChainable<string>;
      toLocaleLowerCase(): SugarDefaultChainable<string>;
      toLocaleUpperCase(): SugarDefaultChainable<string>;
      toLowerCase(): SugarDefaultChainable<string>;
      toUpperCase(): SugarDefaultChainable<string>;
      trim(): SugarDefaultChainable<string>;
    }

  }

}

declare module "sugar" {
  const Sugar: sugarjs.Sugar;
  export = Sugar;
}

declare var Sugar: sugarjs.Sugar;