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
        append: null,
        children: [],
        filePath: '',
        parentName: '',
        constructor: null
    };
}

function createNonHierarchicalNode (content, filePath) {
    nonHierarchicalNodes.push({
        content: content,
        filePath: filePath
    });
}

function parseFile(grunt, filePath) {
    var content = grunt.file.read(filePath);

    var ast = acorn.parse(content, {
        sourceType: 'script',
        ecmaVersion: 6
    });

    if (filePath === 'js/Main.js') {
        var parseOne = parseExtend(ast);
        var parseTwo = parseClass(ast, filePath);

        if (!parseOne && !parseTwo) {
            createNonHierarchicalNode(content, filePath);
        }
    }
}

function parseExtend (ast) {
    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (isExpressionStatement(node) && isCallExpression(node.expression)) {
            node = node.expression;

            if (node.callee.name === 'extend') {
                var parentName = node.arguments[0].value;
                var childName = node.arguments[1].value;

                createHierarchyNode(parentName);
                createHierarchyNode(childName);

                hierarchy[parentName].children.push(childName);

                hierarchy[childName].parentName = parentName;

                return true;
            }
        }
    }

    return false;
}

function parseClass (ast, filePath) {
    var append = null;
    var constructor = null;

    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (isExpressionStatement(node) && isAssignmentExpression(node.expression)) {
            var node = node.expression;
        }
    }

    if (constructor === null || append === null) { return false; }

    var name = '';

    return true;
}

module.exports = function (grunt, task, taskData, tmpDir, files) {
    for (var i = 0, max = files.length; i < max; i++) {
        parseFile(grunt, files[i]);
    }
};
