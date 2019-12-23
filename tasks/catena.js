'use strict';

// Array.prototype.flat method does not work in older versions of node.
require('array-flat-polyfill');

const fs = require('fs');
const del = require('del');
const path = require('path');
const uuid = require('uuid/v4');

const walk = require('./util/walk');
const stream = require('./util/stream');

// Files used for wrapping are stored here.
const clientSideDir = path.resolve(__dirname, 'client-side');

// This task relies on async functionality.
let asyncDone = null;

// Use temporary directories to prevent cached files from being
// overwritten when watcher is active.
let tmpDir = '';

/**
 * Test if file path declared in options exists and if it is valid string.
 *
 * @function testOptionalFile
 * @param {Object} grunt
 * @param {String} file
 * @param {String} optionName
 * @api private
 */

function testOptionalFile (grunt, file, optionName) {
    if (typeof file === 'string') {
        let stats = fs.statSync(path.resolve(file));

        if (stats.isDirectory()) {
            throwAsyncError(new Error(`${optionName} cannot be directory.`));
        } else if (!stats.isFile()) {
            throwAsyncError(new Error(`${file} must be file in ${optionName}.`));
        }
    } else {
        throwAsyncError(new Error(`${optionName} must be string.`));
    }
}

/**
 * @function testOptionalNonEmptyString
 * @param {Object} grunt
 * @param {String} value
 * @param {String} optionName
 * @api private
 */

function testOptionalNonEmptyString (grunt, value, optionName) {
    if (typeof value !== 'string' || value === '') {
        throwAsyncError(new Error(`${optionName} must be non empty string.`));
    }
}

/**
 * @function testOriginalSrc
 * @param {Object} grunt
 * @param {Array} src
 * @api private
 */

function testOriginalSrc (grunt, src) {
    for (let i = 0, max = src.length; i < max; i++) {
        let item = src[i];

        if (typeof item !== 'string') {
            throwAsyncError(new Error('src must be string.'));
        } else if (!grunt.file.isDir(path.resolve(item))) {
            throwAsyncError(new Error(`${item} must be directory in src.`));
        }
    }
}

/**
 * @function testDest
 * @param {Object} grunt
 * @param {String} dest
 * @api private
 */

function testDest (grunt, dest) {
    if (typeof dest !== 'string') {
        throwAsyncError(new Error('dest must be string.'));
    } else if (grunt.file.isDir(path.resolve(dest))) {
        throwAsyncError(new Error('dest cannot be directory.'));
    }
}

/**
 * @function testExterns
 * @param {Object} grunt
 * @param {Array} externs
 * @api private
 */

function testExterns (grunt, externs) {
    if (!Array.isArray(externs)) {
        throwAsyncError(new Error('externs must be array.'));
    } else {
        for (let i = 0, max = externs.length; i < max; i++) {
            if (typeof externs[i] !== 'string') {
                throwAsyncError(new Error('All items in externs array must be strings.'));
            }
        }
    }
}

/**
 * Pass error to async done function to let grunt know that the
 * task has failed.
 *
 * @function throwAsyncError
 * @param {Error} err
 * @api private
 */

function throwAsyncError (err) {
    asyncDone(err);

    throw err;
}

/**
 * @function createTmpDir
 * @param {Object} grunt
 * @api private
 */

function createTmpDir (grunt) {
    removeTmpDir();

    tmpDir = path.resolve(__dirname, 'tmp', uuid());

    grunt.file.mkdir(tmpDir);
}

/**
 * @function removeTmpDir
 * @api private
 */

function removeTmpDir () {
    if (tmpDir === '') { return undefined; }

    if (fs.existsSync(tmpDir)) {
        del.sync(path.join(tmpDir, '**'), { force: true });
    }

    tmpDir = '';
}

