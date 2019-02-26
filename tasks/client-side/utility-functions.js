/**
 * Return clean call stack with invoked CLASS and SINGLE methods.
 *
 * @function traceErrorStack
 * @param {Boolean} log
 * @return {Array}
 * @api public
 */

const traceErrorStack = (function () {
    if ($development) {
        return function () {
            let stack = new Error('').stack;
            let cleanStack = [];

            // SINGLE modules might get picked as normal objects in error stack.
            // So check for Object in first capture group and assume it is a SINGLE.
            // Regex Capture Examples:
            // (TYPE).(Module)(.method)
            // (CLASS).(ErrorStacker)
            // (CLASS).(ErrorStacker).append(.trace)
            // (SINGLE).(ErrorStacker)(.trace)
            // (Object).(trace)
            let regex = /(CLASS|SINGLE|Object)\.([\w]+)(?:\.append)?(\.[\w]+)?/g;
            let result = regex.exec(stack);

            while (!isNull(result)) {
                let first = result[1];
                let second = result[2];
                // The third capture group might return undefined.
                let third = isString(result[3]) ? result[3] : '';

                // SINGLEs in stack print as Object. Object will be changed
                // to the name of the SINGLE module provided as an argument
                // in the traceCallFromErrorStack function.
                if (first === 'Object') {
                    cleanStack.push(first + '.' + second);

                // Otherwise do not show module type in stack.
                } else {
                    // '.CLASS' will be captured as method if error is thrown in
                    // the constructor of a CLASS module while invoking super.
                    // Example: (CLASS).(Child)(.CLASS).Parent
                    if (third === '.CLASS') {
                        cleanStack.push(second);
                    } else {
                        cleanStack.push(second + third);
                    }
                }

                result = regex.exec(stack);
            }

            return cleanStack;
        };
    } else {
        return function () { return []; };
    }
}());

/**
 * Get call in error stack.
 *
 * @function traceCallFromErrorStack
 * @param {Object} instance
 * @param {Number} index
 * @return {String}
 * @api public
 */

const traceCallFromErrorStack = (function () {
    if ($development) {
        return function (instance = {}, index = 0) {
            if (!isObject(instance)) { return ''; }

            let call = traceErrorStack()[index];

            if (isUndefined(call)) {
                return '';
            } else {
                let names = call.split('.');

                // Change Object to single module's name.
                if (names[0] === 'Object' && instance.$isSingle) {
                    call = instance.$name + '.' + names[1];
                }

                return call;
            }
        };
    } else {
        return function (instance = {}, index = 0) { return ''; };
    }
}());

/**
 * Throw error, all arguments are optional.
 *
 * @function throwError
 * @param {String} message
 * @param {String} type
 * @param {Object} instance
 * @param {Number} index
 * @api public
 */

const throwError = (function () {
    if ($development) {
        return function (message = '', type = 'ERROR', instance = {}, index = 0) {
            if ($loading === true) {
                $errorThrown = true;
            }

            // type is always wrapped around curly brackets and uppercase.
            type = '{ ' + String(type).toUpperCase() + ' } ';

            let call = traceCallFromErrorStack(instance, index);
            let calledModule = !isEmptyString(call) ? ' Module: ' + call : '';

            throw new Error(type + String(message) + calledModule);
        };
    } else {
        return function (message = '', type = 'ERROR', instance = {}, index = 0) {};
    }
}());

/**
 * Throw pretty argument error messages.
 *
 * @function throwArgumentError
 * @param {String} name
 * @param {String} type
 * @param {Object} instance
 * @param {Number} index
 * @api public
 */

const throwArgumentError = function (name = 'argument', type = '', instance = {}, index = 0) {
    throwError(`${String(name)} must be [${String(type)}]`, 'ARG', instance, index);
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

            let invalidChild = !isString(childName);
            let invalidParent = !isString(parentName);

            if (invalidParent && invalidChild) {
                throwError('parentName and childName must be [String]', 'EXTEND');
            }

            if (invalidParent) {
                throwError(`parentName for child ${childName} module must be [String]`, 'EXTEND');
            }

            if (invalidChild) {
                throwError(`childName for parent ${parentName} module must be [String]`, 'EXTEND');
            }

            if (parentName === childName) {
                throwError(`parentName and childName cannot share the same name: ${parentName}`, 'EXTEND');
            }

            // Do not allow child to inherit from more than one parent.
            if ($hierarchy.hasParent(childName)) {
                throwError(`${childName} cannot extend ${parentName} as it is already extending the ${$hierarchy.getParent(childName)} module.`, 'EXTEND');
            }

            $hierarchy.link(parentName, childName);
        };
    } else {
        return function (parentName, childName) {};
    }
}());

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
 * Validate data type and throw error if validation fails.
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
 * @param {Object} instance
 * @param {Number} errorIndex
 * @api public
 */

const testArray = function (arg, argName, instance, errorIndex) {
    if (!isArray(arg)) {
        throwArgumentError(argName, 'Array', instance, errorIndex);
    }
};

const testEmptyArray = function (arg, argName = 'argument', instance, errorIndex) {
    if (!isEmptyArray(arg)) {
        throwError(`${String(argName)} has to be empty array.`, 'ARG', instance, errorIndex);
    }
};

const testNonEmptyArray = function (arg, argName = 'argument', instance, errorIndex) {
    if (!isNonEmptyArray(arg)) {
        throwError(`${String(argName)} has to be non empty array.`, 'ARG', instance, errorIndex);
    }
};

const testObject = function (arg, argName, instance, errorIndex) {
    if (!isObject(arg)) {
        throwArgumentError(argName, 'Object', instance, errorIndex);
    }
};

const testNumber = function (arg, argName, instance, errorIndex) {
    if (!isNumber(arg)) {
        throwArgumentError(argName, 'Number', instance, errorIndex);
    }
};

const testString = function (arg, argName, instance, errorIndex) {
    if (!isString(arg)) {
        throwArgumentError(argName, 'String', instance, errorIndex);
    }
};

const testEmptyString = function (arg, argName = 'argument', instance, errorIndex) {
    if (!isEmptyString(arg)) {
        throwError(`${String(argName)} has to be empty string.`, 'ARG', instance, errorIndex);
    }
};

const testNonEmptyString = function (arg, argName = 'argument', instance, errorIndex) {
    if (!isNonEmptyString(arg)) {
        throwError(`${String(argName)} has to be non empty string.`, 'ARG', instance, errorIndex);
    }
};

const testBoolean = function (arg, argName, instance, errorIndex) {
    if (!isBoolean(arg)) {
        throwArgumentError(argName, 'Boolean', instance, errorIndex);
    }
};

const testFunction = function (arg, argName, instance, errorIndex) {
    if (!isFunction(arg)) {
        throwArgumentError(argName, 'Function', instance, errorIndex);
    }
};

/**
 * @function testInstance
 * @function testOptionalInstance
 * @param {*} type
 * @param {*} arg
 * @param {String} typeName
 * @param {String} argName
 * @param {Object} instance
 * @param {Number} errorIndex
 * @api public
 */

const testInstance = function (type, arg, typeName, argName, instance, errorIndex) {
    if (!isInstance(type, arg)) {
        throwArgumentError(argName, typeName, instance, errorIndex);
    }
};

const testOptionalInstance = function (type, arg, typeName = '', argName = 'argument', instance, errorIndex) {
    // Optional instances can be either null or the declared type.
    if (!isNull(arg) && !isInstance(type, arg)) {
        throwError(`${String(argName)} must be null or [${String(typeName)}]`, 'ARG', instance, errorIndex);
    }
};
