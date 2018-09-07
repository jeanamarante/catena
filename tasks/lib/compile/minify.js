var path = require('path');
var closureCompiler = require('google-closure-compiler');

var compilePath = '';
var externsPath = '';

/**
 * Parse and normalize all CLASS modules to temporary dest file.
 *
 * @function writeTmpDestFile
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function writeTmpDestFile (grunt, task, taskData) {
    var content = grunt.file.read(taskData.dest);
}

/**
 * Write temporary file of external values and properties catena uses.
 *
 * @function writeTmpExternsFile
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function writeTmpExternsFile (grunt, task, taskData) {
    var content = stringifyExternsData(grunt, task, taskData);

    // SINGLE container and properties.
    content += 'var SINGLE = {};';
    content += 'SINGLE.init = function () {};';
    content += 'SINGLE.postInit = function () {};';

    // CLASS container and properties.
    content += 'var CLASS = {};';
    content += 'CLASS.super = function () {};';
    content += 'CLASS.abstract = function () {};';

    grunt.file.write(externsPath, content);
}

/**
 * Concatenate manually declared externs into variable declarations.
 *
 * @function stringifyExternsData
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @return {String}
 * @api private
 */

function stringifyExternsData (grunt, task, taskData) {
    var arr = taskData.externs;

    if (!Array.isArray(arr)) { return ''; }

    var content = '';

    for (var i = 0, max = arr.length; i < max; i++) {
        content += 'var ' + String(arr[i]) + ' = {};';
    }

    return content;
}

module.exports = function (grunt, task, taskData, tmpDir) {
    compilePath = path.join(tmpDir, 'compile.js');
    externsPath = path.join(tmpDir, 'externs.js');

    writeTmpDestFile(grunt, task, taskData);
    writeTmpExternsFile(grunt, task, taskData);

    closureCompiler.grunt(grunt);

    grunt.initConfig({
        'closure-compiler': {
            catena: {
                options: {
                    args: [
                        '--js', compilePath,
                        '--externs', externsPath,
                        '--language', 'ECMASCRIPT6_STRICT',
                        '--language_out', 'ECMASCRIPT6_STRICT',
                        '--warning_level', 'QUIET',
                        '--js_output_file', taskData.dest,
                        '--compilation_level', 'ADVANCED'
                    ]
                }
            }
        }
    });

    // Force delete the files google-closure-compiler uses to minify
    // dest file after closure-compiler task is done.
    grunt.registerTask('cleanup:catena', '', function () {
        grunt.option('force', true);

        grunt.file.delete(compilePath);
        grunt.file.delete(externsPath);

        grunt.option('force', false);
    });

    grunt.task.run(['closure-compiler:catena', 'cleanup:catena']);
};
