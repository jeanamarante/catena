// Is catena still loading dependencies?
var $loading = true;

// Helper methods for CLASS modules.
var $classProto = { prototype: {} };

// Create reusable descriptor for object properties.
var $descriptor = {
    value: null,
    writable: false,
    enumerable: false,
    configurable: false
};

// Stores the links between parent and child modules.
var $hierarchy = {
    parents: {},
    children: {},

    /**
     * Create parent child links.
     *
     * @function link
     * @param {String} parentName
     * @param {String} childName
     * @api public
     */

    link: function (parentName, childName) {
        var arr = this.children[parentName];

        // If parent has not been referenced, create new array.
        if (arr === undefined) {
            this.children[parentName] = [childName];
        } else {
            arr.push(childName);
        }

        this.parents[childName] = parentName;
    },

    /**
     * @function hasParent
     * @return {Boolean}
     * @api public
     */

    hasParent: function (childName) {
        return this.parents[childName] !== undefined;
    },

    /**
     * @function hasChildren
     * @return {Boolean}
     * @api public
     */

    hasChildren: function (parentName) {
        return this.children[parentName] !== undefined;
    },

    /**
     * @function getParent
     * @param {String} childName
     * @return {String}
     * @api public
     */

    getParent: function (childName) {
        return this.hasParent(childName) ? this.parents[childName] : '';
    },

    /**
     * @function getChildren
     * @param {String} parentName
     * @return {Array}
     * @api public
     */

    getChildren: function (parentName) {
        return this.hasChildren(parentName) ? this.children[parentName] : [];
    },

    /**
     * @function getAllChildren
     * @return {Array}
     * @api public
     */

    getAllChildren: function () {
        return Object.keys(this.parents);
    }
};

/**
 * @function solveDependencies
 * @api internal
 */

var $solveDependencies = function () {
    $checkClasses();
    $checkSingles();

    // Always append CLASS modules before SINGLE modules.
    // CLASS modules should be instantiable inside the init
    // method of SINGLE modules.
    $appendSuperClasses();
    $appendSingles();

    // Alter CLASS.Main constructor after solving all dependencies.
    $wrapMain();
};

/**
 * Wrap the Main module inside a closure to prevent the creation
 * of multiple instances.
 *
 * @function wrapMain
 * @api internal
 */

var $wrapMain = function () {
    if (!$development) { return undefined; }

    CLASS.Main = (function () {
        var Main = CLASS.Main;
        var instance = null;

        return function () {
            if (instance !== null) {
                throwError('Cannot instantiate Main more than once.', 'MAIN', '');
            } else {
                instance = new Main();

                return instance;
            }
        };
    })();
};

/**
 * Validate all CLASS modules.
 *
 * @function checkClasses
 * @api internal
 */

var $checkClasses = function () {
    if (!$development) { return undefined; }

    $checkMain();
    $checkClassLinks();
    $checkClassStructures();
};

/**
 * Check if Main has been declared.
 *
 * @function checkMain
 * @api internal
 */

var $checkMain = function () {
    if (CLASS.Main === undefined) {
        throwError('Main does not exist.', 'MAIN', '');
    }
};

/**
 * Check for invalid parent child links.
 *
 * @function checkClassLinks
 * @api internal
 */

var $checkClassLinks = function () {
    var children = $hierarchy.getAllChildren();

    for (var i = 0, max = children.length; i < max; i++) {
        var childName = children[i];
        var parentName = $hierarchy.getParent(childName);

        var childExists = CLASS[childName] !== undefined;
        var parentExists = CLASS[parentName] !== undefined;

        if (!parentExists && !childExists) {
            throwError(parentName + ' and ' + childName + ' do not exist.', 'EXTEND', '');
        } else if (!parentExists) {
            throwError('Parent ' + parentName + ' does not exist for child ' + childName, 'EXTEND', '');
        } else if (!childExists) {
            throwError('Child ' + childName + ' does not exist for parent ' + parentName, 'EXTEND', '');
        }
    }
};

/**
 * Check the constructor and append of all CLASS modules.
 *
 * @function checkClassStructures
 * @api internal
 */

var $checkClassStructures = function () {
    var keys = Object.keys(CLASS);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];
        var module = CLASS[name];

        // CLASS modules must point to their constructor function.
        if (!isFunction(module)) {
            throwError('Invalid constructor.', 'CLASS', name);
        }

        // append must be an object literal.
        if (!isObject(module.append)) {
            throwError('Invalid append.', 'CLASS', name);
        }
    }
};

