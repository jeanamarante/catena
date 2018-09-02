// Pointer to all CLASS module prototypes.
const _$_ = $development ? {} : undefined;

// Is catena still loading dependencies?
var $loading = true;

// Has an error been thrown manually before loading finishes?
var $errorThrown = false;

// Helper methods for CLASS modules. All CLASS modules
// link their prototypes to all the functions declared here.
var $rootClassProto = { prototype: {} };

// Create reusable descriptor for object properties.
var $descriptor = {
    value: null,
    writable: false,
    enumerable: false,
    configurable: false
};

// Array for SINGLE modules that have the postInit method declared.
var $singlePostInitModules = [];

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
        if (isUndefined(arr)) {
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
        return !isUndefined(this.parents[childName]);
    },

    /**
     * @function hasChildren
     * @return {Boolean}
     * @api public
     */

    hasChildren: function (parentName) {
        return !isUndefined(this.children[parentName]);
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
            if (!isNull(instance)) {
                throwError('Cannot instantiate Main more than once.', 'MAIN');
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
    if (isUndefined(CLASS.Main)) {
        throwError('Main does not exist.', 'MAIN');
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

        var childDoesNotExist = isUndefined(CLASS[childName]);
        var parentDoesNotExist = isUndefined(CLASS[parentName]);

        if (parentDoesNotExist && childDoesNotExist) {
            throwError(parentName + ' and ' + childName + ' modules do not exist.', 'EXTEND');
        } else if (parentDoesNotExist) {
            throwError('Parent ' + parentName + ' does not exist for child ' + childName + ' module.', 'EXTEND');
        } else if (childDoesNotExist) {
            throwError('Child ' + childName + ' does not exist for parent ' + parentName + ' module.', 'EXTEND');
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

        // CLASS modules must point to a constructor function.
        if (!isFunction(module)) {
            throwError(name + ' module has an invalid constructor.', 'CLASS');
        }

        // append must be an object literal.
        if (!isObject(module.append)) {
            throwError(name + ' module has an invalid append.', 'CLASS');
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
    if (!$development) { return undefined; }

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

    // Link to $rootClassProto if no parentName is provided. An empty
    // parentName indicates that the child has no declared parent.
    var parent = isEmptyString(parentName) ? $rootClassProto : CLASS[parentName];

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
            throwError(name + ' module must be [Object]', 'SINGLE');
        }

        // init and postInit must be a function if declared.
        if (!isUndefined(module.init) && !isFunction(module.init)) {
            throwError('init method in ' + name + ' module must be undefined or [Function]', 'SINGLE');
        }

        if (!isUndefined(module.postInit) && !isFunction(module.postInit)) {
            throwError('postInit method in ' + name + ' module must be undefined or [Function]', 'SINGLE');
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

        if ($development) {
            $defineSingleProperties(name, module);
        }

        // Invoke init method in SINGLE module if declared.
        if (!isUndefined(module.init)) {
            module.init();

            // Make init unreachable after being invoked.
            module.init = undefined;
        }

        // Queue postInit methods and invoke them after all init methods are invoked.
        if (!isUndefined(module.postInit)) {
            $singlePostInitModules.push(module);
        }
    }

    $invokeSinglePostInits();
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
    $descriptor.value = name;

    Object.defineProperty(module, '$name', $descriptor);

    $descriptor.value = true;

    Object.defineProperty(module, '$isSingle', $descriptor);
};

/**
 * Iterate and invoke all SINGLE modules that have the postInit method declared.
 *
 * @function invokeSinglePostInits
 * @api internal
 */

var $invokeSinglePostInits = function () {
    var module = $singlePostInitModules.pop();

    while (!isUndefined(module)) {
        module.postInit();

        // Make postInit unreachable after being invoked.
        module.postInit = undefined;

        module = $singlePostInitModules.pop();
    }
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
