const jsBeautify = require('js-beautify').js;
const ClosureCompiler = require('google-closure-compiler').compiler;

const chalk = require('../util/chalk');

let asyncDone = null;
let throwAsyncError = null;

/**
 * Concatenate each extern as a variable declaration that points to an empty object.
 * Externs are used to prevent the closure compiler from complaining about undeclared
 * variables and renaming those variables.
 *
 * @function writeExterns
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function writeExterns (grunt, fileData, options) {
    let content = '';

    // Default externs.
    content += 'var require = function () {};';

    for (let i = 0, max = options.externs.length; i < max; i++) {
        content += `var ${options.externs[i]} = {};`;
    }

    grunt.file.write(fileData.tmpExterns, content);
}

/**
 * @function minify
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function minify (grunt, fileData, options) {
    let compiler = new ClosureCompiler({
        'js': fileData.tmpParse,
        'externs': fileData.tmpExterns,
        'language_in': options.minifyLanguageIn,
        'language_out': options.minifyLanguageOut,
        'warning_level': 'QUIET',
        'js_output_file': fileData.dest,
        'dependency_mode': 'NONE',
        'compilation_level': 'ADVANCED'
    });

    chalk.init('Minifying...', true);

    writeExterns(grunt, fileData, options);

    compiler.run((exitCode, stdOut, stdErr) => {
        if (stdErr) {
            throwAsyncError(new Error(stdErr));
        }

        asyncDone(true);
    });
}

/**
 * @function beautify
 * @param {Object} grunt
 * @param {Object} fileData
 * @param {Object} options
 * @api private
 */

function beautify (grunt, fileData, options) {
    chalk.init('Beautifying...', true);

    grunt.file.write(fileData.dest, jsBeautify(grunt.file.read(fileData.tmpParse)));

    asyncDone(true);
}

module.exports = function (grunt, fileData, options, doneCallback, errorCallback) {
    asyncDone = doneCallback;
    throwAsyncError = errorCallback;

    if (options.minify) {
        minify(grunt, fileData, options);
    } else {
        beautify(grunt, fileData, options);
    }
};