/**
 * Append all top level modules.
 *
 * @function appendSuperClasses
 * @api internal
 */

var $appendSuperClasses = function () {
    var keys = Object.keys(CLASS);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];

        if (!$hierarchy.hasParent(name)) {
            $appendClass('', name);
        }
    }
};


/**
 * @function appendClass
 * @param {String} parentName
 * @param {String} childName
 * @api internal
 */

var $appendClass = function (parentName, childName) {
    var child = CLASS[childName];

    // Assume that the parent of the child module is the CLASS object if
    // parentName is an empty string.
    var parent = isEmptyString(parentName) ? $classProto : CLASS[parentName];

    $linkClassPrototypes(parent, child);
    $defineClassProperties(parentName, childName, child);

    // Child modules will be appended recursively.
    $appendChildClasses(childName);

    // Prototype shorthand reference.
    _$_[childName] = child.prototype;
};

/**
 * Link the prototype of the parent to the child module.
 *
 * @function linkPrototypes
 * @param {String} parent
 * @param {String} child
 * @api internal
 */

var $linkClassPrototypes = function (parent, child) {
    // Link to the parent's prototype.
    child.prototype = Object.create(parent.prototype);

    // The append object overwrites any methods or properties the parent prototype has.
    var keys = Object.keys(child.append);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];

        child.prototype[name] = child.append[name];
    }

    child.append = undefined;
};

/**
 * Iterate and append all child modules.
 *
 * @function appendChildClasses
 * @param {String} parentName
 * @api internal
 */

var $appendChildClasses = function (parentName) {
    if (!$hierarchy.hasChildren(parentName)) { return undefined; }

    var children = $hierarchy.getChildren(parentName);

    for (var i = 0, max = children.length; i < max; i++) {
        var childName = children[i];

        $appendClass(parentName, childName);
    }
};

/**
 * Define special CLASS properties in module's prototype.
 *
 * @function defineClassProperties
 * @param {String} parentName
 * @param {String} childName
 * @param {Object} module
 * @api internal
 */

var $defineClassProperties = function (parentName, childName, module) {
    $descriptor.value = module;

    Object.defineProperty(module.prototype, 'constructor', $descriptor);

    $descriptor.value = parentName;

    Object.defineProperty(module.prototype, '$parentName', $descriptor);

    $descriptor.value = childName;

    Object.defineProperty(module.prototype, '$name', $descriptor);
};

/**
 * Validate all SINGLE modules.
 *
 * @function checkSingles
 * @api internal
 */

var $checkSingles = function () {
    if (!$development) { return undefined; }

    $checkSingleStructures();
};

/**
 * Check the data type and init method of all SINGLE modules.
 *
 * @function checkClassStructures
 * @api internal
 */

var $checkSingleStructures = function () {
    var keys = Object.keys(SINGLE);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];
        var module = SINGLE[name];

        // SINGLE modules must be an object literal.
        if (!isObject(module)) {
            throwError(name + ' must be [Object].', 'SINGLE', '');
        }

        // init must be a function.
        if (module.init !== undefined && !isFunction(module.init)) {
            throwError('init method in ' + name + ' must be [Function].', 'SINGLE', '');
        }
    }
};

/**
 * Append catena properties to all SINGLE modules and invoke init if declared.
 *
 * @function appendSingles
 * @api internal
 */

var $appendSingles = function () {
    var keys = Object.keys(SINGLE);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];
        var module = SINGLE[name];

        $defineSingleProperties(name, module);

        if (module.init !== undefined) {
            module.init();
        }
    }
};

/**
 * Define special SINGLE properties in module.
 *
 * @function defineSingleProperties
 * @param {String} name
 * @param {Object} module
 * @api internal
 */

var $defineSingleProperties = function (name, module) {
    $descriptor.value = $classProto.prototype.throwError;

    Object.defineProperty(module, 'throwError', $descriptor);

    $descriptor.value = name;

    Object.defineProperty(module, '$name', $descriptor);
};

/**
 * Make all modules immutable.
 *
 * @function freezeModules
 * @api internal
 */

var $freezeModules = function () {
    if (!$development) { return undefined; }

    $freezeConstObject(CONST);

    Object.freeze(_$_);
    Object.freeze(CLASS);
    Object.freeze(SINGLE);
};

