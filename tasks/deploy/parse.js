'use strict';

const acorn = require('acorn');

const chalk = require('../util/chalk');
const stream = require('../util/stream');

// All CLASS modules are stored here.
const hierarchy = {};

// Files that do not declare CLASS modules are stored here.
const nonHierarchicalNodes = [];

// Store all processed content for tmpParse stream.
const writeArray = [];

let throwAsyncError = null;

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
    // Check only for equals sign AssignmentExpressions.
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
 * @function randomInt
 * @param {Number} max
 * @return {Number}
 * @api private
 */

function randomInt (max) {
    return Math.floor(Math.random() * Math.floor(max));
}

/**
 * Fisher-Yates "inside-out" shuffle. Randomize order of modules and
 * their properties when minifying.
 *
 * @function shuffleArray
 * @param {Object} options
 * @param {Array} arr
 * @api private
 */

function shuffleArray (options, arr) {
    if (!options.minify) { return undefined; }

    for (let i = 0, max = arr.length; i < max; i++) {
        let j = randomInt(max);

        if (arr[j] !== arr[i]) {
            let source = arr[i];

            arr[i] = arr[j];
            arr[j] = source;
        }
    }
}

/**
 * @function createHierarchyNode
 * @param {String} name
 * @api private
 */

function createHierarchyNode (name) {
    if (hierarchy[name] !== undefined) { return undefined; }

    hierarchy[name] = {
        parent: '',
        children: [],

        // File content.
        content: '',

        // AST nodes.
        appendNode: null,
        constructorNode: null
    };
}

/**
 * Store the content of file that has no CLASS module declared.
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
 * @function processHierarchy
 * @param {Object} options
 * @api private
 */

function processHierarchy (options) {
    let keys = Object.keys(hierarchy);

    shuffleArray(options, keys);

    for (let i = 0, max = keys.length; i < max; i++) {
        let name = keys[i];
        let node = hierarchy[name];

        // Only process nodes that have no parents.
        if (node.parent === '') {
            processClass(options, name, node);
        }
    }
}

/**
 * @function processNonHierarchicalNodes
 * @param {Object} options
 * @api private
 */

function processNonHierarchicalNodes (options) {
    shuffleArray(options, nonHierarchicalNodes);

    for (let i = 0, max = nonHierarchicalNodes.length; i < max; i++) {
        let content = nonHierarchicalNodes[i].content;

        content = replaceClassPrototypeShorthand(content);

        // Place non hierarchical content between any module or
        // property in the writeArray when minifying.
        if (options.minify) {
            writeArray.splice(randomInt(writeArray.length + 1), 0, content);
        } else {
            writeArray.push(content);
        }
    }
}

/**
 * @function parseMatches
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @param {Array} matches
 * @api private
 */

function parseMatches (grunt, fileData, options, matches) {
    for (let i = 0, max = matches.length; i < max; i++) {
        parseFile(grunt, matches[i]);
    }

    processHierarchy(options);
    processNonHierarchicalNodes(options);
}

/**
 * @function parseFile
 * @param {Object} grunt
 * @param {String} filePath
 * @api private
 */

function parseFile(grunt, file) {
    let content = grunt.file.read(file);

    let ast = acorn.parse(content, {
        'sourceType': 'script',
        'ecmaVersion': 9
    });

    let hasExtend = parseExtend(ast);
    let hasClass = parseClass(ast, content);

    // If no extend invocation and no CLASS declaration is found,
    // then push file content into a non hierarchical node.
    if (!hasExtend && !hasClass) {
        createNonHierarchicalNode(content);
    }
}

/**
 * Search for top level extend invocation and store parent and child
 * modules as hierarchical nodes.
 *
 * @function parseExtend
 * @param {Object} ast
 * @return {Boolean}
 * @api private
 */

function parseExtend (ast) {
    for (let i = 0, max = ast.body.length; i < max; i++) {
        let node = ast.body[i];

        // Search for extend('Parent', 'Child');
        if (isExpressionStatement(node) && isCallExpression(node.expression) && node.expression.callee.name === 'extend') {
            node = node.expression;

            let parent = node.arguments[0].value;
            let child = node.arguments[1].value;

            createHierarchyNode(parent);
            createHierarchyNode(child);

            // Link child to parent.
            hierarchy[parent].children.push(child);

            // Link parent to child.
            hierarchy[child].parent = parent;

            return true;
        }
    }

    return false;
}

/**
 * Search for top level CLASS constructor and append assignment expressions.
 *
 * @function parseClass
 * @param {Object} ast
 * @param {String} content
 * @return {Boolean}
 * @api private
 */

