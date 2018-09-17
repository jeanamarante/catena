var path = require('path');
var acorn = require('acorn');

// All CLASS modules are stored here.
var hierarchy = {};

// Files that do not declare CLASS modules are stored here.
var nonHierarchicalNodes = [];

/**
 * @function isExpressionStatement
 * @param {Object} node
 * @return Boolean
 * @api private
 */

function isExpressionStatement (node) {
    return node.type === 'ExpressionStatement';
}

/**
 * @function isCallExpression
 * @param {Object} node
 * @return Boolean
 * @api private
 */

function isCallExpression (node) {
    return node.type === 'CallExpression';
}

/**
 * @function isAssignmentExpression
 * @param {Object} node
 * @return Boolean
 * @api private
 */

function isAssignmentExpression (node) {
    // Only check for AssignmentExpressions that only use the equals sign.
    return node.type === 'AssignmentExpression' && node.operator === '=';
}

/**
 * @function isMemberExpression
 * @param {Object} node
 * @return Boolean
 * @api private
 */

function isMemberExpression (node) {
    return node.type === 'MemberExpression';
}

/**
 * @function isIdentifier
 * @param {Object} node
 * @return Boolean
 * @api private
 */

function isIdentifier (node) {
    return node.type === 'Identifier';
}

/**
 * @function isProperty
 * @param {Object} node
 * @return Boolean
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

function parseExtend (ast) {
    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (isExpressionStatement(node) && isCallExpression(node.expression) && node.expression.callee.name === 'extend') {
            node = node.expression;

            var parentName = node.arguments[0].value;
            var childName = node.arguments[1].value;

            createHierarchyNode(parentName);
            createHierarchyNode(childName);

            hierarchy[parentName].children.push(childName);

            hierarchy[childName].parentName = parentName;

            return true;
        }
    }

    return false;
}

function parseClass (ast, content) {
    var moduleAppend = null;
    var moduleAppendName = '';

    var moduleConstructor = null;
    var moduleConstructorName = '';

    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (!isExpressionStatement(node) || !isAssignmentExpression(node.expression)) { continue; }

        node = node.expression;

        if (isIdentifier(node.left.object) && isIdentifier(node.left.property) && node.left.object.name === 'CLASS') {
            moduleConstructor = node;
            moduleConstructorName = node.left.property.name;

        } else if (isMemberExpression(node.left.object)) {
            var subNode = node.left;

            if (isIdentifier(subNode.object.object) && isIdentifier(subNode.object.property)) {
                if (subNode.object.object.name !== 'CLASS' || subNode.property.name !== 'append') { continue; }

                moduleAppend = node;
                moduleAppendName = subNode.object.property.name;
            }
        }
    }

    if (moduleConstructor === null || moduleAppend === null) {
        return false;
    } else if (moduleConstructorName !== moduleAppendName) {
        return false;
    }

    createHierarchyNode(moduleConstructorName);

    var hierarchyNode = hierarchy[moduleConstructorName];

    hierarchyNode.content = content;
    hierarchyNode.moduleAppend = moduleAppend;
    hierarchyNode.moduleConstructor = moduleConstructor;

    return true;
}

function concatenateParsedModules () {
    var content = '';
    var moduleNames = Object.keys(hierarchy);

    for (var i = 0, max = moduleNames.length; i < max; i++) {
        var name = moduleNames[i];
        var node = hierarchy[name];

        if (node.parentName === '') {
            content += concatenateClassModule(name, node);
        }
    }

    content += concatenateNonHierarchicalModules();

    content = content.replace(/\_\$\_\s*?\.\s*?([A-Za-z0-9\_]+)/g, function (match, $1) {
        return 'CLASS.' + $1 + '.prototype';
    });

    return content;
}

function concatenateClassModule (name, node) {
    var content = concatenateClassConstructor(name, node) + concatenateClassAppend(name, node);

    for (var i = 0, max = node.children.length; i < max; i++) {
        var childName = node.children[i];
        var childNode = hierarchy[childName];

        content += concatenateClassModule(childName, childNode);
    }

    return content;
}

function concatenateClassConstructor (name, node) {
    var content = '\x0A';
    var subString = node.content.substring(node.moduleConstructor.right.start, node.moduleConstructor.right.end);

    if (hierarchy[name].parentName !== '') {
        subString = replaceClassSuper(name, subString);
    }

    content += 'CLASS.' + name + ' = ' + subString + ';';

    return content + '\x0A';
}

function replaceClassSuper (name, content) {
    var replaced = false;

    content = content.replace(/this\s*?\.\s*?super\s*?\(\s*?\)/, function (match) {
        replaced = true;

        return 'CLASS.' + hierarchy[name].parentName + '.call(this)';
    });

    if (replaced) { return content; }

    content = content.replace(/this\s*?\.\s*?super\s*?\(/, function (match) {
        return 'CLASS.' + hierarchy[name].parentName + '.call(this, ';
    });

    return content;
}

function concatenateClassAppend (name, node) {
    var content = '\x0A';

    content += 'CLASS.' + name + '.prototype = ';

    if (node.parentName === '') {
        content += 'Object.create(CLASS.prototype);\x0A\x0A';
    } else {
        content += 'Object.create(CLASS.' + node.parentName + '.prototype);\x0A\x0A';
    }

    content += 'CLASS.' + name + '.prototype.constructor = ' + 'CLASS.' + name + ';';
    content += concatenateClassAppendProperties(name, node);

    return content + '\x0A';
}

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

function concatenateNonHierarchicalModules () {
    var content = '';

    for (var i = 0, max = nonHierarchicalNodes.length; i < max; i++) {
        content += '\x0A' + nonHierarchicalNodes[i].content + '\x0A';
    }

    return content;
}

module.exports = function (grunt, task, taskData, tmpDir, srcFiles) {
    for (var i = 0, max = srcFiles.length; i < max; i++) {
        parseFile(grunt, srcFiles[i]);
    }

    grunt.file.write(path.join(tmpDir, 'parsed-src-files.js'), concatenateParsedModules());
};