/**
 * Freeze all properties inside CONST.
 *
 * @function freezeConstObject
 * @param {Object} obj
 * @api internal
 */

var $freezeConstObject = function (obj) {
    var keys = Object.keys(obj);

    for (var i = 0, max = keys.length; i < max; i++) {
        var name = keys[i];
        var value = obj[name];

        if (isObject(value)) {
            $freezeConstObject(value);
        } else if (isArray(value)) {
            $freezeConstArray(value);
        }
    }

    Object.freeze(obj);
};

/**
 * Recursively freeze all indexes in the array.
 *
 * @function freezeConstArray
 * @param {Array} arr
 * @api internal
 */

var $freezeConstArray = function (arr) {
    for (var i = 0, max = arr.length; i < max; i++) {
        var value = arr[i];

        if (isObject(value)) {
            $freezeConstObject(value);
        } else if (isArray(value)) {
            $freezeConstArray(value);
        }
    }

    Object.freeze(arr);
};

/**
 * Recursively inherit the constructor properties of parent modules.
 *
 * @function super
 * @api public
 */

$descriptor.value = (function () {
    var nodeName = ''; // Next parent in chain.
    var rootName = ''; // First child in chain.
    var descriptor = $descriptor;

    /**
     * @function resetChain
     * @api private
     */

    function resetChain () {
        nodeName = '';
        rootName = '';
    }

    /**
     * Check in which node the super chain is at.
     *
     * @function checkChain
     * @api private
     */

    function checkChain () {
        // If nodeName is an empty string, then start the chain from the
        // parent of the root child.
        if (isEmptyString(nodeName)) {
            nodeName = this.$parentName;

            // Even though super might be invoked in different constructors,
            // the same instance will always be referenced. rootName is used
            // to know if the chain has been broken.
            rootName = this.$name;

            // Prevent instance from having parent properties applied more than once.
            if (this.$applied) {
                throwError('Cannot invoke super twice for the same instance of ' + this.$name, 'SUPER', '');
            } else {
                descriptor.value = true;

                Object.defineProperty(this, '$applied', descriptor);
            }

        // Otherwise just move to next parent.
        } else {
            // Error out if chain is broken.
            if (this.$name !== rootName) {
                throwError('Chain started by ' + rootName + ' instance is being broken by ' + this.$name + ' instance.', 'SUPER', '');
            }

            nodeName = CLASS[nodeName].prototype.$parentName;
        }
    }

    /**
     * If the current node has parent, apply current node to
     * parent's constructor.
     *
     * @function applyNode
     * @param {Array} args
     * @api private
     */

    function applyNode (args) {
        if (isEmptyString(nodeName)) { return undefined; }

        var nextParent = CLASS[nodeName].prototype.$parentName;

        // Keep reference of node just in case chain gets reset.
        var temp = nodeName;

        // If there are no more parent nodes then reset chain.
        if (isEmptyString(nextParent)) {
            resetChain();
        }

        CLASS[temp].apply(this, args);
    }

    return function () {
        checkChain.call(this);
        applyNode.call(this, Array.prototype.slice.call(arguments));
    };
})();

Object.defineProperty($classProto.prototype, 'super', $descriptor);

/**
 * Error out program whenever abstract is invoked.
 *
 * @function abstract
 * @api public
 */

$descriptor.value = function () {
    var call = traceCallFromErrorStack(1).split('.');
    var message = '';

    // If only the module is being referred, then assume it is being
    // called from a constructor or directly.
    if (call.length === 1) {
        message = 'Cannot invoke abstract directly from instance or in constructor.';

    // Otherwise just print method name that has been flagged as abstract.
    } else {
        message = call[1] + ' is meant to be overwritten.';
    }

    throwError(message, 'ABSTRACT', this.$name);
};

Object.defineProperty($classProto.prototype, 'abstract', $descriptor);

/**
 * @function throwError
 * @param {String} message
 * @param {String} type
 * @api public
 */

$descriptor.value = function (message, type) {
    throwError(message, type, traceCallFromErrorStack(0));
};

Object.defineProperty($classProto.prototype, 'throwError', $descriptor);

