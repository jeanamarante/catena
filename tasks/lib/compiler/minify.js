var path = require('path');
var nameGenerator = require('./name-generator.js');
var closureCompiler = require('google-closure-compiler');

var compilePath = '';
var externsPath = '';
var moduleNames = {};

function parseDest (grunt, task) {
    var file = grunt.file.read(task.data.dest);

    file = file.replace(/CLASS\.([A-Za-z0-9-_]+)/g, function (match, $1) {
        if (moduleNames[$1] === undefined) {
            if ($1 === 'Main') {
                moduleNames[$1] = $1;
            } else {
                moduleNames[$1] = nameGenerator.generateName();
            }
        }

        return "CLASS['" + moduleNames[$1] + "']";
    });

    file = file.replace(/extend\(\s*'(.*)',\s*'(.*)'\);/g, function (match, $1, $2) {
        return "extend('" + moduleNames[$1] + "', '" + moduleNames[$2]  + "');";
    });

    file = file.replace(/\_\$\_\.([A-Za-z0-9-_]*)/g, function (match, $1) {
        return "_$_['" + moduleNames[$1] + "']";
    });

    grunt.file.write(compilePath, file);
}

function writeExternsFile (grunt, task) {
    var file = '';

    file += stringifyExternsData(grunt, task);

    file += 'var SINGLE = {};';
    file += 'SINGLE.$name = "";';
    file += 'SINGLE.$isSingle = true;';
    file += 'SINGLE.init = function () {};';
    file += 'SINGLE.postInit = function () {};';

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

    parseDest(grunt, task);
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

    grunt.registerTask('cleanup:catena', '', function () {
        grunt.option('force', true);

        grunt.file.delete(compilePath);
        grunt.file.delete(externsPath);

        grunt.option('force', false);
    });

    grunt.task.run(['closure-compiler:catena', 'cleanup:catena']);
};
