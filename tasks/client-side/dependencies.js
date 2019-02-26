// Pointer to all CLASS module prototypes.
const _$_ = $development ? {} : undefined;

// Is catena still loading dependencies?
let $loading = true;

// Has an error been thrown manually before loading finishes?
let $errorThrown = false;

// Create reusable descriptor for object properties.
let $descriptor = {
    value: null,
    writable: false,
    enumerable: false,
    configurable: false
};

// Array for SINGLE modules that have the postInit method declared.
let $singlePostInitModules = [];

// Stores the links between parent and child modules.
let $hierarchy = (function () {
    if ($development) {
        return {
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
                let arr = this.children[parentName];

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
    } else {
        return undefined;
    }
}());

/**
 * @function solveDependencies
 * @api internal
 */

let $solveDependencies = function () {
    $checkClasses();
    $checkSingles();

    // Always append CLASS modules before SINGLE modules.
    // CLASS modules should be instantiable inside the init
    // method of SINGLE modules.
    $appendRootClasses();
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

let $wrapMain = function () {
    if (!$development) { return undefined; }

    CLASS.Main = (function () {
        let Main = CLASS.Main;
        let instance = null;

        return function () {
            if (!isNull(instance)) {
                throwError('Cannot instantiate Main more than once.', 'MAIN');
            } else {
                instance = new Main();

                return instance;
            }
        };
    }());
};

/**
 * Validate all CLASS modules.
 *
 * @function checkClasses
 * @api internal
 */

let $checkClasses = function () {
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

let $checkMain = function () {
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

let $checkClassLinks = function () {
    let children = $hierarchy.getAllChildren();

    for (let i = 0, max = children.length; i < max; i++) {
        let childName = children[i];
        let parentName = $hierarchy.getParent(childName);

        let childDoesNotExist = isUndefined(CLASS[childName]);
        let parentDoesNotExist = isUndefined(CLASS[parentName]);

        if (parentDoesNotExist && childDoesNotExist) {
            throwError(`${parentName} and ${childName} modules do not exist.`, 'EXTEND');
        } else if (parentDoesNotExist) {
            throwError(`Parent ${parentName} does not exist for child ${childName} module.`, 'EXTEND');
        } else if (childDoesNotExist) {
            throwError(`Child ${childName} does not exist for parent ${parentName} module.`, 'EXTEND');
        }
    }
};

/**
 * Check the constructor and append of all CLASS modules.
 *
 * @function checkClassStructures
 * @api internal
 */

let $checkClassStructures = function () {
    let keys = Object.keys(CLASS);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];

        if (name === 'prototype') { continue; }

        let classModule = CLASS[name];

        // CLASS modules must point to a constructor function.
        if (!isFunction(classModule)) {
            throwError(`${name} module has an invalid constructor.`, 'CLASS');
        }

        // append must be an object literal.
        if (!isObject(classModule.append)) {
            throwError(`${name} module has an invalid append.`, 'CLASS');
        }
    }
};

/**
 * Append all top level modules.
 *
 * @function appendRootClasses
 * @api internal
 */

let $appendRootClasses = function () {
    if (!$development) { return undefined; }

    let keys = Object.keys(CLASS);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];

        if (name !== 'prototype' && !$hierarchy.hasParent(name)) {
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

let $appendClass = function (parentName, childName) {
    let child = CLASS[childName];

    // Link to CLASS.prototype if parentName is empty. An empty
    // parentName indicates that the child has no parent.
    let parent = isEmptyString(parentName) ? CLASS : CLASS[parentName];

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
 * @function linkClassPrototypes
 * @param {Function} parent
 * @param {Function} child
 * @api internal
 */

let $linkClassPrototypes = function (parent, child) {
    // Link to the parent's prototype.
    child.prototype = Object.create(parent.prototype);

    // The append object overwrites any methods or properties the parent prototype has.
    let keys = Object.keys(child.append);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];

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

let $appendChildClasses = function (parentName) {
    if (!$hierarchy.hasChildren(parentName)) { return undefined; }

    let children = $hierarchy.getChildren(parentName);

    for (let i = 0, max = children.length; i < max; i++) {
        let childName = children[i];

        $appendClass(parentName, childName);
    }
};

/**
 * Define special CLASS properties in module's prototype.
 *
 * @function defineClassProperties
 * @param {String} parentName
 * @param {String} childName
 * @param {Function} childConstructor
 * @api internal
 */

let $defineClassProperties = function (parentName, childName, childConstructor) {
    $descriptor.value = parentName;

    Object.defineProperty(childConstructor.prototype, '$parentName', $descriptor);

    $descriptor.value = childName;

    Object.defineProperty(childConstructor.prototype, '$name', $descriptor);

    $descriptor.value = childConstructor;

    Object.defineProperty(childConstructor.prototype, 'constructor', $descriptor);
};

/**
 * Validate all SINGLE modules.
 *
 * @function checkSingles
 * @api internal
 */

let $checkSingles = function () {
    if (!$development) { return undefined; }

    $checkSingleStructures();
};

/**
 * Check the data type and init method of all SINGLE modules.
 *
 * @function checkSingleStructures
 * @api internal
 */

let $checkSingleStructures = function () {
    let keys = Object.keys(SINGLE);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];
        let singleModule = SINGLE[name];

        // SINGLE modules must be an object literal.
        if (!isObject(singleModule)) {
            throwError(`${name} module must be [Object]`, 'SINGLE');
        }

        // init and postInit must be a function if declared.
        if (!isUndefined(singleModule.init) && !isFunction(singleModule.init)) {
            throwError(`init method in ${name} module must be undefined or [Function]`, 'SINGLE');
        }

        if (!isUndefined(singleModule.postInit) && !isFunction(singleModule.postInit)) {
            throwError(`postInit method in ${name} module must be undefined or [Function]`, 'SINGLE');
        }
    }
};

/**
 * Append catena properties to all SINGLE modules and invoke init if declared.
 *
 * @function appendSingles
 * @api internal
 */

let $appendSingles = function () {
    let keys = Object.keys(SINGLE);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];
        let singleModule = SINGLE[name];

        if ($development) {
            $defineSingleProperties(name, singleModule);
        }

        // Invoke init method in SINGLE module if declared.
        if (!isUndefined(singleModule.init)) {
            singleModule.init();

            // Make init unreachable after being invoked.
            singleModule.init = undefined;
        }

        // Queue postInit methods and invoke them after all init methods are invoked.
        if (!isUndefined(singleModule.postInit)) {
            $singlePostInitModules.push(singleModule);
        }
    }

    $invokeSinglePostInits();
};

