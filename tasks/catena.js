var path = require('path');
var tmpDir = path.resolve(__dirname, 'tmp/');
var wrapperDir = path.resolve(__dirname, 'lib/wrapper/');

// Task arguments.
var withWatch = false;
var isDeploying = false;

/**
 * Write a file that declares if application is in development mode.
 *
 * @function writeDevFile
 * @param {Object} grunt
 * @param {Array} args
 * @return {String}
 * @api private
 */

function writeDevFile (grunt, args) {
    var filePath = path.join(tmpDir, 'dev.js');

    // Set $development to false if isDeploying is true.
    grunt.file.write(filePath, 'var $development = ' + String(!isDeploying) + ';\x0A');

    return filePath;
}

/**
 * @function buildFileList
 * @param {Object} grunt
 * @param {Array} args
 * @param {Object} data
 * @api private
 */

function buildFileList (grunt, args, data) {
    var files = [];

    // Start wrap.
    files.push(path.join(wrapperDir, 'init.js'));
    files.push(writeDevFile(grunt, args));
    files.push(path.join(wrapperDir, 'dependency.js'));

    // All files in src directory.
    files.push(path.join(data.src, '**/*.js'));

    // End wrap.
    files.push(path.join(wrapperDir, 'final.js'));

    concat(grunt, args, data, files);
}

/**
 * Concatenate all the modules into a single Javascript file.
 *
 * @function concat
 * @param {Object} grunt
 * @param {Array} args
 * @param {Object} data
 * @param {Array} files
 * @api private
 */

function concat (grunt, args, data, files) {
    if (!grunt.task.exists('concat')) {
        grunt.loadNpmTasks('grunt-contrib-concat');
    }

    grunt.config('concat.catena', {
        src: files,
        dest: data.dest
    });

    grunt.task.run('concat:catena');

    watch(grunt, args, data);
}

/**
 * Watch all .js files in src directory.
 *
 * @function watch
 * @param {Object} grunt
 * @param {Array} args
 * @param {Object} data
 * @api private
 */

function watch (grunt, args, data) {
    // The deploy and with_watch will arguments prevent watch from being called again.
    if (!data.watch || withWatch || isDeploying) { return undefined; }

    if (!grunt.task.exists('watch')) {
        grunt.loadNpmTasks('grunt-contrib-watch');
    }

    grunt.config('watch.catena', {
        files: path.join(data.src, '**/*.js'),
        tasks: ['catena:with_watch'],
        options: {
            spawn: false,
            interval: 1000
        }
    });

    grunt.task.run('watch:catena');
}

module.exports = function (grunt) {
    grunt.registerTask('catena', function () {
        withWatch = this.args.indexOf('with_watch') !== -1;
        isDeploying = this.args.indexOf('deploy') !== -1;

        buildFileList(grunt, this.args, grunt.config.get('catena'));
    });
};