/**
 * Create files that will be used to wrap all the matched Javascript files.
 *
 * @function streamWrappers
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function streamWrappers (grunt, fileData, options) {
    stream.createWriteStream(fileData.tmpWrapStart, () => {
        streamWrapperEnd(grunt, fileData, options);
    });

    if (options.license) {
        streamLicense(grunt, fileData, options);
    } else {
        streamWrapperStart(grunt, fileData, options);
    }
}

/**
 * Prepend license in the starting wrapper.
 *
 * @function streamLicense
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function streamLicense (grunt, fileData, options) {
    let content = grunt.file.read(options.license);

    // Use JSDoc license tag to preserve file content as
    // comment when minifying.
    if (options.deploy && options.minify) {
        content = `/**@license ${content}*/`;
    } else {
        content = `/*\x0A${content}*/\x0A\x0A`;
    }

    stream.write(content, () => {
        streamWrapperStart(grunt, fileData, options);
    });
}

/**
 * @function streamWrapperStart
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function streamWrapperStart (grunt, fileData, options) {
    stream.pipeFile(path.join(clientSideDir, 'wrapper-start.js'), () => {
        // Always stream dynamically if application is in development mode or not.
        stream.write(`let $development = ${String(!options.deploy)};\x0A`, () => {
            stream.pipeFile(path.join(clientSideDir, 'dependencies.js'), () => {
                stream.pipeFile(path.join(clientSideDir, 'class-properties.js'), () => {
                    stream.pipeLastFile(path.join(clientSideDir, 'utility-functions.js'));
                });
            });
        });
    });
}

/**
 * @function streamWrapperEnd
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function streamWrapperEnd (grunt, fileData, options) {
    stream.createWriteStream(fileData.tmpWrapEnd, () => {
        walk.walkDirectories(fileData.src, (matches) => {
            streamMatches(grunt, fileData, options, matches, matches.flat());
        });
    });

    stream.pipeLastFile(path.join(clientSideDir, 'wrapper-end.js'));
}

/**
 * Iterate all matches and stream them into the dest file.
 *
 * @function streamMatches
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @param {Array} matches
 * @param {Array} flattenedMatches
 * @api private
 */

function streamMatches (grunt, fileData, options, matches, flattenedMatches) {
    // Run optional tasks after we stream  matches to dest.
    stream.createWriteStream(fileData.dest, () => {
        require('./dev/test')(grunt, fileData, options, throwAsyncError).performTests();

        if (options.deploy) {
            require('./deploy/parse')(grunt, fileData, options, asyncDone, throwAsyncError, flattenedMatches);
        } else {
            // Never end task if watch option is true and there are src directories to watch.
            if (options.watch && fileData.src.length > 0) {
                require('./dev/watch')(grunt, fileData, options, throwAsyncError, matches, flattenedMatches);
            } else {
                asyncDone(true);
            }
        }
    });

    // Place the flattened matches between the start wrapper and the end
    // wrapper into a single dimensional array.
    stream.pipeFileArray([fileData.tmpWrapStart, flattenedMatches, fileData.tmpWrapEnd].flat());
}

// Remove temporary directory everytime the process exits.
require('signal-exit')((code, signal) => { removeTmpDir(); });

module.exports = function (grunt) {
    grunt.registerMultiTask('catena', function () {
        // Execute task asynchronously.
        asyncDone = grunt.task.current.async();

        walk.setThrowAsyncError(throwAsyncError);
        stream.setThrowAsyncError(throwAsyncError);

        createTmpDir(grunt);

        let options = this.options();

        options.test = Boolean(options.test);
        options.watch = Boolean(options.watch);
        options.deploy = Boolean(options.deploy);

        // Always use static analysis tools when testing by default.
        options.lint = options.lint === undefined ? true : Boolean(options.lint);

        // Always minify dest file when deploying by default.
        options.minify = options.minify === undefined ? true : Boolean(options.minify);

        if (options.externs === undefined) {
            options.externs = [];
        } else {
            testExterns(grunt, options.externs);
        }

        if (options.license !== undefined) {
            testOptionalFile(grunt, options.license, 'license');

            options.license = path.resolve(options.license);
        }

        if (options.minifyLanguageIn === undefined) {
            options.minifyLanguageIn = 'ECMASCRIPT_2019';
        } else {
            testOptionalNonEmptyString(grunt, options.minifyLanguageIn, 'minifyLanguageIn');
        }

        if (options.minifyLanguageOut === undefined) {
            options.minifyLanguageOut = 'ECMASCRIPT_2015';
        } else {
            testOptionalNonEmptyString(grunt, options.minifyLanguageOut, 'minifyLanguageOut');
        }

        for (let i = 0, max = this.files.length; i < max; i++) {
            let fileData = this.files[i];

            testOriginalSrc(grunt, fileData.orig.src);
            testDest(grunt, fileData.dest);

            // Replace fileData with new object containing resolved paths that
            // are commonly used throughout all modules.
            fileData = {
                src: fileData.orig.src.map((item) => path.resolve(item)),
                dest: path.resolve(fileData.dest),
                tmpDir: tmpDir,
                tmpParse: path.join(tmpDir, 'parse.js'),
                tmpExterns: path.join(tmpDir, 'externs.js'),
                tmpWrapEnd: path.join(tmpDir, 'wrap-end.js'),
                tmpWrapStart: path.join(tmpDir, 'wrap-start.js')
            };

            streamWrappers(grunt, fileData, options);
        }
    });
};
