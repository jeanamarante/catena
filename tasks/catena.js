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
 * @return {String}
 * @api private
 */

function writeDevFile (grunt) {
    var filePath = path.join(tmpDir, 'dev.js');

    // Set $development to false if isDeploying is true.
    grunt.file.write(filePath, 'var $development = ' + String(!isDeploying) + ';\x0A');

    return filePath;
}

/**
 * Only Javascript is allowed to be added into files list.
 *
 * @function isInvalidFile
 * @param {String} file
 * @param {Object} stats
 * @return {Boolean}
 * @api private
 */

function isInvalidFile (file, stats) {
    // Do not block access to sub directories.
    if (stats.isDirectory()) {
        return false;
    } else if (path.extname(file) === '.js') {
        return false;
    } else {
        return true;
    }
}

/**
 * @function buildFileList
 * @param {Object} grunt
 * @param {Object} task
 * @api private
 */

function buildFileList (grunt, task) {
    // recursive-readdir is asynchronous.
    var done = task.async();
    var files = [];

    // Start wrap.
    files.push(path.join(wrapperDir, 'init.js'));
    files.push(writeDevFile(grunt));
    files.push(path.join(wrapperDir, 'dependency.js'));

    require('recursive-readdir')(task.data.src, [isInvalidFile], function (err, srcFiles) {
        // Finish recursive-addir.
        done();

        // All Javascript files in src directory.
        files = files.concat(srcFiles);

        // End wrap.
        files.push(path.join(wrapperDir, 'final.js'));

        concat(grunt, task, files);
    });
}

/**
 * Concatenate all the modules into a single Javascript file.
 *
 * @function concat
 * @param {Object} grunt
 * @param {Object} task
 * @param {Array} files
 * @api private
 */

function concat (grunt, task, files) {
    if (!grunt.task.exists('concat')) {
        grunt.loadNpmTasks('grunt-contrib-concat');
    }

    grunt.config('concat.catena', {
        src: files,
        dest: task.data.dest
    });

    grunt.task.run('concat:catena');

    watch(grunt, task);
}

/**
 * Watch all .js files in src directory.
 *
 * @function watch
 * @param {Object} grunt
 * @param {Object} task
 * @api private
 */

function watch (grunt, task) {
    // No need to run watch if application is being deployed or already being watched.
    if (!Boolean(task.data.watch) || withWatch || isDeploying) { return undefined; }

    if (!grunt.task.exists('watch')) {
        grunt.loadNpmTasks('grunt-contrib-watch');
    }

    grunt.config('watch.catena', {
        files: path.join(task.data.src, '**/*.js'),
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

        // Treat catena as a subtask.
        this.data = grunt.config.get('catena');

        buildFileList(grunt, this);
    });
};
