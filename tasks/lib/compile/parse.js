var path = require('path');
var acorn = require('acorn');

// All CLASS modules are stored here.
var hierarchy = {};

// Files that do not declare CLASS modules are stored here.
var nonHierarchicalNodes = [];

/**
 * @function isExpressionStatement
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isExpressionStatement (node) {
    return node.type === 'ExpressionStatement';
}

/**
 * @function isCallExpression
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isCallExpression (node) {
    return node.type === 'CallExpression';
}

/**
 * @function isAssignmentExpression
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isAssignmentExpression (node) {
    // Only check for AssignmentExpressions that only use the equals sign.
    return node.type === 'AssignmentExpression' && node.operator === '=';
}

/**
 * @function isMemberExpression
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isMemberExpression (node) {
    return node.type === 'MemberExpression';
}

/**
 * @function isIdentifier
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isIdentifier (node) {
    return node.type === 'Identifier';
}

/**
 * @function isProperty
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function isProperty (node) {
    return node.type === 'Property';
}

/**
 * Create hierarchy nodes for all CLASS modules.
 *
 * @function createHierarchyNode
 * @param {String} name
 * @api private
 */

function createHierarchyNode (name) {
    if (hierarchy[name] !== undefined) { return undefined; }

    hierarchy[name] = {
        content: '',            // Read file content.
        children: [],           // All parsed children in extend invocations.
        parentName: '',         // Parsed parent in extend invocation.
        moduleAppend: null,     // Append node in AST.
        moduleConstructor: null // Constructor Node in AST.
    };
}

/**
 * Append nodes that contain the content of files
 * that have no CLASS module declarations.
 *
 * @function createNonHierarchicalNode
 * @param {String} content
 * @api private
 */

function createNonHierarchicalNode (content) {
    nonHierarchicalNodes.push({
        content: content
    });
}

/**
 * Read file content and parse it for CLASS modules.
 *
 * @function parseFile
 * @param {Object} grunt
 * @param {String} filePath
 * @api private
 */

function parseFile(grunt, filePath) {
    var content = grunt.file.read(filePath);

    var ast = acorn.parse(content, {
        sourceType: 'script',
        ecmaVersion: 6
    });

    var parseOne = parseExtend(ast);
    var parseTwo = parseClass(ast, content);

    // If no extend invocation and no CLASS declaration is found,
    // then push file content into a non hierarchical node.
    if (!parseOne && !parseTwo) {
        createNonHierarchicalNode(content);
    }
}

/**
 * Iterate on top level expression statements for extend invocation.
 *
 * @function parseExtend
 * @param {Object} ast
 * @return {Boolean}
 * @api private
 */

function parseExtend (ast) {
    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        // Search for extend('Parent', 'Child');
        if (isExpressionStatement(node) && isCallExpression(node.expression) && node.expression.callee.name === 'extend') {
            node = node.expression;

            var parentName = node.arguments[0].value;
            var childName = node.arguments[1].value;

            createHierarchyNode(parentName);
            createHierarchyNode(childName);

            // Link child.
            hierarchy[parentName].children.push(childName);

            // Link parent.
            hierarchy[childName].parentName = parentName;

            return true;
        }
    }

    return false;
}

/**
 * Iterate on top level expression statements for CLASS constructor
 * and append assignment expressions.
 *
 * @function parseClass
 * @param {Object} ast
 * @param {String} content
 * @return {Boolean}
 * @api private
 */

function parseClass (ast, content) {
    var moduleAppend = null;
    var moduleAppendName = '';

    var moduleConstructor = null;
    var moduleConstructorName = '';

    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (!isExpressionStatement(node) || !isAssignmentExpression(node.expression)) { continue; }

        node = node.expression;

        // Search for constructor -> CLASS.Module = function () {};
        if (isIdentifier(node.left.object) && isIdentifier(node.left.property) && node.left.object.name === 'CLASS') {
            moduleConstructor = node;
            moduleConstructorName = node.left.property.name;

        // Search for append -> CLASS.Module.append = {};
        } else if (isMemberExpression(node.left.object)) {
            var subNode = node.left;

            if (isIdentifier(subNode.object.object) && isIdentifier(subNode.object.property)) {
                if (subNode.object.object.name !== 'CLASS' || subNode.property.name !== 'append') { continue; }

                moduleAppend = node;
                moduleAppendName = subNode.object.property.name;
            }
        }
    }

    // If no constructor or append node is found or if the constructor and
    // append name do not match then don't create the hierarchy node.
    if (moduleConstructor === null || moduleAppend === null) {
        return false;
    } else if (moduleConstructorName !== moduleAppendName) {
        return false;
    }

    createHierarchyNode(moduleConstructorName);

    var hierarchyNode = hierarchy[moduleConstructorName];

    // Store file content if CLASS module is parsed successfully.
    hierarchyNode.content = content;

    // Store constructor and append nodes for concatenation.
    hierarchyNode.moduleAppend = moduleAppend;
    hierarchyNode.moduleConstructor = moduleConstructor;

    return true;
}

/**
 * Concatenate all parsed modules into a single string.
 *
 * @function concatenateParsedModules
 * @return {String}
 * @api private
 */

