/**
 * Return positive integer.
 *
 * @function clampErrorStackIndex
 * @param {Number} index
 * @return {Number}
 * @api public
 */

const clampErrorStackIndex = function (index) {
    return isNumber(index) && index >= 0 ? Math.floor(index) : 0;
};

/**
 * Return clean call stack with invoked CLASS and SINGLE methods.
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

    // SINGLE modules might get picked as normal objects in error stack.
    // So check for Object in first capture group and assume it is a SINGLE.
    // Regex Capture Examples:
    // (TYPE).(Module)(.method)
    // (CLASS).(ErrorStacker)
    // (CLASS).(ErrorStacker).append(.trace)
    // (SINGLE).(ErrorStacker)(.trace)
    // (Object).(trace)
    var regex = /(CLASS|SINGLE|Object)\.([\w]+)(?:\.append)?(\.[\w]+)?/g;
    var result = regex.exec(stack);

    while (!isNull(result)) {
        var first = result[1];
        var second = result[2];
        // The third capture group might return undefined.
        var third = isString(result[3]) ? result[3] : '';

        // SINGLEs in stack print as Object. Object will be changed
        // to the name of the SINGLE module provided as an argument
        // in the traceCallFromErrorStack function.
        if (first === 'Object') {
            clean.push(first + '.' + second);

        // Otherwise do not show module type in stack.
        } else {
            // '.CLASS' will be captured as method if error is thrown in
            // the constructor of a CLASS module while invoking super.
            // Example: (CLASS).(Child)(.CLASS).Parent
            if (third === '.CLASS') {
                clean.push(second);
            } else {
                clean.push(second + third);
            }
        }

        result = regex.exec(stack);
    }

    if (Boolean(log)) { console.log(stack); }

    return clean;
};

/**
 * Get call in error stack.
 *
 * @function traceCallFromErrorStack
 * @param {Object} module
 * @param {Number} index
 * @return {String}
 * @api public
 */

const traceCallFromErrorStack = function (module, index) {
    index = clampErrorStackIndex(index);

    var stack = traceErrorStack(false);
    var call = stack[index];

    // Return empty string if out of bounds.
    if (isUndefined(call)) {
        return '';
    } else {
        var names = call.split('.');

        // Change Object to single module's name.
        if (names[0] === 'Object' && isObject(module) && module.$isSingle) {
            call = module.$name + '.' + names[1];
        }

        return call;
    }
};

/**
 * Throw error, all arguments are optional.
 *
 * @function throwError
 * @param {String} message
 * @param {String} type
 * @param {Object} module
 * @param {Number} index
 * @api public
 */

const throwError = (function () {
    if ($development) {
        return function (message, type, module, index) {
            if ($loading === true) {
                $errorThrown = true;
            }

            message = isString(message) ? message : '';

            // Default to ERROR if not a string or empty string.
            type = isString(type) && !isEmptyString(type) ? type : 'ERROR';

            // type is wrapped around curly brackets and is uppercase.
            type = '{ ' + type.toUpperCase() + ' } ';

            var call = traceCallFromErrorStack(module, index);
            var calledModule = !isEmptyString(call) ? ' Module: ' + call : '';

            throw new Error(type + message + calledModule);
        };
    } else {
        return function (message, type, module, index) {};
    }
})();

/**
 * Throw pretty argument error messages.
 *
 * @function throwArgumentError
 * @param {String} name
 * @param {String} type
 * @param {Object} module
 * @param {Number} index
 * @api public
 */

const throwArgumentError = function (name, type, module, index) {
    throwError(name + ' must be [' + type + ']', 'ARG', module, index);
};

/**
 * Create parent child link.
 *
 * @function extend
 * @param {String} parentName
 * @param {String} childName
 * @api public
 */

const extend = (function () {
    if ($development) {
        return function (parentName, childName) {
            if (isUndefined($loading)) {
                throwError('Prohibited to invoke extend after Main has been initialized.', 'EXTEND');
            }

            var invalidChild = !isString(childName);
            var invalidParent = !isString(parentName);

            if (invalidParent && invalidChild) {
                throwError('parentName and childName must be [String]', 'EXTEND');
            }

            if (invalidParent) {
                throwError('parentName for child ' + childName + ' module must be [String]', 'EXTEND');
            }

            if (invalidChild) {
                throwError('childName for parent ' + parentName + ' module must be [String]', 'EXTEND');
            }

            if (parentName === childName) {
                throwError('parentName and childName cannot share the same name: ' + parentName , 'EXTEND');
            }

            // Do not allow child to inherit from more than one parent.
            if ($hierarchy.hasParent(childName)) {
                throwError(childName + ' cannot extend ' + parentName + ' as it is already extending the ' + $hierarchy.getParent(childName) + ' module.', 'EXTEND');
            }

            $hierarchy.link(parentName, childName);
        };
    } else {
        return function (parentName, childName) {};
    }
})();