/**
 * Define special SINGLE properties in module.
 *
 * @function defineSingleProperties
 * @param {String} name
 * @param {Object} singleModule
 * @api internal
 */

let $defineSingleProperties = function (name, singleModule) {
    $descriptor.value = name;

    Object.defineProperty(singleModule, '$name', $descriptor);

    $descriptor.value = true;

    Object.defineProperty(singleModule, '$isSingle', $descriptor);
};

/**
 * Iterate and invoke all SINGLE modules that have the postInit method declared.
 *
 * @function invokeSinglePostInits
 * @api internal
 */

let $invokeSinglePostInits = function () {
    let singleModule = $singlePostInitModules.pop();

    while (!isUndefined(singleModule)) {
        singleModule.postInit();

        // Make postInit unreachable after being invoked.
        singleModule.postInit = undefined;

        singleModule = $singlePostInitModules.pop();
    }
};

/**
 * Make all modules immutable.
 *
 * @function freezeModules
 * @api internal
 */

let $freezeModules = function () {
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

let $freezeConstObject = function (obj) {
    let keys = Object.keys(obj);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];
        let value = obj[name];

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

let $freezeConstArray = function (arr) {
    for (let i = 0, max = arr.length; i < max; i++) {
        let value = arr[i];

        if (isObject(value)) {
            $freezeConstObject(value);
        } else if (isArray(value)) {
            $freezeConstArray(value);
        }
    }

    Object.freeze(arr);
};