function parseClass (ast, content) {
    let appendNode = null;
    let appendName = '';
    let constructorNode = null;
    let constructorName = '';

    for (let i = 0, max = ast.body.length; i < max; i++) {
        let node = ast.body[i];

        if (!isExpressionStatement(node) || !isAssignmentExpression(node.expression)) { continue; }

        node = node.expression;

        // Search for constructor -> CLASS.Module = function () {};
        if (isIdentifier(node.left.object) && isIdentifier(node.left.property) && node.left.object.name === 'CLASS') {
            constructorNode = node;
            constructorName = node.left.property.name;

        // Search for append -> CLASS.Module.append = {};
        } else if (isMemberExpression(node.left.object)) {
            let subNode = node.left;

            if (isIdentifier(subNode.object.object) && isIdentifier(subNode.object.property)) {
                if (subNode.object.object.name !== 'CLASS' || subNode.property.name !== 'append') { continue; }

                appendNode = node;
                appendName = subNode.object.property.name;
            }
        }
    }

    // If no constructor or append node is found or if the constructor and
    // append name do not match then don't create the hierarchy node.
    if (constructorNode === null || appendNode === null) {
        return false;
    } else if (constructorName !== appendName) {
        return false;
    }

    createHierarchyNode(constructorName);

    let hierarchyNode = hierarchy[constructorName];

    hierarchyNode.content = content;
    hierarchyNode.appendNode = appendNode;
    hierarchyNode.constructorNode = constructorNode;

    return true;
}

/**
 * Recursively process the content of class modules into writeArray.
 *
 * @function processClass
 * @param {Object} options
 * @param {String} name
 * @param {Object} node
 * @return {Boolean}
 * @api private
 */

function processClass (options, name, node) {
    processClassConstructor(options, name, node);
    processClassAppend(options, name, node);

    shuffleArray(options, node.children);

    for (let i = 0, max = node.children.length; i < max; i++) {
        let child = node.children[i];

        processClass(options, child, hierarchy[child]);
    }
}

/**
 * @function processClassConstructor
 * @param {Object} options
 * @param {String} name
 * @param {Object} node
 * @api private
 */

function processClassConstructor (options, name, node) {
    let subString = node.content.substring(node.constructorNode.right.start, node.constructorNode.right.end);

    subString = replaceClassSuper(name, subString);
    subString = replaceClassPrototypeShorthand(subString);

    writeArray.push(`\x0ACLASS.${name} = ${subString};\x0A`);
}

/**
 * @function processClassAppend
 * @param {Object} options
 * @param {String} name
 * @param {Object} node
 * @api private
 */

function processClassAppend (options, name, node) {
    // Start parent prototype wrap.
    let content = `\x0ACLASS.${name}.prototype = Object.create(CLASS.`;

    // Concatenate module's parent name if it isn't an empty string.
    if (node.parent !== '') {
        content += node.parent + '.';
    }

    // End parent prototype wrap.
    content += 'prototype);\x0A';

    writeArray.push(content);

    processClassAppendProperties(options, name, node);
}

/**
 * @function processClassAppendProperties
 * @param {Object} options
 * @param {String} name
 * @param {Object} node
 * @api private
 */

function processClassAppendProperties (options, name, node) {
    // Include constructor property by default.
    writeArray.push(`\x0ACLASS.${name}.prototype.constructor = CLASS.${name};\x0A`);

    let properties = node.appendNode.right.properties;

    shuffleArray(options, properties);

    for (let i = 0, max = properties.length; i < max; i++) {
        let subNode = properties[i];

        if (!isProperty(subNode)) { continue; }

        let subString = node.content.substring(subNode.value.start, subNode.value.end);

        subString = replaceClassPrototypeShorthand(subString);

        writeArray.push(`\x0ACLASS.${name}.prototype.${subNode.key.name} = ${subString};\x0A`);
    }
}

/**
 * @function replaceClassSuper
 * @param {String} name
 * @param {String} content
 * @return {String}
 * @api private
 */

function replaceClassSuper (name, content) {
    let parent = hierarchy[name].parent;

    // No need to replace super if no parent module is extended.
    if (parent === '') { return content; }

    let replaced = false;

    // Super invocation with no argument.
    // Regex Match: this.super()
    content = content.replace(/this\s*?\.\s*?super\s*?\(\s*?\)/, (match) => {
        replaced = true;

        return `CLASS.${parent}.call(this)`;
    });

    // Only one regex needs to match.
    if (replaced) { return content; }

    // Super invocation with arguments.
    // Regex Match: this.super(
    content = content.replace(/this\s*?\.\s*?super\s*?\(/, (match) => {
        return `CLASS.${parent}.call(this, `;
    });

    return content;
}

/**
 * Replace prototype shorthand with the standard prototype notation.
 *
 * @function replaceClassPrototypeShorthand
 * @param {String} content
 * @return {String}
 * @api private
 */

function replaceClassPrototypeShorthand (content) {
    // Regex Match: _$_.(Module)
    return content.replace(/\_\$\_\s*?\.\s*?([A-Za-z0-9\_]+)/g, (match, $1) => {
        return `CLASS.${$1}.prototype`;
    });
}

module.exports = function (grunt, fileData, options, doneCallback, errorCallback, matches) {
    throwAsyncError = errorCallback;

    stream.setThrowAsyncError(errorCallback);

    chalk.init('Parsing...', true);

    parseMatches(grunt, fileData, options, matches);

    stream.createWriteStream(fileData.tmpParse, () => {
        require('./minify')(grunt, fileData, options, doneCallback, errorCallback);
    });

    stream.pipeFile(fileData.tmpWrapStart, () => {
        stream.writeArray(writeArray, () => {
            stream.pipeLastFile(fileData.tmpWrapEnd);
        });
    });
};