/**
 * Validate data type.
 *
 * @function isNaN
 * @function isNull
 * @function isArray
 * @function isEmptyArray
 * @function isNonEmptyArray
 * @function isObject
 * @function isNumber
 * @function isString
 * @function isEmptyString
 * @function isNonEmptyString
 * @function isBoolean
 * @function isFunction
 * @function isUndefined
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

const isEmptyArray = function (arg) {
    return isArray(arg) && arg.length === 0;
};

const isNonEmptyArray = function (arg) {
    return isArray(arg) && arg.length > 0;
};

const isObject = function (arg) {
    return !isNull(arg) && !isArray(arg) && typeof arg === 'object';
};

const isNumber = function (arg) {
    return !isNaN(arg) && typeof arg === 'number';
};

const isString = function (arg) {
    return typeof arg === 'string';
};

const isEmptyString = function (arg) {
    return arg === '';
};

const isNonEmptyString = function (arg) {
    return isString(arg) && !isEmptyString(arg);
};

const isBoolean = function (arg) {
    return typeof arg === 'boolean';
};

const isFunction = function (arg) {
    return typeof arg === 'function';
};

const isUndefined = function (arg) {
    return arg === undefined;
};

/**
 * @function isInstance
 * @param {*} type
 * @param {*} arg
 * @return Boolean
 * @api public
 */

const isInstance = function (type, arg) {
    return arg instanceof type;
};

/**
 * Check data type and error out if data type fails test.
 *
 * @function testArray
 * @function testEmptyArray
 * @function testNonEmptyArray
 * @function testObject
 * @function testNumber
 * @function testString
 * @function testEmptyString
 * @function testNonEmptyString
 * @function testBoolean
 * @function testFunction
 * @param {*} arg
 * @param {String} argName
 * @param {Object} module
 * @param {Number} errorIndex
 * @api public
 */

const testArray = function (arg, argName, module, errorIndex) {
    if (!isArray(arg)) {
        throwArgumentError(argName, 'Array', module, errorIndex);
    }
};

const testEmptyArray = function (arg, argName, module, errorIndex) {
    if (!isEmptyArray(arg)) {
        throwError(argName + ' has to be empty array.', 'ARG', module, errorIndex);
    }
};

const testNonEmptyArray = function (arg, argName, module, errorIndex) {
    if (!isNonEmptyArray(arg)) {
        throwError(argName + ' has to be non empty array.', 'ARG', module, errorIndex);
    }
};

const testObject = function (arg, argName, module, errorIndex) {
    if (!isObject(arg)) {
        throwArgumentError(argName, 'Object', module, errorIndex);
    }
};

const testNumber = function (arg, argName, module, errorIndex) {
    if (!isNumber(arg)) {
        throwArgumentError(argName, 'Number', module, errorIndex);
    }
};

const testString = function (arg, argName, module, errorIndex) {
    if (!isString(arg)) {
        throwArgumentError(argName, 'String', module, errorIndex);
    }
};

const testEmptyString = function (arg, argName, module, errorIndex) {
    if (!isEmptyString(arg)) {
        throwError(argName + ' has to be empty string.', 'ARG', module, errorIndex);
    }
};

const testNonEmptyString = function (arg, argName, module, errorIndex) {
    if (!isNonEmptyString(arg)) {
        throwError(argName + ' has to be non empty string.', 'ARG', module, errorIndex);
    }
};

const testBoolean = function (arg, argName, module, errorIndex) {
    if (!isBoolean(arg)) {
        throwArgumentError(argName, 'Boolean', module, errorIndex);
    }
};

const testFunction = function (arg, argName, module, errorIndex) {
    if (!isFunction(arg)) {
        throwArgumentError(argName, 'Function', module, errorIndex);
    }
};

/**
 * @function testInstance
 * @function testOptionalInstance
 * @param {*} type
 * @param {*} arg
 * @param {String} typeName
 * @param {String} argName
 * @param {Object} module
 * @param {Number} errorIndex
 * @api public
 */

const testInstance = function (type, arg, typeName, argName, module, errorIndex) {
    if (!isInstance(type, arg)) {
        throwArgumentError(argName, typeName, module, errorIndex);
    }
};

const testOptionalInstance = function (type, arg, typeName, argName, module, errorIndex) {
    // Optional instances can be either null or the declared type, but
    // they can never be undefined.
    if (!isNull(arg) && !isInstance(type, arg)) {
        throwError(argName + ' must be null or [' + typeName + ']', 'ARG', module, errorIndex);
    }
};