function concatenateParsedModules () {
    var content = '';
    var moduleNames = Object.keys(hierarchy);

    for (var i = 0, max = moduleNames.length; i < max; i++) {
        var name = moduleNames[i];
        var node = hierarchy[name];

        // Recursively concatenate top level CLASS modules only.
        if (node.parentName === '') {
            content += concatenateClassModule(name, node);
        }
    }

    // Simply append all non hierarchical nodes after concatenating
    // all CLASS modules.
    content += concatenateNonHierarchicalNodes();

    // Always replace prototype shorthand declarations after all
    // content has been concatenated.
    content = replaceClassPrototypeShorthand(content);

    return content;
}

/**
 * Append recursively CLASS module hierarchy.
 *
 * @function concatenateClassModule
 * @param {String} name
 * @param {Object} node
 * @return {String}
 * @api private
 */

function concatenateClassModule (name, node) {
    // Append content for parent node before appending the content
    // of all the child nodes.
    var content = concatenateClassConstructor(name, node) + concatenateClassAppend(name, node);

    for (var i = 0, max = node.children.length; i < max; i++) {
        var childName = node.children[i];
        var childNode = hierarchy[childName];

        content += concatenateClassModule(childName, childNode);
    }

    return content;
}

/**
 * @function concatenateClassConstructor
 * @param {String} name
 * @param {Object} node
 * @return {String}
 * @api private
 */

function concatenateClassConstructor (name, node) {
    var content = '\x0A';
    var subString = node.content.substring(node.moduleConstructor.right.start, node.moduleConstructor.right.end);

    if (hierarchy[name].parentName !== '') {
        subString = replaceClassSuper(name, subString);
    }

    content += 'CLASS.' + name + ' = ' + subString + ';';

    return content + '\x0A';
}

/**
 * @function replaceClassSuper
 * @param {String} name
 * @param {String} content
 * @return {String}
 * @api private
 */

function replaceClassSuper (name, content) {
    var replaced = false;

    // Super invocation with no argument.
    // Regex Match: this.super()
    content = content.replace(/this\s*?\.\s*?super\s*?\(\s*?\)/, function (match) {
        replaced = true;

        return 'CLASS.' + hierarchy[name].parentName + '.call(this)';
    });

    // Only one regex has to match and replace.
    if (replaced) { return content; }

    // Super invocation with arguments.
    // Regex Match: this.super(
    content = content.replace(/this\s*?\.\s*?super\s*?\(/, function (match) {
        return 'CLASS.' + hierarchy[name].parentName + '.call(this, ';
    });

    return content;
}

/**
 * @function concatenateClassAppend
 * @param {String} name
 * @param {Object} node
 * @return {String}
 * @api private
 */

function concatenateClassAppend (name, node) {
    var content = '\x0A';

    // Start parent prototype wrap.
    content += 'CLASS.' + name + '.prototype = Object.create(CLASS.';

    // Concatenate module's parent name if it isn't an empty string.
    if (node.parentName !== '') {
        content += node.parentName + '.';
    }

    // End parent prototype wrap.
    content += 'prototype);\x0A\x0A';

    // The constructor property is the only one that is assigned automatically.
    content += 'CLASS.' + name + '.prototype.constructor = ' + 'CLASS.' + name + ';';
    content += concatenateClassAppendProperties(name, node);

    return content + '\x0A';
}

/**
 * @function concatenateClassAppendProperties
 * @param {String} name
 * @param {Object} node
 * @return {String}
 * @api private
 */

function concatenateClassAppendProperties (name, node) {
    var properties = node.moduleAppend.right.properties;
    var max = properties.length;

    if (max === 0) { return ''; }

    var content = '';

    for (var i = 0; i < max; i++) {
        var subNode = properties[i];

        if (!isProperty(subNode)) { continue; }

        content += '\x0A\x0A';
        content += 'CLASS.' + name + '.prototype.' + subNode.key.name + ' = ';
        content += node.content.substring(subNode.value.start, subNode.value.end) + ';';
    }

    return content;
}

/**
 * Replace all _$_ prototype shorthand references with the
 * standard prototype notation.
 *
 * @function replaceClassPrototypeShorthand
 * @param {String} content
 * @return {String}
 * @api private
 */

function replaceClassPrototypeShorthand (content) {
    // Regex Match: _$_.(Module)
    return content.replace(/\_\$\_\s*?\.\s*?([A-Za-z0-9\_]+)/g, function (match, $1) {
        return 'CLASS.' + $1 + '.prototype';
    });
}

/**
 * @function concatenateNonHierarchicalNodes
 * @return {String}
 * @api private
 */

function concatenateNonHierarchicalNodes () {
    var content = '';

    for (var i = 0, max = nonHierarchicalNodes.length; i < max; i++) {
        content += '\x0A' + nonHierarchicalNodes[i].content + '\x0A';
    }

    return content;
}

module.exports = function (grunt, task, taskData, tmpDir, srcFiles) {
    // Parse all modules before creating temporary file.
    for (var i = 0, max = srcFiles.length; i < max; i++) {
        parseFile(grunt, srcFiles[i]);
    }

    grunt.file.write(path.join(tmpDir, 'parsed-src-files.js'), concatenateParsedModules());
};
