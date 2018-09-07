var hierarchy = {};
var nonHierarchicalModules = [];

function createHierarchyNode (parentName, childName) {
    if (hierarchy[childName] !== undefined) { return undefined; }

    hierarchy[childName] = {
        parent: parentName,
        absPath: '',
        children: []
    };
}

function parseFile (grunt, absPath) {
    var content = grunt.file.read(absPath);

    if (parseClassExtend(content, absPath)) {
        return undefined;
    } else if (parseClass(content, absPath)) {
        return undefined;
    } else {
        nonHierarchicalModules.push(absPath);
    }
}

function parseClassExtend (content, absPath) {
    var result = /^\s*extend\s*\(\s*['"](.*)['"]\s*,\s*['"](.*)['"]\s*\)/.exec(content);

    if (result === null) { return false; }

    var parentName = result[1];
    var childName = result[2];

    createHierarchyNode('', parentName);
    createHierarchyNode(parentName, childName);

    hierarchy[parentName].children.push(childName);

    hierarchy[childName].absPath = absPath;

    return true;
}

function parseClass (content, absPath) {
    var result = /^\s*CLASS\s*\.\s*([A-Za-z0-9-_]+)/.exec(content);

    if (result === null) { return false; }

    var name = result[1];

    createHierarchyNode('', name);

    hierarchy[name].absPath = absPath;

    return true;
}

function convertHierarchyToArray () {
    var arr = [];
    var classNames = Object.keys(hierarchy);

    for (var i = 0, max = classNames.length; i < max; i++) {
        var name = classNames[i];

        if (hierarchy[name].parent === '') {
            arr.push(hierarchy[name].absPath);

            appendChildrenToArray(name, arr);
        }
    }

    return arr;
}

function appendChildrenToArray (parentName, arr) {
    var children = hierarchy[parentName].children;

    for (var i = 0, max = children.length; i < max; i++) {
        var childName = children[i];

        arr.push(hierarchy[childName].absPath);

        appendChildrenToArray(childName, arr);
    }
}

module.exports = function (grunt, files) {
    for (var i = 0, max = files.length; i < max; i++) {
        parseFile(grunt, files[i]);
    }

    var arr = convertHierarchyToArray();

    arr = arr.concat(nonHierarchicalModules);

    return arr;
};
