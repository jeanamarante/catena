var acorn = require('acorn');

var hierarchy = {};
var nonHierarchicalNodes = [];

function isExpressionStatement (node) {
    return node.type === 'ExpressionStatement';
}

function isCallExpression (node) {
    return node.type === 'CallExpression';
}

function createHierarchyNode (parentName, childName) {
    if (hierarchy[childName] !== undefined) { return undefined; }

    hierarchy[childName] = {
        ast: null,
        filePath: '',
        children: [],
        parentName: parentName
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
        if (!parseExtend(ast, filePath) && !parseClass(ast, filePath)) {
            createNonHierarchicalNode(content, filePath);
        }
    }
}

function parseExtend (ast, filePath) {
    for (var i = 0, max = ast.body.length; i < max; i++) {
        var node = ast.body[i];

        if (isExpressionStatement(node) && isCallExpression(node.expression)) {
            node = node.expression;

            if (node.callee.name === 'extend') {
                var parentName = node.arguments[0].value;
                var childName = node.arguments[1].value;

                createHierarchyNode('', parentName);
                createHierarchyNode(parentName, childName);

                hierarchy[parentName].children.push(childName);

                hierarchy[childName].ast = ast;
                hierarchy[childName].filePath = filePath;

                return true;
            }
        }
    }

    return false;
}

function parseClass (ast, filePath) {
    for (var i = 0, max = ast.body.length; i < max; i++) {

    }

    return false;
}

module.exports = function (grunt, task, taskData, tmpDir, files) {
    for (var i = 0, max = files.length; i < max; i++) {
        parseFile(grunt, files[i]);
    }
};
