/*
 *  Sugar v2.0.3
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  /***
   * @module Core
   * @description Core functionality including the ability to define methods and
   *              extend onto natives.
   *
   ***/

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  // The global context. Rhino uses a different "global" keyword so
  // do an extra check to be sure that it's actually the global context.
  var globalContext = typeof global !== 'undefined' && global.Object === Object ? global : this;

  // Is the environment node?
  var hasExports = typeof module !== 'undefined' && module.exports;

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    if (hasExports) {
      module.exports = Sugar;
    } else {
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  /***
   * @method createNamespace(name)
   * @returns SugarNamespace
   * @namespace Sugar
   * @short Creates a new Sugar namespace.
   * @extra This method is for plugin developers who want to define methods to be
   *        used with natives that Sugar does not handle by default. The new
   *        namespace will appear on the `Sugar` global with all the methods of
   *        normal namespaces, including the ability to define new methods. When
   *        extended, any defined methods will be mapped to `name` in the global
   *        context.
   *
   * @example
   *
   *   Sugar.createNamespace('Boolean');
   *
   * @param {string} name - The namespace name.
   *
   ***/
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    /***
     * @method extend([opts])
     * @returns Sugar
     * @namespace Sugar
     * @short Extends Sugar defined methods onto natives.
     * @extra This method can be called on individual namespaces like
     *        `Sugar.Array` or on the `Sugar` global itself, in which case
     *        [opts] will be forwarded to each `extend` call. For more,
     *        see `extending`.
     *
     * @options
     *
     *   methods           An array of method names to explicitly extend.
     *
     *   except            An array of method names or global namespaces (`Array`,
     *                     `String`) to explicitly exclude. Namespaces should be the
     *                     actual global objects, not strings.
     *
     *   namespaces        An array of global namespaces (`Array`, `String`) to
     *                     explicitly extend. Namespaces should be the actual
     *                     global objects, not strings.
     *
     *   enhance           A shortcut to disallow all "enhance" flags at once
     *                     (flags listed below). For more, see `enhanced methods`.
     *                     Default is `true`.
     *
     *   enhanceString     A boolean allowing String enhancements. Default is `true`.
     *
     *   enhanceArray      A boolean allowing Array enhancements. Default is `true`.
     *
     *   objectPrototype   A boolean allowing Sugar to extend Object.prototype
     *                     with instance methods. This option is off by default
     *                     and should generally not be used except with caution.
     *                     For more, see `object methods`.
     *
     * @example
     *
     *   Sugar.Array.extend();
     *   Sugar.extend();
     *
     * @option {Array<string>} [methods]
     * @option {Array<string|NativeConstructor>} [except]
     * @option {Array<NativeConstructor>} [namespaces]
     * @option {boolean} [enhance]
     * @option {boolean} [enhanceString]
     * @option {boolean} [enhanceArray]
     * @option {boolean} [objectPrototype]
     * @param {ExtendOptions} [opts]
     *
     ***
     * @method extend([opts])
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Extends Sugar defined methods for a specific namespace onto natives.
     * @param {ExtendOptions} [opts]
     *
     ***/
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    /***
     * @method defineStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods on the namespace that can later be extended
     *        onto the native globals.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. If `extend` was previously called
     *        with no arguments, the method will be immediately mapped to its
     *        native when defined.
     *
     * @example
     *
     *   Sugar.Number.defineStatic({
     *     isOdd: function (num) {
     *       return num % 2 === 1;
     *     }
     *   });
     *
     * @signature defineStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStatic', STATIC);

    /***
     * @method defineInstance(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines methods on the namespace that can later be extended as
     *        instance methods onto the native prototype.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. All functions should accept the
     *        native for which they are mapped as their first argument, and should
     *        never refer to `this`. If `extend` was previously called with no
     *        arguments, the method will be immediately mapped to its native when
     *        defined.
     *
     *        Methods cannot accept more than 4 arguments in addition to the
     *        native (5 arguments total). Any additional arguments will not be
     *        mapped. If the method needs to accept unlimited arguments, use
     *        `defineInstanceWithArguments`. Otherwise if more options are
     *        required, use an options object instead.
     *
     * @example
     *
     *   Sugar.Number.defineInstance({
     *     square: function (num) {
     *       return num * num;
     *     }
     *   });
     *
     * @signature defineInstance(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstance', INSTANCE);

    /***
     * @method defineInstanceAndStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short A shortcut to define both static and instance methods on the namespace.
     * @extra This method is intended for use with `Object` instance methods. Sugar
     *        will not map any methods to `Object.prototype` by default, so defining
     *        instance methods as static helps facilitate their proper use.
     *
     * @example
     *
     *   Sugar.Object.defineInstanceAndStatic({
     *     isAwesome: function (obj) {
     *       // check if obj is awesome!
     *     }
     *   });
     *
     * @signature defineInstanceAndStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    /***
     * @method defineStaticWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that collect arguments.
     * @extra This method is identical to `defineStatic`, except that when defined
     *        methods are called, they will collect any arguments past `n - 1`,
     *        where `n` is the number of arguments that the method accepts.
     *        Collected arguments will be passed to the method in an array
     *        as the last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineStaticWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineStaticWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    /***
     * @method defineInstanceWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that collect arguments.
     * @extra This method is identical to `defineInstance`, except that when
     *        defined methods are called, they will collect any arguments past
     *        `n - 1`, where `n` is the number of arguments that the method
     *        accepts. Collected arguments will be passed to the method as the
     *        last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineInstanceWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineInstanceWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    /***
     * @method defineStaticPolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that are mapped onto the native if they do
     *        not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments.
     *
     * @example
     *
     *   Sugar.Object.defineStaticPolyfill({
     *     keys: function (obj) {
     *       // get keys!
     *     }
     *   });
     *
     * @signature defineStaticPolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    /***
     * @method defineInstancePolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that are mapped onto the native prototype
     *        if they do not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. This method differs from
     *        `defineInstance` as there is no static signature (as the method
     *        is mapped as-is to the native), so it should refer to its `this`
     *        object.
     *
     * @example
     *
     *   Sugar.Array.defineInstancePolyfill({
     *     indexOf: function (arr, el) {
     *       // index finding code here!
     *     }
     *   });
     *
     * @signature defineInstancePolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    /***
     * @method alias(toName, from)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Aliases one Sugar method to another.
     *
     * @example
     *
     *   Sugar.Array.alias('all', 'every');
     *
     * @signature alias(toName, fn)
     * @param {string} toName - Name for new method.
     * @param {string|Function} from - Method to alias, or string shortcut.
     ***/
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace, fn;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      fn = new sugarNamespace(raw)[methodName];

      if (fn.disambiguate) {
        // If the method about to be called on this chainable is
        // itself a disambiguation method, then throw an error to
        // prevent infinite recursion.
        throw new TypeError('Cannot resolve namespace for ' + raw);
      }

      return fn.apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

  /***
   * @module Common
   * @description Internal utility and common methods.
   ***/

  // Flag allowing native methods to be enhanced
  var ENHANCEMENTS_FLAG = 'enhance';

  // For type checking, etc. Excludes object as this is more nuanced.
  var NATIVE_TYPES = 'Boolean Number String Date RegExp Function Array Error Set Map';

  // Do strings have no keys?
  var NO_KEYS_IN_STRING_OBJECTS = !('0' in Object('a'));

  // Prefix for private properties
  var PRIVATE_PROP_PREFIX = '_sugar_';

  // Matches 1..2 style ranges in properties
  var PROPERTY_RANGE_REG = /^(.*?)\[([-\d]*)\.\.([-\d]*)\](.*)$/;

  // WhiteSpace/LineTerminator as defined in ES5.1 plus Unicode characters in the Space, Separator category.
  var TRIM_CHARS = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';

  // Regex for matching a formatted string
  var STRING_FORMAT_REG = /([{}])\1|\{([^}]*)\}|(%)%|(%(\w*))/g;

  // Common chars
  var HALF_WIDTH_ZERO = 0x30,
      FULL_WIDTH_ZERO = 0xff10,
      HALF_WIDTH_PERIOD   = '.',
      FULL_WIDTH_PERIOD   = '．',
      HALF_WIDTH_COMMA    = ',',
      OPEN_BRACE  = '{',
      CLOSE_BRACE = '}';

  // Namespace aliases
  var sugarObject   = Sugar.Object,
      sugarArray    = Sugar.Array,
      sugarDate     = Sugar.Date,
      sugarString   = Sugar.String,
      sugarNumber   = Sugar.Number,
      sugarFunction = Sugar.Function,
      sugarRegExp   = Sugar.RegExp;

  // Class checks
  var isSerializable,
      isBoolean, isNumber, isString,
      isDate, isRegExp, isFunction,
      isArray, isSet, isMap, isError;

  function buildClassChecks() {

    var knownTypes = {};

    function addCoreTypes() {

      var names = spaceSplit(NATIVE_TYPES);

      isBoolean = buildPrimitiveClassCheck(names[0]);
      isNumber  = buildPrimitiveClassCheck(names[1]);
      isString  = buildPrimitiveClassCheck(names[2]);

      isDate   = buildClassCheck(names[3]);
      isRegExp = buildClassCheck(names[4]);

      // Wanted to enhance performance here by using simply "typeof"
      // but Firefox has two major issues that make this impossible,
      // one fixed, the other not, so perform a full class check here.
      //
      // 1. Regexes can be typeof "function" in FF < 3
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
      //
      // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
      isFunction = buildClassCheck(names[5]);


      isArray = Array.isArray || buildClassCheck(names[6]);
      isError = buildClassCheck(names[7]);

      isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
      isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

      // Add core types as known so that they can be checked by value below,
      // notably excluding Functions and adding Arguments and Error.
      addKnownType('Arguments');
      addKnownType(names[0]);
      addKnownType(names[1]);
      addKnownType(names[2]);
      addKnownType(names[3]);
      addKnownType(names[4]);
      addKnownType(names[6]);

    }

    function addArrayTypes() {
      var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
      forEach(spaceSplit(types), function(str) {
        addKnownType(str + 'Array');
      });
    }

    function addKnownType(className) {
      var str = '[object '+ className +']';
      knownTypes[str] = true;
    }

    function isKnownType(className) {
      return knownTypes[className];
    }

    function buildClassCheck(className, globalObject) {
      if (globalObject && isClass(new globalObject, 'Object')) {
        return getConstructorClassCheck(globalObject);
      } else {
        return getToStringClassCheck(className);
      }
    }

    function getConstructorClassCheck(obj) {
      var ctorStr = String(obj);
      return function(obj) {
        return String(obj.constructor) === ctorStr;
      };
    }

    function getToStringClassCheck(className) {
      return function(obj, str) {
        // perf: Returning up front on instanceof appears to be slower.
        return isClass(obj, className, str);
      };
    }

    function buildPrimitiveClassCheck(className) {
      var type = className.toLowerCase();
      return function(obj) {
        var t = typeof obj;
        return t === type || t === 'object' && isClass(obj, className);
      };
    }

    addCoreTypes();
    addArrayTypes();

    isSerializable = function(obj, className) {
      // Only known objects can be serialized. This notably excludes functions,
      // host objects, Symbols (which are matched by reference), and instances
      // of classes. The latter can arguably be matched by value, but
      // distinguishing between these and host objects -- which should never be
      // compared by value -- is very tricky so not dealing with it here.
      className = className || classToString(obj);
      return isKnownType(className) || isPlainObject(obj, className);
    };

  }

  function isClass(obj, className, str) {
    if (!str) {
      str = classToString(obj);
    }
    return str === '[object '+ className +']';
  }

  // Wrapping the core's "define" methods to
  // save a few bytes in the minified script.
  function wrapNamespace(method) {
    return function(sugarNamespace, arg1, arg2) {
      sugarNamespace[method](arg1, arg2);
    };
  }

  // Method define aliases
  var alias                       = wrapNamespace('alias'),
      defineStatic                = wrapNamespace('defineStatic'),
      defineInstance              = wrapNamespace('defineInstance'),
      defineStaticPolyfill        = wrapNamespace('defineStaticPolyfill'),
      defineInstancePolyfill      = wrapNamespace('defineInstancePolyfill'),
      defineInstanceAndStatic     = wrapNamespace('defineInstanceAndStatic'),
      defineInstanceWithArguments = wrapNamespace('defineInstanceWithArguments');

  function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
    defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function defineInstanceAndStaticSimilar(sugarNamespace, set, fn, flags) {
    defineInstanceAndStatic(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function collectSimilarMethods(set, fn) {
    var methods = {};
    if (isString(set)) {
      set = spaceSplit(set);
    }
    forEach(set, function(el, i) {
      fn(methods, el, i);
    });
    return methods;
  }

  // This song and dance is to fix methods to a different length
  // from what they actually accept in order to stay in line with
  // spec. Additionally passing argument length, as some methods
  // throw assertion errors based on this (undefined check is not
  // enough). Fortunately for now spec is such that passing 3
  // actual arguments covers all requirements. Note that passing
  // the argument length also forces the compiler to not rewrite
  // length of the compiled function.
  function fixArgumentLength(fn) {
    var staticFn = function(a) {
      var args = arguments;
      return fn(a, args[1], args[2], args.length - 1);
    };
    staticFn.instance = function(b) {
      var args = arguments;
      return fn(this, b, args[1], args.length);
    };
    return staticFn;
  }

  function defineAccessor(namespace, name, fn) {
    setProperty(namespace, name, fn);
  }

  function defineOptionsAccessor(namespace, defaults) {
    var obj = simpleClone(defaults);

    function getOption(name) {
      return obj[name];
    }

    function setOption(arg1, arg2) {
      var options;
      if (arguments.length === 1) {
        options = arg1;
      } else {
        options = {};
        options[arg1] = arg2;
      }
      forEachProperty(options, function(val, name) {
        if (val === null) {
          val = defaults[name];
        }
        obj[name] = val;
      });
    }

    defineAccessor(namespace, 'getOption', getOption);
    defineAccessor(namespace, 'setOption', setOption);
    return getOption;
  }

  // For methods defined directly on the prototype like Range
  function defineOnPrototype(ctor, methods) {
    var proto = ctor.prototype;
    forEachProperty(methods, function(val, key) {
      proto[key] = val;
    });
  }

  // Argument helpers

  function assertArgument(exists) {
    if (!exists) {
      throw new TypeError('Argument required');
    }
  }

  function assertCallable(obj) {
    if (!isFunction(obj)) {
      throw new TypeError('Function is not callable');
    }
  }

  function assertArray(obj) {
    if (!isArray(obj)) {
      throw new TypeError('Array required');
    }
  }

  function assertWritable(obj) {
    if (isPrimitive(obj)) {
      // If strict mode is active then primitives will throw an
      // error when attempting to write properties. We can't be
      // sure if strict mode is available, so pre-emptively
      // throw an error here to ensure consistent behavior.
      throw new TypeError('Property cannot be written');
    }
  }

  // Coerces an object to a positive integer.
  // Does not allow Infinity.
  function coercePositiveInteger(n) {
    n = +n || 0;
    if (n < 0 || !isNumber(n) || !isFinite(n)) {
      throw new RangeError('Invalid number');
    }
    return trunc(n);
  }


  // General helpers

  function isDefined(o) {
    return o !== undefined;
  }

  function isUndefined(o) {
    return o === undefined;
  }

  function privatePropertyAccessor(key) {
    var privateKey = PRIVATE_PROP_PREFIX + key;
    return function(obj, val) {
      if (arguments.length > 1) {
        setProperty(obj, privateKey, val);
        return obj;
      }
      return obj[privateKey];
    };
  }

  function setChainableConstructor(sugarNamespace, createFn) {
    sugarNamespace.prototype.constructor = function() {
      return createFn.apply(this, arguments);
    };
  }

  // Fuzzy matching helpers

  function getMatcher(f) {
    if (!isPrimitive(f)) {
      var className = classToString(f);
      if (isRegExp(f, className)) {
        return regexMatcher(f);
      } else if (isDate(f, className)) {
        return dateMatcher(f);
      } else if (isFunction(f, className)) {
        return functionMatcher(f);
      } else if (isPlainObject(f, className)) {
        return fuzzyMatcher(f);
      }
    }
    // Default is standard isEqual
    return defaultMatcher(f);
  }

  function fuzzyMatcher(obj) {
    var matchers = {};
    return function(el, i, arr) {
      var matched = true;
      if (!isObjectType(el)) {
        return false;
      }
      forEachProperty(obj, function(val, key) {
        matchers[key] = getOwn(matchers, key) || getMatcher(val);
        if (matchers[key].call(arr, el[key], i, arr) === false) {
          matched = false;
        }
        return matched;
      });
      return matched;
    };
  }

  function defaultMatcher(f) {
    return function(el) {
      return isEqual(el, f);
    };
  }

  function regexMatcher(reg) {
    reg = RegExp(reg);
    return function(el) {
      return reg.test(el);
    };
  }

  function dateMatcher(d) {
    var ms = d.getTime();
    return function(el) {
      return !!(el && el.getTime) && el.getTime() === ms;
    };
  }

  function functionMatcher(fn) {
    return function(el, i, arr) {
      // Return true up front if match by reference
      return el === fn || fn.call(arr, el, i, arr);
    };
  }

  // Object helpers

  function getKeys(obj) {
    return Object.keys(obj);
  }

  function deepHasProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, true);
  }

  function deepGetProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, false);
  }

  function deepSetProperty(obj, key, val) {
    handleDeepProperty(obj, key, false, false, true, false, val);
    return obj;
  }

  function handleDeepProperty(obj, key, any, has, fill, fillLast, val) {
    var ns, bs, ps, cbi, set, isLast, isPush, isIndex, nextIsIndex, exists;
    ns = obj || undefined;
    if (key == null) return;

    if (isObjectType(key)) {
      // Allow array and array-like accessors
      bs = [key];
    } else {
      key = String(key);
      if (key.indexOf('..') !== -1) {
        return handleArrayIndexRange(obj, key, any, val);
      }
      bs = key.split('[');
    }

    set = isDefined(val);

    for (var i = 0, blen = bs.length; i < blen; i++) {
      ps = bs[i];

      if (isString(ps)) {
        ps = periodSplit(ps);
      }

      for (var j = 0, plen = ps.length; j < plen; j++) {
        key = ps[j];

        // Is this the last key?
        isLast = i === blen - 1 && j === plen - 1;

        // Index of the closing ]
        cbi = key.indexOf(']');

        // Is the key an array index?
        isIndex = cbi !== -1;

        // Is this array push syntax "[]"?
        isPush = set && cbi === 0;

        // If the bracket split was successful and this is the last element
        // in the dot split, then we know the next key will be an array index.
        nextIsIndex = blen > 1 && j === plen - 1;

        if (isPush) {
          // Set the index to the end of the array
          key = ns.length;
        } else if (isIndex) {
          // Remove the closing ]
          key = key.slice(0, -1);
        }

        // If the array index is less than 0, then
        // add its length to allow negative indexes.
        if (isIndex && key < 0) {
          key = +key + ns.length;
        }

        // Bracket keys may look like users[5] or just [5], so the leading
        // characters are optional. We can enter the namespace if this is the
        // 2nd part, if there is only 1 part, or if there is an explicit key.
        if (i || key || blen === 1) {

          exists = any ? key in ns : hasOwn(ns, key);

          // Non-existent namespaces are only filled if they are intermediate
          // (not at the end) or explicitly filling the last.
          if (fill && (!isLast || fillLast) && !exists) {
            // For our purposes, last only needs to be an array.
            ns = ns[key] = nextIsIndex || (fillLast && isLast) ? [] : {};
            continue;
          }

          if (has) {
            if (isLast || !exists) {
              return exists;
            }
          } else if (set && isLast) {
            assertWritable(ns);
            ns[key] = val;
          }

          ns = exists ? ns[key] : undefined;
        }

      }
    }
    return ns;
  }

  // Get object property with support for 0..1 style range notation.
  function handleArrayIndexRange(obj, key, any, val) {
    var match, start, end, leading, trailing, arr, set;
    match = key.match(PROPERTY_RANGE_REG);
    if (!match) {
      return;
    }

    set = isDefined(val);
    leading = match[1];

    if (leading) {
      arr = handleDeepProperty(obj, leading, any, false, set ? true : false, true);
    } else {
      arr = obj;
    }

    assertArray(arr);

    trailing = match[4];
    start    = match[2] ? +match[2] : 0;
    end      = match[3] ? +match[3] : arr.length;

    // A range of 0..1 is inclusive, so we need to add 1 to the end. If this
    // pushes the index from -1 to 0, then set it to the full length of the
    // array, otherwise it will return nothing.
    end = end === -1 ? arr.length : end + 1;

    if (set) {
      for (var i = start; i < end; i++) {
        handleDeepProperty(arr, i + trailing, any, false, true, false, val);
      }
    } else {
      arr = arr.slice(start, end);

      // If there are trailing properties, then they need to be mapped for each
      // element in the array.
      if (trailing) {
        if (trailing.charAt(0) === HALF_WIDTH_PERIOD) {
          // Need to chomp the period if one is trailing after the range. We
          // can't do this at the regex level because it will be required if
          // we're setting the value as it needs to be concatentated together
          // with the array index to be set.
          trailing = trailing.slice(1);
        }
        return arr.map(function(el) {
          return handleDeepProperty(el, trailing);
        });
      }
    }
    return arr;
  }

  function getOwnKey(obj, key) {
    if (hasOwn(obj, key)) {
      return key;
    }
  }

  function hasProperty(obj, prop) {
    return !isPrimitive(obj) && prop in obj;
  }

  function isObjectType(obj, type) {
    return !!obj && (type || typeof obj) === 'object';
  }

  function isPrimitive(obj, type) {
    type = type || typeof obj;
    return obj == null || type === 'string' || type === 'number' || type === 'boolean';
  }

  function isPlainObject(obj, className) {
    return isObjectType(obj) &&
           isClass(obj, 'Object', className) &&
           hasValidPlainObjectPrototype(obj) &&
           hasOwnEnumeratedProperties(obj);
  }

  function hasValidPlainObjectPrototype(obj) {
    var hasToString = 'toString' in obj;
    var hasConstructor = 'constructor' in obj;
    // An object created with Object.create(null) has no methods in the
    // prototype chain, so check if any are missing. The additional hasToString
    // check is for false positives on some host objects in old IE which have
    // toString but no constructor. If the object has an inherited constructor,
    // then check if it is Object (the "isPrototypeOf" tapdance here is a more
    // robust way of ensuring this if the global has been hijacked). Note that
    // accessing the constructor directly (without "in" or "hasOwnProperty")
    // will throw a permissions error in IE8 on cross-domain windows.
    return (!hasConstructor && !hasToString) ||
            (hasConstructor && !hasOwn(obj, 'constructor') &&
             hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
  }

  function hasOwnEnumeratedProperties(obj) {
    // Plain objects are generally defined as having enumerated properties
    // all their own, however in early IE environments without defineProperty,
    // there may also be enumerated methods in the prototype chain, so check
    // for both of these cases.
    var objectProto = Object.prototype;
    for (var key in obj) {
      var val = obj[key];
      if (!hasOwn(obj, key) && val !== objectProto[key]) {
        return false;
      }
    }
    return true;
  }

  function simpleRepeat(n, fn) {
    for (var i = 0; i < n; i++) {
      fn(i);
    }
  }

  function simpleClone(obj) {
    return simpleMerge({}, obj);
  }

  function simpleMerge(target, source) {
    forEachProperty(source, function(val, key) {
      target[key] = val;
    });
    return target;
  }

  // Make primtives types like strings into objects.
  function coercePrimitiveToObject(obj) {
    if (isPrimitive(obj)) {
      obj = Object(obj);
    }
    if (NO_KEYS_IN_STRING_OBJECTS && isString(obj)) {
      forceStringCoercion(obj);
    }
    return obj;
  }

  // Force strings to have their indexes set in
  // environments that don't do this automatically.
  function forceStringCoercion(obj) {
    var i = 0, chr;
    while (chr = obj.charAt(i)) {
      obj[i++] = chr;
    }
  }

  // Equality helpers

  function isEqual(a, b, stack) {
    var aClass, bClass;
    if (a === b) {
      // Return quickly up front when matched by reference,
      // but be careful about 0 !== -0.
      return a !== 0 || 1 / a === 1 / b;
    }
    aClass = classToString(a);
    bClass = classToString(b);
    if (aClass !== bClass) {
      return false;
    }

    if (isSerializable(a, aClass) && isSerializable(b, bClass)) {
      return objectIsEqual(a, b, aClass, stack);
    } else if (isSet(a, aClass) && isSet(b, bClass)) {
      return a.size === b.size && isEqual(setToArray(a), setToArray(b), stack);
    } else if (isMap(a, aClass) && isMap(b, bClass)) {
      return a.size === b.size && isEqual(mapToArray(a), mapToArray(b), stack);
    } else if (isError(a, aClass) && isError(b, bClass)) {
      return a.toString() === b.toString();
    }

    return false;
  }

  function objectIsEqual(a, b, aClass, stack) {
    var aType = typeof a, bType = typeof b, propsEqual, count;
    if (aType !== bType) {
      return false;
    }
    if (isObjectType(a.valueOf())) {
      if (a.length !== b.length) {
        // perf: Quickly returning up front for arrays.
        return false;
      }
      count = 0;
      propsEqual = true;
      iterateWithCyclicCheck(a, false, stack, function(key, val, cyc, stack) {
        if (!cyc && (!(key in b) || !isEqual(val, b[key], stack))) {
          propsEqual = false;
        }
        count++;
        return propsEqual;
      });
      if (!propsEqual || count !== getKeys(b).length) {
        return false;
      }
    }
    // Stringifying the value handles NaN, wrapped primitives, dates, and errors in one go.
    return a.valueOf().toString() === b.valueOf().toString();
  }

  // Serializes an object in a way that will provide a token unique
  // to the type, class, and value of an object. Host objects, class
  // instances etc, are not serializable, and are held in an array
  // of references that will return the index as a unique identifier
  // for the object. This array is passed from outside so that the
  // calling function can decide when to dispose of this array.
  function serializeInternal(obj, refs, stack) {
    var type = typeof obj, className, value, ref;

    // Return quickly for primitives to save cycles
    if (isPrimitive(obj, type) && !isRealNaN(obj)) {
      return type + obj;
    }

    className = classToString(obj);

    if (!isSerializable(obj, className)) {
      ref = indexOf(refs, obj);
      if (ref === -1) {
        ref = refs.length;
        refs.push(obj);
      }
      return ref;
    } else if (isObjectType(obj)) {
      value = serializeDeep(obj, refs, stack) + obj.toString();
    } else if (1 / obj === -Infinity) {
      value = '-0';
    } else if (obj.valueOf) {
      value = obj.valueOf();
    }
    return type + className + value;
  }

  function serializeDeep(obj, refs, stack) {
    var result = '';
    iterateWithCyclicCheck(obj, true, stack, function(key, val, cyc, stack) {
      result += cyc ? 'CYC' : key + serializeInternal(val, refs, stack);
    });
    return result;
  }

  function iterateWithCyclicCheck(obj, sortedKeys, stack, fn) {

    function next(val, key) {
      var cyc = false;

      // Allowing a step into the structure before triggering this check to save
      // cycles on standard JSON structures and also to try as hard as possible to
      // catch basic properties that may have been modified.
      if (stack.length > 1) {
        var i = stack.length;
        while (i--) {
          if (stack[i] === val) {
            cyc = true;
          }
        }
      }

      stack.push(val);
      fn(key, val, cyc, stack);
      stack.pop();
    }

    function iterateWithSortedKeys() {
      // Sorted keys is required for serialization, where object order
      // does not matter but stringified order does.
      var arr = getKeys(obj).sort(), key;
      for (var i = 0; i < arr.length; i++) {
        key = arr[i];
        next(obj[key], arr[i]);
      }
    }

    // This method for checking for cyclic structures was egregiously stolen from
    // the ingenious method by @kitcambridge from the Underscore script:
    // https://github.com/documentcloud/underscore/issues/240
    if (!stack) {
      stack = [];
    }

    if (sortedKeys) {
      iterateWithSortedKeys();
    } else {
      forEachProperty(obj, next);
    }
  }


  // Array helpers

  function isArrayIndex(n) {
    return n >>> 0 == n && n != 0xFFFFFFFF;
  }

  function iterateOverSparseArray(arr, fn, fromIndex, loop) {
    var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
    for (var i = 0, len = indexes.length; i < len; i++) {
      index = indexes[i];
      fn.call(arr, arr[index], index, arr);
    }
    return arr;
  }

  // It's unclear whether or not sparse arrays qualify as "simple enumerables".
  // If they are not, however, the wrapping function will be deoptimized, so
  // isolate here (also to share between es5 and array modules).
  function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
    var indexes = [], i;
    for (i in arr) {
      if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
        indexes.push(+i);
      }
    }
    indexes.sort(function(a, b) {
      var aLoop = a > fromIndex;
      var bLoop = b > fromIndex;
      if (aLoop !== bLoop) {
        return aLoop ? -1 : 1;
      }
      return a - b;
    });
    return indexes;
  }

  function getEntriesForIndexes(obj, find, loop, isString) {
    var result, length = obj.length;
    if (!isArray(find)) {
      return entryAtIndex(obj, find, length, loop, isString);
    }
    result = new Array(find.length);
    forEach(find, function(index, i) {
      result[i] = entryAtIndex(obj, index, length, loop, isString);
    });
    return result;
  }

  function getNormalizedIndex(index, length, loop) {
    if (index && loop) {
      index = index % length;
    }
    if (index < 0) index = length + index;
    return index;
  }

  function entryAtIndex(obj, index, length, loop, isString) {
    index = getNormalizedIndex(index, length, loop);
    return isString ? obj.charAt(index) : obj[index];
  }

  function mapWithShortcuts(el, f, context, mapArgs) {
    if (!f) {
      return el;
    } else if (f.apply) {
      return f.apply(context, mapArgs || []);
    } else if (isArray(f)) {
      return f.map(function(m) {
        return mapWithShortcuts(el, m, context, mapArgs);
      });
    } else if (isFunction(el[f])) {
      return el[f].call(el);
    } else {
      return deepGetProperty(el, f);
    }
  }

  function spaceSplit(str) {
    return str.split(' ');
  }

  function commaSplit(str) {
    return str.split(HALF_WIDTH_COMMA);
  }

  function periodSplit(str) {
    return str.split(HALF_WIDTH_PERIOD);
  }

  function forEach(arr, fn) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (!(i in arr)) {
        return iterateOverSparseArray(arr, fn, i);
      }
      fn(arr[i], i);
    }
  }

  function filter(arr, fn) {
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      var el = arr[i];
      if (i in arr && fn(el, i)) {
        result.push(el);
      }
    }
    return result;
  }

  function map(arr, fn) {
    // perf: Not using fixed array len here as it may be sparse.
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr) {
        result.push(fn(arr[i], i));
      }
    }
    return result;
  }

  function indexOf(arr, el) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr && arr[i] === el) return i;
    }
    return -1;
  }

  // Number helpers

  var trunc = Math.trunc || function(n) {
    if (n === 0 || !isFinite(n)) return n;
    return n < 0 ? ceil(n) : floor(n);
  };

  function isRealNaN(obj) {
    // This is only true of NaN
    return obj != null && obj !== obj;
  }

  function withPrecision(val, precision, fn) {
    var multiplier = pow(10, abs(precision || 0));
    fn = fn || round;
    if (precision < 0) multiplier = 1 / multiplier;
    return fn(val * multiplier) / multiplier;
  }

  function padNumber(num, place, sign, base, replacement) {
    var str = abs(num).toString(base || 10);
    str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
    if (sign || num < 0) {
      str = (num < 0 ? '-' : '+') + str;
    }
    return str;
  }

  function getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) {
      return 'th';
    } else {
      switch(num % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
      }
    }
  }

  // Fullwidth number helpers
  var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

  function buildFullWidthNumber() {
    var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
    fullWidthNumberMap = {};
    for (var i = 0, digit; i <= 9; i++) {
      digit = chr(i + FULL_WIDTH_ZERO);
      fwn += digit;
      fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
    }
    fullWidthNumberMap[hwc] = '';
    fullWidthNumberMap[fwp] = hwp;
    // Mapping this to itself to capture it easily
    // in stringToNumber to detect decimals later.
    fullWidthNumberMap[hwp] = hwp;
    fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
    fullWidthNumbers = fwn;
  }

  // Takes into account full-width characters, commas, and decimals.
  function stringToNumber(str, base) {
    var sanitized, isDecimal;
    sanitized = str.replace(fullWidthNumberReg, function(chr) {
      var replacement = getOwn(fullWidthNumberMap, chr);
      if (replacement === HALF_WIDTH_PERIOD) {
        isDecimal = true;
      }
      return replacement;
    });
    return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
  }

  // Math aliases
  var abs   = Math.abs,
      pow   = Math.pow,
      min   = Math.min,
      max   = Math.max,
      ceil  = Math.ceil,
      floor = Math.floor,
      round = Math.round;


  // String helpers

  var chr = String.fromCharCode;

  function trim(str) {
    return str.trim();
  }

  function repeatString(str, num) {
    var result = '';
    str = str.toString();
    while (num > 0) {
      if (num & 1) {
        result += str;
      }
      if (num >>= 1) {
        str += str;
      }
    }
    return result;
  }

  function simpleCapitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

    var reg = STRING_FORMAT_REG;
    var compileMemoized = memoizeFunction(compile);

    function getToken(format, match) {
      var get, token, literal, fn;
      var bKey = match[2];
      var pLit = match[3];
      var pKey = match[5];
      if (match[4] && percentMatcher) {
        token = pKey;
        get = percentMatcher;
      } else if (bKey) {
        token = bKey;
        get = bracketMatcher;
      } else if (pLit && percentMatcher) {
        literal = pLit;
      } else {
        literal = match[1] || match[0];
      }
      if (get) {
        assertPassesPrecheck(precheck, bKey, pKey);
        fn = function(obj, opt) {
          return get(obj, token, opt);
        };
      }
      format.push(fn || getLiteral(literal));
    }

    function getSubstring(format, str, start, end) {
      if (end > start) {
        var sub = str.slice(start, end);
        assertNoUnmatched(sub, OPEN_BRACE);
        assertNoUnmatched(sub, CLOSE_BRACE);
        format.push(function() {
          return sub;
        });
      }
    }

    function getLiteral(str) {
      return function() {
        return str;
      };
    }

    function assertPassesPrecheck(precheck, bt, pt) {
      if (precheck && !precheck(bt, pt)) {
        throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
      }
    }

    function assertNoUnmatched(str, chr) {
      if (str.indexOf(chr) !== -1) {
        throw new TypeError('Unmatched '+ chr +' in format string');
      }
    }

    function compile(str) {
      var format = [], lastIndex = 0, match;
      reg.lastIndex = 0;
      while(match = reg.exec(str)) {
        getSubstring(format, str, lastIndex, match.index);
        getToken(format, match);
        lastIndex = reg.lastIndex;
      }
      getSubstring(format, str, lastIndex, str.length);
      return format;
    }

    return function(str, obj, opt) {
      var format = compileMemoized(str), result = '';
      for (var i = 0; i < format.length; i++) {
        result += format[i](obj, opt);
      }
      return result;
    };
  }

  // Inflection helper

  var Inflections = {};

  function getAcronym(str) {
    return Inflections.acronyms && Inflections.acronyms.find(str);
  }

  function getHumanWord(str) {
    return Inflections.human && Inflections.human.find(str);
  }

  function runHumanRules(str) {
    return Inflections.human && Inflections.human.runRules(str) || str;
  }

  // RegExp helpers

  function allCharsReg(src) {
    return RegExp('[' + src + ']', 'g');
  }

  function getRegExpFlags(reg, add) {
    var flags = '';
    add = add || '';
    function checkFlag(prop, flag) {
      if (prop || add.indexOf(flag) > -1) {
        flags += flag;
      }
    }
    checkFlag(reg.global, 'g');
    checkFlag(reg.ignoreCase, 'i');
    checkFlag(reg.multiline, 'm');
    checkFlag(reg.sticky, 'y');
    return flags;
  }

  function escapeRegExp(str) {
    if (!isString(str)) str = String(str);
    return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
  }

  // Date helpers

  var _utc = privatePropertyAccessor('utc');

  function callDateGet(d, method) {
    return d['get' + (_utc(d) ? 'UTC' : '') + method]();
  }

  function callDateSet(d, method, value, safe) {
    // "Safe" denotes not setting the date if the value is the same as what is
    // currently set. In theory this should be a noop, however it will cause
    // timezone shifts when in the middle of a DST fallback. This is unavoidable
    // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
    // November 1st, 2015 in northern hemisphere timezones that follow DST),
    // however when advancing or rewinding dates this can throw off calculations
    // so avoiding this unintentional shifting on an opt-in basis.
    if (safe && value === callDateGet(d, method, value)) {
      return;
    }
    d['set' + (_utc(d) ? 'UTC' : '') + method](value);
  }

  // Memoization helpers

  var INTERNAL_MEMOIZE_LIMIT = 1000;

  // Note that attemps to consolidate this with Function#memoize
  // ended up clunky as that is also serializing arguments. Separating
  // these implementations turned out to be simpler.
  function memoizeFunction(fn) {
    var memo = {}, counter = 0;

    return function(key) {
      if (hasOwn(memo, key)) {
        return memo[key];
      }
      if (counter === INTERNAL_MEMOIZE_LIMIT) {
        memo = {};
        counter = 0;
      }
      counter++;
      return memo[key] = fn(key);
    };
  }

  // ES6 helpers

  function setToArray(set) {
    var arr = new Array(set.size), i = 0;
    set.forEach(function(val) {
      arr[i++] = val;
    });
    return arr;
  }

  function mapToArray(map) {
    var arr = new Array(map.size), i = 0;
    map.forEach(function(val, key) {
      arr[i++] = [key, val];
    });
    return arr;
  }

  buildClassChecks();
  buildFullWidthNumber();

  /***
   * @module Object
   * @description Object creation, manipulation, comparison, type checking, and more.
   *
   * Much thanks to kangax for his informative aricle about how problems with
   * instanceof and constructor: http://bit.ly/1Qds27W
   *
   ***/

  // Matches bracket-style query strings like user[name]
  var DEEP_QUERY_STRING_REG = /^(.+?)(\[.*\])$/;

  // Matches any character not allowed in a decimal number.
  var NON_DECIMAL_REG = /[^\d.-]/;

  // Native methods for merging by descriptor when available.
  var getOwnPropertyNames      = Object.getOwnPropertyNames;
  var getOwnPropertySymbols    = Object.getOwnPropertySymbols;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // Basic Helpers

  function isArguments(obj, className) {
    className = className || classToString(obj);
    // .callee exists on Arguments objects in < IE8
    return hasProperty(obj, 'length') && (className === '[object Arguments]' || !!obj.callee);
  }

  // Query Strings | Creating

  function toQueryStringWithOptions(obj, opts) {
    opts = opts || {};
    if (isUndefined(opts.separator)) {
      opts.separator = '_';
    }
    return toQueryString(obj, opts.deep, opts.transform, opts.prefix || '', opts.separator);
  }

  function toQueryString(obj, deep, transform, prefix, separator) {
    if (isArray(obj)) {
      return collectArrayAsQueryString(obj, deep, transform, prefix, separator);
    } else if (isObjectType(obj) && obj.toString === internalToString) {
      return collectObjectAsQueryString(obj, deep, transform, prefix, separator);
    } else if (prefix) {
      return getURIComponentValue(obj, prefix, transform);
    }
    return '';
  }

  function collectArrayAsQueryString(arr, deep, transform, prefix, separator) {
    var el, qc, key, result = [];
    // Intentionally treating sparse arrays as dense here by avoiding map,
    // otherwise indexes will shift during the process of serialization.
    for (var i = 0, len = arr.length; i < len; i++) {
      el = arr[i];
      key = prefix + (prefix && deep ? '[]' : '');
      if (!key && !isObjectType(el)) {
        // If there is no key, then the values of the array should be
        // considered as null keys, so use them instead;
        qc = sanitizeURIComponent(el);
      } else {
        qc = toQueryString(el, deep, transform, key, separator);
      }
      result.push(qc);
    }
    return result.join('&');
  }

  function collectObjectAsQueryString(obj, deep, transform, prefix, separator) {
    var result = [];
    forEachProperty(obj, function(val, key) {
      var fullKey;
      if (prefix && deep) {
        fullKey = prefix + '[' + key + ']';
      } else if (prefix) {
        fullKey = prefix + separator + key;
      } else {
        fullKey = key;
      }
      result.push(toQueryString(val, deep, transform, fullKey, separator));
    });
    return result.join('&');
  }

  function getURIComponentValue(obj, prefix, transform) {
    var value;
    if (transform) {
      value = transform(obj, prefix);
    } else if (isDate(obj)) {
      value = obj.getTime();
    } else {
      value = obj;
    }
    return sanitizeURIComponent(prefix) + '=' + sanitizeURIComponent(value);
  }

  function sanitizeURIComponent(obj) {
    // undefined, null, and NaN are represented as a blank string,
    // while false and 0 are stringified.
    return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj);
  }


  // Query Strings | Parsing

  function fromQueryStringWithOptions(obj, opts) {
    var str = String(obj || '').replace(/^.*?\?/, ''), result = {}, auto;
    opts = opts || {};
    if (str) {
      forEach(str.split('&'), function(p) {
        var split = p.split('=');
        var key = decodeURIComponent(split[0]);
        var val = split.length === 2 ? decodeURIComponent(split[1]) : '';
        auto = opts.auto !== false;
        parseQueryComponent(result, key, val, opts.deep, auto, opts.separator, opts.transform);
      });
    }
    return result;
  }

  function parseQueryComponent(obj, key, val, deep, auto, separator, transform) {
    var match;
    if (separator) {
      key = mapQuerySeparatorToKeys(key, separator);
      deep = true;
    }
    if (deep === true && (match = key.match(DEEP_QUERY_STRING_REG))) {
      parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform);
    } else {
      setQueryProperty(obj, key, val, auto, transform);
    }
  }

  function parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform) {
    var key = match[1];
    var inner = match[2].slice(1, -1).split('][');
    forEach(inner, function(k) {
      if (!hasOwn(obj, key)) {
        obj[key] = k ? {} : [];
      }
      obj = getOwn(obj, key);
      key = k ? k : obj.length.toString();
    });
    setQueryProperty(obj, key, val, auto, transform);
  }

  function mapQuerySeparatorToKeys(key, separator) {
    var split = key.split(separator), result = split[0];
    for (var i = 1, len = split.length; i < len; i++) {
      result += '[' + split[i] + ']';
    }
    return result;
  }

  function setQueryProperty(obj, key, val, auto, transform) {
    var fnValue;
    if (transform) {
      fnValue = transform(val, key, obj);
    }
    if (isDefined(fnValue)) {
      val = fnValue;
    } else if (auto) {
      val = getQueryValueAuto(obj, key, val);
    }
    obj[key] = val;
  }

  function getQueryValueAuto(obj, key, val) {
    if (!val) {
      return null;
    } else if (val === 'true') {
      return true;
    } else if (val === 'false') {
      return false;
    }
    var num = +val;
    if (!isNaN(num) && stringIsDecimal(val)) {
      return num;
    }
    var existing = getOwn(obj, key);
    if (val && existing) {
      return isArray(existing) ? existing.concat(val) : [existing, val];
    }
    return val;
  }

  function stringIsDecimal(str) {
    return str !== '' && !NON_DECIMAL_REG.test(str);
  }


  // Object Merging

  function mergeWithOptions(target, source, opts) {
    opts = opts || {};
    return objectMerge(target, source, opts.deep, opts.resolve, opts.hidden, opts.descriptor);
  }

  function defaults(target, sources, opts) {
    opts = opts || {};
    opts.resolve = opts.resolve || false;
    return mergeAll(target, sources, opts);
  }

  function mergeAll(target, sources, opts) {
    if (!isArray(sources)) {
      sources = [sources];
    }
    forEach(sources, function(source) {
      return mergeWithOptions(target, source, opts);
    });
    return target;
  }

  function iterateOverProperties(hidden, obj, fn) {
    if (getOwnPropertyNames && hidden) {
      iterateOverKeys(getOwnPropertyNames, obj, fn, hidden);
    } else {
      forEachProperty(obj, fn);
    }
    if (getOwnPropertySymbols) {
      iterateOverKeys(getOwnPropertySymbols, obj, fn, hidden);
    }
  }

  // "keys" may include symbols
  function iterateOverKeys(getFn, obj, fn, hidden) {
    var keys = getFn(obj), desc;
    for (var i = 0, key; key = keys[i]; i++) {
      desc = getOwnPropertyDescriptor(obj, key);
      if (desc.enumerable || hidden) {
        fn(obj[key], key);
      }
    }
  }

  function mergeByPropertyDescriptor(target, source, prop, sourceVal) {
    var descriptor = getOwnPropertyDescriptor(source, prop);
    if (isDefined(descriptor.value)) {
      descriptor.value = sourceVal;
    }
    defineProperty(target, prop, descriptor);
  }

  function objectMerge(target, source, deep, resolve, hidden, descriptor) {
    var resolveByFunction = isFunction(resolve), resolveConflicts = resolve !== false;

    if (isUndefined(target)) {
      target = getNewObjectForMerge(source);
    } else if (resolveConflicts && isDate(target) && isDate(source)) {
      // A date's timestamp is a property that can only be reached through its
      // methods, so actively set it up front if both are dates.
      target.setTime(source.getTime());
    }

    if (isPrimitive(target)) {
      // Will not merge into a primitive type, so simply override.
      return source;
    }

    // If the source object is a primitive
    // type then coerce it into an object.
    if (isPrimitive(source)) {
      source = coercePrimitiveToObject(source);
    }

    iterateOverProperties(hidden, source, function(val, key) {
      var sourceVal, targetVal, resolved, goDeep, result;

      sourceVal = source[key];

      // We are iterating over properties of the source, so hasOwnProperty on
      // it is guaranteed to always be true. However, the target may happen to
      // have properties in its prototype chain that should not be considered
      // as conflicts.
      targetVal = getOwn(target, key);

      if (resolveByFunction) {
        result = resolve(key, targetVal, sourceVal, target, source);
        if (isUndefined(result)) {
          // Result is undefined so do not merge this property.
          return;
        } else if (isDefined(result) && result !== Sugar) {
          // If the source returns anything except undefined, then the conflict
          // has been resolved, so don't continue traversing into the object. If
          // the returned value is the Sugar global object, then allowing Sugar
          // to resolve the conflict, so continue on.
          sourceVal = result;
          resolved = true;
        }
      } else if (isUndefined(sourceVal)) {
        // Will not merge undefined.
        return;
      }

      // Regex properties are read-only, so intentionally disallowing deep
      // merging for now. Instead merge by reference even if deep.
      goDeep = !resolved && deep && isObjectType(sourceVal) && !isRegExp(sourceVal);

      if (!goDeep && !resolveConflicts && isDefined(targetVal)) {
        return;
      }

      if (goDeep) {
        sourceVal = objectMerge(targetVal, sourceVal, deep, resolve, hidden, descriptor);
      }

      // getOwnPropertyNames is standing in as
      // a test for property descriptor support
      if (getOwnPropertyNames && descriptor) {
        mergeByPropertyDescriptor(target, source, key, sourceVal);
      } else {
        target[key] = sourceVal;
      }

    });
    return target;
  }

  function getNewObjectForMerge(source) {
    var klass = classToString(source);
    // Primitive types, dates, and regexes have no "empty" state. If they exist
    // at all, then they have an associated value. As we are only creating new
    // objects when they don't exist in the target, these values can come alone
    // for the ride when created.
    if (isArray(source, klass)) {
      return [];
    } else if (isPlainObject(source, klass)) {
      return {};
    } else if (isDate(source, klass)) {
      return new Date(source.getTime());
    } else if (isRegExp(source, klass)) {
      return RegExp(source.source, getRegExpFlags(source));
    } else if (isPrimitive(source && source.valueOf())) {
      return source;
    }
    // If the object is not of a known type, then simply merging its
    // properties into a plain object will result in something different
    // (it will not respond to instanceof operator etc). Similarly we don't
    // want to call a constructor here as we can't know for sure what the
    // original constructor was called with (Events etc), so throw an
    // error here instead. Non-standard types can be handled if either they
    // already exist and simply have their properties merged, if the merge
    // is not deep so their references will simply be copied over, or if a
    // resolve function is used to assist the merge.
    throw new TypeError('Must be a basic data type');
  }

  function clone(source, deep) {
    var target = getNewObjectForMerge(source);
    return objectMerge(target, source, deep, true, true, true);
  }


  // Keys/Values

  function objectSize(obj) {
    return getKeysWithObjectCoercion(obj).length;
  }

  function getKeysWithObjectCoercion(obj) {
    return getKeys(coercePrimitiveToObject(obj));
  }

  function getValues(obj) {
    var values = [];
    forEachProperty(obj, function(val) {
      values.push(val);
    });
    return values;
  }

  function tap(obj, arg) {
    var fn = arg;
    if (!isFunction(arg)) {
      fn = function() {
        if (arg) obj[arg]();
      };
    }
    fn.call(obj, obj);
    return obj;
  }

  // Select/Reject

  function objectSelect(obj, f) {
    return selectFromObject(obj, f, true);
  }

  function objectReject(obj, f) {
    return selectFromObject(obj, f, false);
  }

  function selectFromObject(obj, f, select) {
    var match, result = {};
    f = [].concat(f);
    forEachProperty(obj, function(val, key) {
      match = false;
      for (var i = 0; i < f.length; i++) {
        if (matchInObject(f[i], key)) {
          match = true;
        }
      }
      if (match === select) {
        result[key] = val;
      }
    });
    return result;
  }

  function matchInObject(match, key) {
    if (isRegExp(match)) {
      return match.test(key);
    } else if (isObjectType(match)) {
      return key in match;
    } else {
      return key === String(match);
    }
  }

  // Remove/Exclude

  function objectRemove(obj, f) {
    var matcher = getMatcher(f);
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        delete obj[key];
      }
    });
    return obj;
  }

  function objectExclude(obj, f) {
    var result = {};
    var matcher = getMatcher(f);
    forEachProperty(obj, function(val, key) {
      if (!matcher(val, key, obj)) {
        result[key] = val;
      }
    });
    return result;
  }

  function objectIntersectOrSubtract(obj1, obj2, subtract) {
    if (!isObjectType(obj1)) {
      return subtract ? obj1 : {};
    }
    obj2 = coercePrimitiveToObject(obj2);
    function resolve(key, val, val1) {
      var exists = key in obj2 && isEqual(val1, obj2[key]);
      if (exists !== subtract) {
        return val1;
      }
    }
    return objectMerge({}, obj1, false, resolve);
  }

  /***
   * @method is[Type]()
   * @returns Boolean
   * @short Returns true if the object is an object of that type.
   *
   * @set
   *   isArray
   *   isBoolean
   *   isDate
   *   isError
   *   isFunction
   *   isMap
   *   isNumber
   *   isRegExp
   *   isSet
   *   isString
   *
   * @example
   *
   *   Object.isArray([3]) -> true
   *   Object.isNumber(3)  -> true
   *   Object.isString(8)  -> false
   *
   ***/
  function buildClassCheckMethods() {
    var checks = [isBoolean, isNumber, isString, isDate, isRegExp, isFunction, isArray, isError, isSet, isMap];
    defineInstanceAndStaticSimilar(sugarObject, NATIVE_TYPES, function(methods, name, i) {
      methods['is' + name] = checks[i];
    });
  }

  defineStatic(sugarObject, {

    /***
     * @method fromQueryString(str, [options])
     * @returns Object
     * @static
     * @short Converts the query string of a URL into an object.
     * @extra Options can be passed with [options] for more control over the result.
     *
     * @options
     *
     *   deep        If the string contains "deep" syntax `foo[]`, this will
     *               be automatically converted to an array. (Default `false`)
     *
     *   auto        If `true`, booleans `"true"` and `"false"`, numbers, and arrays
     *               (repeated keys) will be automatically cast to native
     *               values. (Default `true`)
     *
     *   transform   A function whose return value becomes the final value. If
     *               the function returns `undefined`, then the original value
     *               will be used. This allows the function to intercept only
     *               certain keys or values. (Default `undefined`)
     *
     *   separator   If passed, keys will be split on this string to extract
     *               deep values. (Default `''`)
     *
     * @callback queryStringTransformFn
     *
     *   key   The key component of the query string (before `=`).
     *   val   The value component of the query string (after `=`).
     *   obj   A reference to the object being built.
     *
     * @example
     *
     *   Object.fromQueryString('a=1&b=2')                 -> {a:1,b:2}
     *   Object.fromQueryString('a[]=1&a[]=2',{deep:true}) -> {a:['1','2']}
     *   Object.fromQueryString('a_b=c',{separator:'_'})   -> {a:{b:'c'}}
     *   Object.fromQueryString('id=123', {transform:idToNumber});
     *
     * @param {string} str
     * @param {QueryStringParseOptions} options
     * @callbackParam {string} key
     * @callbackParam {Property} val
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} queryStringTransformFn
     * @option {boolean} [deep]
     * @option {boolean} [auto]
     * @option {string} [separator]
     * @option {queryStringTransformFn} [transform]
     *
     ***/
    'fromQueryString': function(obj, options) {
      return fromQueryStringWithOptions(obj, options);
    }

  });

  defineInstanceAndStatic(sugarObject, {

    /***
     * @method has(key, [inherited] = false)
     * @returns Boolean
     * @short Checks if the object has property `key`.
     * @extra Supports `deep properties`. If [inherited] is `true`,
     *        properties defined in the prototype chain will also return `true`.
     *        The default of `false` for this argument makes this method suited
     *        to working with objects as data stores by default.
     *
     * @example
     *
     *   Object.has(usersByName, 'Harry')     -> true
     *   Object.has(data, 'users[1].profile') -> true
     *   Object.has([], 'forEach')            -> false
     *   Object.has([], 'forEach', true)      -> true
     *
     * @param {string} key
     * @param {boolean} [inherited]
     *
     ***/
    'has': function(obj, key, any) {
      return deepHasProperty(obj, key, any);
    },

    /***
     * @method get(key, [inherited] = false)
     * @returns Mixed
     * @short Gets a property of the object.
     * @extra Supports `deep properties`. If [inherited] is `true`,
     *        properties defined in the prototype chain will also be returned.
     *        The default of `false` for this argument makes this method suited
     *        to working with objects as data stores by default.
     *
     * @example
     *
     *   Object.get(Harry, 'name');           -> 'Harry'
     *   Object.get(Harry, 'profile.likes');  -> Harry's likes
     *   Object.get(data, 'users[3].name')    -> User 3's name
     *   Object.get(data, 'users[1..2]')      -> Users 1 and 2
     *   Object.get(data, 'users[1..2].name') -> Names of users 1 and 2
     *   Object.get(data, 'users[-2..-1]')    -> Last 2 users
     *
     * @param {string} key
     * @param {boolean} [inherited]
     *
     ***/
    'get': function(obj, key, any) {
      return deepGetProperty(obj, key, any);
    },

    /***
     * @method set(key, val)
     * @returns Object
     * @short Sets a property on the object.
     * @extra Using a dot or square bracket in `key` is considered "deep" syntax,
     *        and will attempt to traverse into the object to set the property,
     *        creating properties that do not exist along the way. If the missing
     *        property is referenced using square brackets, an empty array will be
     *        created, otherwise an empty object. A special `[]` carries the
     *        meaning of "the last index + 1", and will effectively push `val`
     *        onto the end of the array. Lastly, a `..` separator inside the
     *        brackets is "range" notation, and will set properties on all
     *        elements in the specified range. Range members may be negative,
     *        which will be offset from the end of the array.
     *
     * @example
     *
     *   Object.set({}, 'name', 'Harry');         -> {name:'Harry'}
     *   Object.set({}, 'user.name', 'Harry');    -> {user:{name:'Harry'}}
     *   Object.set({}, 'users[].name', 'Bob')    -> {users:[{name:'Bob'}}
     *   Object.set({}, 'users[1].name','Bob')    -> {users:[undefined, {name:'Bob'}]}
     *   Object.set({}, 'users[0..1].name','Bob') -> {users:[{name:'Bob'},{name:'Bob'}]}
     *
     * @param {string} key
     * @param {Property} val
     *
     ***/
    'set': function(obj, key, val) {
      return deepSetProperty(obj, key, val);
    },

    /***
     * @method size()
     * @returns Number
     * @short Returns the number of properties in the object.
     *
     * @example
     *
     *   Object.size({foo:'bar'}) -> 1
     *
     ***/
    'size': function(obj) {
      return objectSize(obj);
    },

    /***
     * @method isEmpty()
     * @returns Boolean
     * @short Returns true if the number of properties in the object is zero.
     *
     * @example
     *
     *   Object.isEmpty({})    -> true
     *   Object.isEmpty({a:1}) -> false
     *
     ***/
    'isEmpty': function(obj) {
      return objectSize(obj) === 0;
    },

    /***
     * @method toQueryString([options])
     * @returns Object
     * @short Converts the object into a query string.
     * @extra Accepts deep objects and arrays. [options] can be passed for more
     *        control over the result.
     *
     * @options
     *
     *   deep        If `true`, non-standard "deep" syntax `foo[]` will be
     *               used for output. Note that `separator` will be ignored,
     *               as this option overrides shallow syntax. (Default `false`)
     *
     *   prefix      If passed, this string will be prefixed to all keys,
     *               separated by the `separator`. (Default `''`).
     *
     *   transform   A function whose return value becomes the final value
     *               in the string. (Default `undefined`)
     *
     *   separator   A string that is used to separate keys, either for deep
     *               objects, or when `prefix` is passed.(Default `_`).
     *
     * @callback queryStringTransformFn
     *
     *   key  The key of the current iteration.
     *   val  The value of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.toQueryString({foo:'bar'})                  -> 'foo=bar'
     *   Object.toQueryString({foo:['a','b']})              -> 'foo=a&foo=b'
     *   Object.toQueryString({foo:['a','b']}, {deep:true}) -> 'foo[]=a&foo[]=b'
     *
     * @param {Object} obj
     * @param {QueryStringOptions} [options]
     * @callbackParam {string} key
     * @callbackParam {Property} val
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} queryStringTransformFn
     * @option {boolean} [deep]
     * @option {string} [prefix]
     * @option {string} [separator]
     * @option {queryStringTransformFn} [transform]
     *
     ***/
    'toQueryString': function(obj, options) {
      return toQueryStringWithOptions(obj, options);
    },

    /***
     * @method isEqual(obj)
     * @returns Boolean
     * @short Returns true if `obj` is equivalent to the object.
     * @extra If both objects are built-in types, they will be considered
     *        equivalent if they are not "observably distinguishable". This means
     *        that primitives and object types, `0` and `-0`, and sparse and
     *        dense arrays are all not equal. Functions and non-built-ins like
     *        instances of user-defined classes and host objects like Element and
     *        Event are strictly compared `===`, and will only be equal if they
     *        are the same reference. Plain objects as well as Arrays will be
     *        traversed into and deeply checked by their non-inherited, enumerable
     *        properties. Other allowed types include Typed Arrays, Sets, Maps,
     *        Arguments, Dates, Regexes, and Errors.
     *
     * @example
     *
     *   Object.isEqual({a:2}, {a:2})         -> true
     *   Object.isEqual({a:2}, {a:3})         -> false
     *   Object.isEqual(5, Object(5))         -> false
     *   Object.isEqual(Object(5), Object(5)) -> true
     *   Object.isEqual(NaN, NaN)             -> false
     *
     * @param {Object} obj
     *
     ***/
    'isEqual': function(obj1, obj2) {
      return isEqual(obj1, obj2);
    },

    /***
     * @method merge(source, [options])
     * @returns Object
     * @short Merges properties from `source` into the object.
     * @extra This method will modify the object! Use `add` for a non-destructive
     *        alias.
     *
     * @options
     *
     *   deep         If `true` deep properties are merged recursively.
     *                (Default `false`)
     *
     *   hidden       If `true`, non-enumerable properties will be merged as well.
     *                (Default `false`)
     *
     *   descriptor   If `true`, properties will be merged by property descriptor.
     *                Use this option to merge getters or setters, or to preserve
     *                `enumerable`, `configurable`, etc.
     *                (Default `false`)
     *
     *   resolve      Determines which property wins in the case of conflicts.
     *                If `true`, `source` wins. If `false`, the original property wins.
     *                If a function is passed, its return value will decide the result.
     *                Any non-undefined return value will resolve the conflict
     *                for that property (will not continue if `deep`). Returning
     *                `undefined` will do nothing (no merge). Finally, returning
     *                the global object `Sugar` will allow Sugar to handle the
     *                merge as normal. (Default `true`)
     *
     * @callback resolveFn
     *
     *   key        The key of the current iteration.
     *   targetVal  The current value for the key in the target.
     *   sourceVal  The current value for the key in `source`.
     *   target     The target object.
     *   source     The source object.
     *
     * @example
     *
     *   Object.merge({one:1},{two:2})                 -> {one:1,two:2}
     *   Object.merge({one:1},{one:9,two:2})           -> {one:9,two:2}
     *   Object.merge({x:{a:1}},{x:{b:2}},{deep:true}) -> {x:{a:1,b:2}}
     *   Object.merge({a:1},{a:2},{resolve:mergeAdd})  -> {a:3}
     *
     * @param {Object} source
     * @param {ObjectMergeOptions} [options]
     * @callbackParam {string} key
     * @callbackParam {Property} targetVal
     * @callbackParam {Property} sourceVal
     * @callbackParam {Object} target
     * @callbackParam {Object} source
     * @callbackReturns {boolean} resolveFn
     * @option {boolean} [deep]
     * @option {boolean} [hidden]
     * @option {boolean} [descriptor]
     * @option {boolean|resolveFn} [resolve]
     *
     ***/
    'merge': function(target, source, opts) {
      return mergeWithOptions(target, source, opts);
    },

    /***
     * @method add(obj, [options])
     * @returns Object
     * @short Adds properties in `obj` and returns a new object.
     * @extra This method will not modify the original object. See `merge` for options.
     *
     * @example
     *
     *   Object.add({one:1},{two:2})                 -> {one:1,two:2}
     *   Object.add({one:1},{one:9,two:2})           -> {one:9,two:2}
     *   Object.add({x:{a:1}},{x:{b:2}},{deep:true}) -> {x:{a:1,b:2}}
     *   Object.add({a:1},{a:2},{resolve:mergeAdd})  -> {a:3}
     *
     * @param {Object} obj
     * @param {ObjectMergeOptions} [options]
     *
     ***/
    'add': function(obj1, obj2, opts) {
      return mergeWithOptions(clone(obj1), obj2, opts);
    },

    /***
     * @method mergeAll(sources, [options])
     * @returns Object
     * @short Merges properties from an array of `sources`.
     * @extra This method will modify the object! Use `addAll` for a non-destructive
     *        alias. See `merge` for options.
     *
     * @example
     *
     *   Object.mergeAll({one:1},[{two:2},{three:3}]) -> {one:1,two:2,three:3}
     *   Object.mergeAll({x:{a:1}},[{x:{b:2}},{x:{c:3}}],{deep:true}) -> {x:{a:1,b:2,c:3}}
     *
     * @param {Array<Object>} sources
     * @param {ObjectMergeOptions} [options]
     *
     ***/
    'mergeAll': function(target, sources, opts) {
      return mergeAll(target, sources, opts);
    },

    /***
     * @method addAll(sources, [options])
     * @returns Object
     * @short Adds properties from an array of `sources` and returns a new object.
     * @extra This method will not modify the object. See `merge` for options.
     *
     * @example
     *
     *   Object.addAll({one:1},[{two:2},{three:3}]) -> {one:1,two:2,three:3}
     *   Object.addAll({x:{a:1}},[{x:{b:2}},{x:{c:3}}],{deep:true}) -> {x:{a:1,b:2,c:3}}
     *
     * @param {Array<Object>} sources
     * @param {ObjectMergeOptions} [options]
     *
     ***/
    'addAll': function(obj, sources, opts) {
      return mergeAll(clone(obj), sources, opts);
    },

    /***
     * @method defaults(sources, [options])
     * @returns Object
     * @short Merges properties from one or multiple `sources` while preserving
     *        the object's defined properties.
     * @extra This method modifies the object! See `merge` for options.
     *
     * @example
     *
     *   Object.defaults({one:1},[{one:9},{two:2}])                   -> {one:1,two:2}
     *   Object.defaults({x:{a:1}},[{x:{a:9}},{x:{b:2}}],{deep:true}) -> {x:{a:1,b:2}}
     *
     * @param {Array<Object>} sources
     * @param {ObjectMergeOptions} [options]
     *
     ***/
    'defaults': function(target, sources, opts) {
      return defaults(target, sources, opts);
    },

    /***
     * @method intersect(obj)
     * @returns Object
     * @short Returns a new object whose properties are those that the object has
     *        in common both with `obj`.
     * @extra If both key and value do not match, then the property will not be included.
     *
     * @example
     *
     *   Object.intersect({a:'a'},{b:'b'}) -> {}
     *   Object.intersect({a:'a'},{a:'b'}) -> {}
     *   Object.intersect({a:'a',b:'b'},{b:'b',z:'z'}) -> {b:'b'}
     *
     * @param {Object} obj
     *
     ***/
    'intersect': function(obj1, obj2) {
      return objectIntersectOrSubtract(obj1, obj2, false);
    },

    /***
     * @method subtract(obj)
     * @returns Object
     * @short Returns a clone of the object with any properties shared with `obj` excluded.
     * @extra If both key and value do not match, then the property will not be excluded.
     *
     * @example
     *
     *   Object.subtract({a:'a',b:'b'},{b:'b'}) -> {a:'a'}
     *   Object.subtract({a:'a',b:'b'},{a:'b'}) -> {a:'a',b:'b'}
     *
     * @param {Object} obj
     *
     ***/
    'subtract': function(obj1, obj2) {
      return objectIntersectOrSubtract(obj1, obj2, true);
    },

    /***
     * @method clone([deep] = false)
     * @returns Object
     * @short Creates a clone of the object.
     * @extra Default is a shallow clone, unless [deep] is true.
     *
     * @example
     *
     *   Object.clone({foo:'bar'})       -> creates shallow clone
     *   Object.clone({foo:'bar'}, true) -> creates a deep clone
     *
     * @param {boolean} [deep]
     *
     ***/
    'clone': function(obj, deep) {
      return clone(obj, deep);
    },

    /***
     * @method values()
     * @returns Array
     * @short Returns an array containing the values in the object.
     * @extra Values are in no particular order. Does not include inherited or
     *        non-enumerable properties.
     *
     * @example
     *
     *   Object.values({a:'a',b:'b'}) -> ['a','b']
     *
     ***/
    'values': function(obj) {
      return getValues(obj);
    },

    /***
     * @method invert([multi] = false)
     * @returns Object
     * @short Creates a new object with the keys and values swapped.
     * @extra If [multi] is true, values will be an array of all keys, othewise
     *        collisions will be overwritten.
     *
     * @example
     *
     *   Object.invert({foo:'bar'})     -> {bar:'foo'}
     *   Object.invert({a:1,b:1}, true) -> {1:['a','b']}
     *
     * @param {boolean} [multi]
     *
     ***/
    'invert': function(obj, multi) {
      var result = {};
      multi = multi === true;
      forEachProperty(obj, function(val, key) {
        if (hasOwn(result, val) && multi) {
          result[val].push(key);
        } else if (multi) {
          result[val] = [key];
        } else {
          result[val] = key;
        }
      });
      return result;
    },

    /***
     * @method tap(fn)
     * @returns Object
     * @short Runs `fn` and returns the object.
     * @extra A string can also be used as a shortcut to a method. This method is
     *        designed to run an intermediary function that "taps into" a method
     *        chain. As such, it is fairly useless as a static method. However it
     *        can be quite useful when combined with chainables.
     *
     * @callback tapFn
     *
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Sugar.Array([1,4,9]).map(Math.sqrt).tap('pop') -> [1,2]
     *   Sugar.Object({a:'a'}).tap(logArgs).merge({b:'b'})  -> {a:'a',b:'b'}
     *
     * @param {tapFn} fn
     * @callbackParam {Object} obj
     * @callbackReturns {any} tapFn
     *
     ***/
    'tap': function(obj, arg) {
      return tap(obj, arg);
    },

    /***
     * @method isArguments()
     * @returns Boolean
     * @short Returns true if the object is an arguments object.
     *
     * @example
     *
     *   Object.isArguments([1]) -> false
     *
     ***/
    'isArguments': function(obj) {
      return isArguments(obj);
    },

    /***
     * @method isObject()
     * @returns Boolean
     * @short Returns true if the object is a "plain" object.
     * @extra Plain objects do not include instances of classes or "host" objects,
     *        such as Elements, Events, etc.
     *
     * @example
     *
     *   Object.isObject({ broken:'wear' }) -> true
     *
     ***/
    'isObject': function(obj) {
      return isPlainObject(obj);
    },

    /***
     * @method remove(search)
     * @returns Object
     * @short Deletes all properties in the object matching `search`.
     * @extra This method will modify the object!. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   key  The key of the current iteration.
     *   val  The value of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.remove({a:'a',b:'b'}, 'a');           -> {b:'b'}
     *   Object.remove({a:'a',b:'b',z:'z'}, /[a-f]/); -> {z:'z'}
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'remove': function(obj, f) {
      return objectRemove(obj, f);
    },

    /***
     * @method exclude(search)
     * @returns Object
     * @short Returns a new object with all properties matching `search` removed.
     * @extra This is a non-destructive version of `remove` and will not modify
     *        the object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   key  The key of the current iteration.
     *   val  The value of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.exclude({a:'a',b:'b'}, 'a');           -> {b:'b'}
     *   Object.exclude({a:'a',b:'b',z:'z'}, /[a-f]/); -> {z:'z'}
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'exclude': function(obj, f) {
      return objectExclude(obj, f);
    },

    /***
     * @method select(find)
     * @returns Object
     * @short Builds a new object containing the keys specified in `find`.
     * @extra When `find` is a string, a single key will be selected. Arrays or
     *        objects match multiple keys, and a regex will match keys by regex.
     *
     * @example
     *
     *   Object.select({a:1,b:2}, 'a')           -> {a:1}
     *   Object.select({a:1,b:2}, ['a', 'b'])    -> {a:1,b:2}
     *   Object.select({a:1,b:2}, /[a-z]/)       -> {a:1,b:2}
     *   Object.select({a:1,b:2}, {a:'a',b:'b'}) -> {a:1,b:2}
     *
     * @param {string|RegExp|Array<string>|Object} find
     *
     ***/
    'select': function(obj, f) {
      return objectSelect(obj, f);
    },

    /***
     * @method reject(find)
     * @returns Object
     * @short Builds a new object containing all keys except those in `find`.
     * @extra When `find` is a string, a single key will be rejected. Arrays or
     *        objects match multiple keys, and a regex will match keys by regex.
     *
     * @example
     *
     *   Object.reject({a:1,b:2}, 'a')        -> {b:2}
     *   Object.reject({a:1,b:2}, /[a-z]/)    -> {}
     *   Object.reject({a:1,b:2}, {a:'a'})    -> {b:2}
     *   Object.reject({a:1,b:2}, ['a', 'b']) -> {}
     *
     * @param {string|RegExp|Array<string>|Object} find
     *
     ***/
    'reject': function(obj, f) {
      return objectReject(obj, f);
    }

  });

  // TODO: why is this here?
  defineInstance(sugarObject, {

    /***
     * @method keys()
     * @returns Array
     * @polyfill ES5
     * @short Returns an array containing the keys of all of the non-inherited,
     *        enumerable properties of the object.
     *
     * @example
     *
     *   Object.keys({a:'a',b:'b'}) -> ['a','b']
     *
     ***/
    'keys': function(obj) {
      return getKeys(obj);
    }

  });

  buildClassCheckMethods();

}).call(this);