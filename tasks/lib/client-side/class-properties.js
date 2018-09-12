// Helper methods for all CLASS modules are stored here.
CLASS.prototype = Object.create(Object.prototype);

/**
 * Recursively inherit the constructor properties of parent modules.
 *
 * @function super
 * @api public
 */

$descriptor.value = (function () {
    if (!$development) {
        var nodePrototype = null;

        return function () {
            if (isNull(nodePrototype)) {
                nodePrototype = Object.getPrototypeOf(Object.getPrototypeOf(this));
            } else {
                nodePrototype = Object.getPrototypeOf(nodePrototype);
            }

            if (nodePrototype === CLASS.prototype) {
                nodePrototype = null;
            } else {
                nodePrototype.constructor.apply(this, Array.prototype.slice.call(arguments));
            }
        };
    }

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
                throwError('Cannot invoke super more than once for ' + this.$name + ' instance.', 'SUPER');
            } else {
                descriptor.value = true;

                Object.defineProperty(this, '$applied', descriptor);
            }

        // Otherwise just move to next parent.
        } else {
            // Error out if chain is broken.
            if (this.$name !== rootName) {
                throwError('Chain started by ' + rootName + ' instance is being broken by ' + this.$name + ' instance.', 'SUPER');
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

Object.defineProperty(CLASS.prototype, 'super', $descriptor);

/**
 * Error out program whenever abstract is invoked.
 *
 * @function abstract
 * @api public
 */

$descriptor.value = (function () {
    if ($development) {
        return function () {
            var call = traceCallFromErrorStack(this, 1).split('.');
            var message = '';

            // abstract can only be invoked inside the methods of CLASS module instances.
            if (this.$name !== call[0]) {
                message = 'Cannot invoke abstract directly from ' + this.$name + ' instance.';
            } else if (call.length === 1) {
                message = 'Cannot invoke abstract inside a constructor.';
            } else {
                message = 'Invoked method is meant to be overwritten.';
            }

            throwError(message, 'ABSTRACT', this, 1);
        };
    } else {
        return function () {};
    }
})();

Object.defineProperty(CLASS.prototype, 'abstract', $descriptor);

if ($development) {
    // CLASS flag.
    $descriptor.value = true;

    Object.defineProperty(CLASS.prototype, '$isClass', $descriptor);
}
