var path = require('path');
var closureCompiler = require('google-closure-compiler');

/**
 * Write temporary file of external values and properties catena uses.
 *
 * @function writeTmpExternsFile
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @param {String} filePath
 * @api private
 */

function writeTmpExternsFile (grunt, task, taskData, filePath) {
    var content = stringifyExterns(taskData.externs);

    // SINGLE container and properties.
    content += 'var SINGLE = {};';
    content += 'SINGLE.init = function () {};';
    content += 'SINGLE.postInit = function () {};';

    // CLASS container and properties.
    content += 'var CLASS = {};';
    content += 'CLASS.super = function () {};';
    content += 'CLASS.abstract = function () {};';

    grunt.file.write(filePath, content);
}

/**
 * Concatenate each extern into a variable declaration that points to an empty object.
 *
 * @function stringifyExterns
 * @param {Array} externs
 * @return {String}
 * @api private
 */

function stringifyExterns (externs) {
    if (!Array.isArray(externs)) { return ''; }

    var content = '';

    for (var i = 0, max = externs.length; i < max; i++) {
        content += 'var ' + String(externs[i]) + ' = {};';
    }

    return content;
}

module.exports = function (grunt, task, taskData, tmpDir) {
    var compileFilePath = path.join(tmpDir, 'compile.js');
    var externsFilePath = path.join(tmpDir, 'externs.js');
    var parsedSrcFilesPath = path.join(tmpDir, 'parsed-src-files.js');

    writeTmpExternsFile(grunt, task, taskData, externsFilePath);

    closureCompiler.grunt(grunt);

    grunt.initConfig({
        'closure-compiler': {
            catena: {
                options: {
                    args: [
                        '--js', compileFilePath,
                        '--externs', externsFilePath,
                        '--language', 'ECMASCRIPT6_STRICT',
                        '--language_out', 'ECMASCRIPT6_STRICT',
                        '--warning_level', 'QUIET',
                        '--js_output_file', taskData.dest,
                        '--dependency_mode', 'NONE',
                        '--compilation_level', 'ADVANCED',
                        '--process_common_js_modules', 'true'
                    ]
                }
            }
        }
    });

    // Force delete the files google-closure-compiler uses to minify
    // dest file after closure-compiler task is done.
    grunt.registerTask('cleanup:catena', '', function () {
        var deleteOptions = {
            force: true
        };

        grunt.file.delete(compileFilePath, deleteOptions);
        grunt.file.delete(externsFilePath, deleteOptions);
        grunt.file.delete(parsedSrcFilesPath, deleteOptions);
    });

    grunt.task.run(['closure-compiler:catena', 'cleanup:catena']);
};