/**
 * Validate data type.
 *
 * @function isNaN
 * @function isNull
 * @function isArray
 * @function isObject
 * @function isNumber
 * @function isString
 * @function isBoolean
 * @function isFunction
 * @function isInstance
 * @function isUndefined
 * @function isEmptyArray
 * @function isEmptyString
 * @param {*} arg
 * @return Boolean
 * @api public
 */

const isNaN = function (arg) {
    return Number.isNaN(arg);
};

const isNull = function (arg) {
    return arg === null;
};

const isArray = function (arg) {
    return Array.isArray(arg);
};

const isObject = function (arg) {
    return arg !== null && !isArray(arg) && typeof arg === 'object';
};

const isNumber = function (arg) {
    return !Number.isNaN(arg) && typeof arg === 'number';
};

const isString = function (arg) {
    return typeof arg === 'string';
};

const isBoolean = function (arg) {
    return typeof arg === 'boolean';
};

const isFunction = function (arg) {
    return typeof arg === 'function';
};

const isInstance = function (type, arg) {
    return arg instanceof type;
};

const isUndefined = function (arg) {
    return arg === undefined;
};

const isEmptyArray = function (arg) {
    return isArray(arg) && arg.length === 0;
};

const isEmptyString = function (arg) {
    return arg === '';
};

/**
 * Return clean call stack with CLASS and SINGLE methods.
 *
 * @function traceErrorStack
 * @param {Boolean} log
 * @return {Array}
 * @api public
 */

const traceErrorStack = function (log) {
    var e = new Error('');

    var clean = [];
    var stack = e.stack;

    // Regex Capture
    // CLASS.(ErrorStacker)
    // CLASS.(ErrorStacker).append(.trace)
    // SINGLE.(ErrorStacker)(.trace)
    var regex = /(?:CLASS|SINGLE)\.([\w]+)(?:\.append)?(\.[\w]+)?/g;
    var result = regex.exec(stack);

    while (result) {
        var module = result[1];
        var method = result[2];

        // Constructors reference the CLASS module itself.
        if (!method) {
            clean.push(module);
        } else {
            clean.push(module + method);
        }

        result = regex.exec(stack);
    }

    if (Boolean(log)) { console.log(stack); }

    return clean;
};

/**
 * Get index in error stack.
 *
 * @function traceCallFromErrorStack
 * @param {Number} index
 * @return {String}
 * @api public
 */

const traceCallFromErrorStack = function (index) {
    if (!isNumber(index) || index < 0) {
        index = 0;
    } else {
        index = Math.floor(index);
    }

    var stack = traceErrorStack(false);

    // Return empty string if out of bounds.
    return stack[index] !== undefined ? stack[index] : '';
};

/**
 * Throw error, all arguments are optional.
 *
 * @function throwError
 * @param {String} message
 * @param {String} type
 * @param {String} module
 * @api public
 */

const throwError = function (message, type, module) {
    message = isString(message) ? message : '';

    // Default to ERROR if not a string or empty string.
    type = isString(type) && type !== '' ? type : 'ERROR';

    // type is wrapped around curly brackets and uppercase.
    type = '{ ' + type.toUpperCase() + ' } ';

    if (!isString(module)) {
        var call = traceCallFromErrorStack(0);

        if (call !== '') {
            module = ' Module: ' + call;

        // No need to print ' Module: ' with empty string.
        } else {
            module = '';
        }
    } else if (module !== '') {
        module = ' Module: ' + module;
    }

    throw new Error(type + message + module);
};

/**
 * Create parent child link.
 *
 * @function extend
 * @param {String} parentName
 * @param {String} childName
 * @api public
 */

const extend = function (parentName, childName) {
    if ($development) {
        if (!$loading) {
            throwError('Prohibited to invoke extend after Main has been initialized.', 'EXTEND', '');
        }

        if (!isString(parentName)) {
            throwError('parentName must be [String].', 'EXTEND', '');
        }

        if (!isString(childName)) {
            throwError('childName must be [String].', 'EXTEND', '');
        }

        if (parentName === childName) {
            throwError('parentName and childName cannot have the same name: ' + parentName , 'EXTEND', '');
        }

        // Do not allow child to inherit from more than one parent.
        if ($hierarchy.hasParent(childName)) {
            throwError(parentName + ' cannot extend, ' + childName  + ' is already extending ' + $hierarchy.getParent(childName), 'EXTEND', '');
        }
    }

    $hierarchy.link(parentName, childName);
};
