const path = require('path');
const readDir = require('recursive-readdir');

// Ignore everything except directories and Javascript files.
// Store function in array for recursive-readdir module.
const ignoreCallback = [(file, stats) => !(stats.isDirectory() || path.extname(file) === '.js')];

let throwAsyncError = null;

/**
 * @function walkDirectory
 * @param {String} directory
 * @param {Function} finishCallback
 * @api public
 */

function walkDirectory (directory, finishCallback) {
    walkDirectories([directory], finishCallback);
}

/**
 * Recursively search for JS files.
 *
 * @function walkDirectories
 * @param {Array} directories
 * @param {Function} finishCallback
 * @api public
 */

function walkDirectories (directories, finishCallback) {
    let promises = [];

    for (let i = 0, max = directories.length; i < max; i++) {
        promises.push(readDir(directories[i], ignoreCallback).then((value) => value, (err) => err));
    }

    Promise.all(promises)
        .then((values) => {
            finishCallback(values);
        }, throwAsyncError);
}

/**
 * @function setThrowAsyncError
 * @param {Function} callback
 * @api public
 */

module.exports.setThrowAsyncError = function (callback) {
    throwAsyncError = callback;
};

module.exports.walkDirectory = walkDirectory;
module.exports.walkDirectories = walkDirectories;
