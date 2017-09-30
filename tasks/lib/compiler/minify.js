var path = require('path');
var nameGenerator = require('./name-generator.js');
var closureCompiler = require('google-closure-compiler');

var compilePath = '';
var externsPath = '';
var moduleNames = {};

/**
 * Parse dest file and mangle all CLASS module names.
 *
 * @function parseDestFile
 * @param {Object} grunt
 * @param {Object} task
 * @api private
 */

function parseDestFile (grunt, task) {
    var file = grunt.file.read(task.data.dest);

    // Match CLASS.Module
    file = file.replace(/CLASS\s*\.\s*([A-Za-z0-9-_]+)/g, function (match, $1) {
        // Store mangled name if it has not been matched yet.
        if (moduleNames[$1] === undefined) {
            // Main is not mangled.
            if ($1 === 'Main') {
                moduleNames[$1] = $1;
            } else {
                moduleNames[$1] = nameGenerator.generateName();
            }
        }

        return "CLASS['" + moduleNames[$1] + "']";
    });

    // Match extend('ParentModule', 'ChildModule')
    file = file.replace(/extend\s*\(\s*['"](.*)['"]\s*,\s*['"](.*)['"]\s*\)/g, function (match, $1, $2) {
        return "extend('" + moduleNames[$1] + "', '" + moduleNames[$2]  + "')";
    });

    // Match _$_.Module
    file = file.replace(/\_\$\_\s*\.\s*([A-Za-z0-9-_]*)/g, function (match, $1) {
        return "_$_['" + moduleNames[$1] + "']";
    });

    grunt.file.write(compilePath, file);
}

/**
 * Write file of protected values and properties catena uses.
 *
 * @function writeExternsFile
 * @param {Object} grunt
 * @param {Object} task
 * @api private
 */

function writeExternsFile (grunt, task) {
    var file = '';

    file += stringifyExternsData(grunt, task);

    // SINGLE container and properties.
    file += 'var SINGLE = {};';
    file += 'SINGLE.$name = "";';
    file += 'SINGLE.$isSingle = true;';
    file += 'SINGLE.init = function () {};';
    file += 'SINGLE.postInit = function () {};';

    // CLASS container and properties.
    file += 'var CLASS = {};';
    file += 'CLASS.$name = "";';
    file += 'CLASS.$isClass = true;';
    file += 'CLASS.$applied = true;';
    file += 'CLASS.$parentName = "";';
    file += 'CLASS.append = {};';
    file += 'CLASS.super = function () {};';
    file += 'CLASS.abstract = function () {};';

    grunt.file.write(externsPath, file);
}

/**
 * Concatenate manually declared externs into variable declarations.
 *
 * @function stringifyExternsData
 * @param {Object} grunt
 * @param {Object} task
 * @return {String}
 * @api private
 */

function stringifyExternsData (grunt, task) {
    var arr = task.data.externs;

    if (!Array.isArray(arr)) { return ''; }

    var content = '';

    for (var i = 0, max = arr.length; i < max; i++) {
        content += 'var ' + String(arr[i]) + ' = {};';
    }

    return content;
}

module.exports = function (grunt, task) {
    var tmpDir = path.resolve(__dirname, '../../tmp/');

    compilePath = path.join(tmpDir, 'compile.js');
    externsPath = path.join(tmpDir, 'externs.js');

    parseDestFile(grunt, task);
    writeExternsFile(grunt, task);

    closureCompiler.grunt(grunt);

    grunt.initConfig({
        'closure-compiler': {
            catena: {
                options: {
                    args: [
                        '--js', compilePath,
                        '--externs', externsPath,
                        '--warning_level', 'QUIET',
                        '--js_output_file', task.data.dest,
                        '--compilation_level', 'ADVANCED'
                    ]
                }
            }
        }
    });

    // Force delete the files google-closure-compiler uses to minify
    // dest after closure-compiler task is done.
    grunt.registerTask('cleanup:catena', '', function () {
        grunt.option('force', true);

        grunt.file.delete(compilePath);
        grunt.file.delete(externsPath);

        grunt.option('force', false);
    });

    grunt.task.run(['closure-compiler:catena', 'cleanup:catena']);
};
