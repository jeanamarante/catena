var acorn = require('acorn');

var hierarchy = {};
var nonHierarchicalNodes = [];

function isExpressionStatement (node) {
    return node.type === 'ExpressionStatement';
}

function isCallExpression (node) {
    return node.type === 'CallExpression';
}

function isAssignmentExpression (node) {
    return node.type === 'AssignmentExpression' && node.operator === '=';
}

function isMemberExpression (node) {
    return node.type === 'MemberExpression';
}

function isIdentifier (node) {
    return node.type === 'Identifier';
}

function createHierarchyNode (name) {
    if (hierarchy[name] !== undefined) { return undefined; }

    hierarchy[name] = {
        children: [],
        parentName: '',
        moduleAppend: null,
        moduleConstructor: null
    };
}

function createNonHierarchicalNode (content) {
    nonHierarchicalNodes.push({
        content: content
    });
}

function parseFile(grunt, filePath) {
    var content = grunt.file.read(filePath);

    var ast = acorn.parse(content, {
        sourceType: 'script',
        ecmaVersion: 6
    });

    var parseOne = parseExtend(ast);
    var parseTwo = parseClass(ast);

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

function parseClass (ast) {
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

    return content + '\x0A';
}

function concatenateClassAppend (name, node) {
    var content = '\x0A';

    return content + '\x0A';
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
