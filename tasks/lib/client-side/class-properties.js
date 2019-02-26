// Helper methods for all CLASS modules are stored here.
CLASS.prototype = Object.create(Object.prototype);

// Only define these CLASS properties when in development mode.
if ($development) {
    // CLASS flag.
    $descriptor.value = true;

    Object.defineProperty(CLASS.prototype, '$isClass', $descriptor);

    /**
     * Recursively inherit the properties declared in the constructor of parent modules.
     *
     * @function CLASS.super
     * @param {...*} args
     * @api public
     */

    $descriptor.value = (function () {
        let nodeName = ''; // Next parent in chain.
        let rootName = ''; // First child in chain.
        let descriptor = $descriptor;

        /**
         * @function resetNames
         * @api private
         */

        function resetNames () {
            nodeName = '';
            rootName = '';
        }

        /**
         * Check in which node the super chain is at.
         *
         * @function referenceParentNode
         * @api private
         */

        function referenceParentNode () {
            // If nodeName is an empty string, then reference the parent of the root child.
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
         * @function applyParentNode
         * @param {Array} args
         * @api private
         */

        function applyParentNode (args) {
            if (isEmptyString(nodeName)) { return undefined; }

            let nextParent = CLASS[nodeName].prototype.$parentName;

            // Keep reference of the node's name just in case the chain gets reset.
            let tmpName = nodeName;

            // If there are no more parent nodes then reset the chain.
            if (isEmptyString(nextParent)) {
                resetNames();
            }

            CLASS[tmpName].apply(this, args);
        }

        return function (...args) {
            referenceParentNode.call(this);
            applyParentNode.call(this, args);
        };
    })();

    Object.defineProperty(CLASS.prototype, 'super', $descriptor);
}

/**
 * Error out program whenever abstract is invoked.
 *
 * @function CLASS.abstract
 * @api public
 */

$descriptor.value = (function () {
    if ($development) {
        return function () {
            let call = traceCallFromErrorStack(this, 1).split('.');
            let message = '';

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
