var path = require('path');
var tmpDir = path.resolve(__dirname, 'tmp/');
var clientSideDir = path.resolve(__dirname, 'lib/client-side/');

// Task arguments.
var deploying = false;
var withoutWatch = false;

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

    // Set $development to false if deploying is true.
    grunt.file.write(filePath, 'var $development = ' + String(!deploying) + ';\x0A');

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
 * @param {Object} taskData
 * @api private
 */

function buildFileList (grunt, task, taskData) {
    if (typeof taskData.src !== 'string' || typeof taskData.dest !== 'string') {
        return undefined;
    } else if (!grunt.file.isDir(taskData.src)) {
        return undefined;
    }

    var files = [];

    // Start wrap.
    files.push(path.join(clientSideDir, 'wrapper-start.js'));
    files.push(writeDevFile(grunt));
    files.push(path.join(clientSideDir, 'dependencies.js'));
    files.push(path.join(clientSideDir, 'class-methods.js'));
    files.push(path.join(clientSideDir, 'utility-functions.js'));

    // recursive-readdir is asynchronous.
    var done = task.async();

    require('recursive-readdir')(taskData.src, [isInvalidFile], function (err, srcFiles) {
        // Finish recursive-addir.
        done();

        // Solve dependencies ahead of time before minifying when deploying.
        if (deploying) {
            srcFiles = require('./lib/compile/dependencies.js')(grunt, srcFiles);
        }

        // All Javascript files in src directory.
        files = files.concat(srcFiles);

        // End wrap.
        files.push(path.join(clientSideDir, 'wrapper-end.js'));

        concat(grunt, task, taskData, files);
    });
}

/**
 * Concatenate all the modules into a single Javascript file.
 *
 * @function concat
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @param {Array} files
 * @api private
 */

function concat (grunt, task, taskData, files) {
    if (!grunt.task.exists('concat')) {
        grunt.loadNpmTasks('grunt-contrib-concat');
    }

    grunt.config('concat.catena', {
        src: files,
        dest: taskData.dest
    });

    // Minify and license dest file after concatening it when deploying.
    if (deploying) {
        grunt.registerTask('minify:catena', '', function () {
            require('./lib/compile/minify.js')(grunt, task, taskData, tmpDir);
        });

        grunt.registerTask('license:catena', '', function () {
            license(grunt, task, taskData);
        });

        grunt.task.run('concat:catena', 'minify:catena', 'license:catena');

    } else {
        grunt.task.run('concat:catena');

        watch(grunt, task, taskData);
    }
}

/**
 * Prepend license file content to dest file.
 *
 * @function license
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function license (grunt, task, taskData) {
    if (typeof taskData.license !== 'string' || !grunt.file.isFile(taskData.license)) { return undefined; }

    var destFile = grunt.file.read(taskData.dest);
    var licenseFile = grunt.file.read(taskData.license);

    // Prepend content read from license file as multi-line comment.
    var content = '';
    content += '/****************************************';
    content += '\x0A' + licenseFile + '\x0A';
    content += '****************************************/';
    content += '\x0A\x0A\x0A' + destFile;

    grunt.file.write(taskData.dest, content);
}

/**
 * Watch all .js files in src directory.
 *
 * @function watch
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function watch (grunt, task, taskData) {
    // No need to run watch if application is being deployed or already being watched.
    if (!Boolean(taskData.watch) || withoutWatch || deploying) { return undefined; }

    if (!grunt.task.exists('watch')) {
        grunt.loadNpmTasks('grunt-contrib-watch');
    }

    grunt.config('watch.catena', {
        files: path.join(taskData.src, '**/*.js'),
        tasks: ['catena:without_watch'],
        options: {
            spawn: false,
            interval: 1000
        }
    });

    grunt.task.run('watch:catena');
}

module.exports = function (grunt) {
    grunt.registerTask('catena', function () {
        deploying = this.args.indexOf('deploy') !== -1;
        withoutWatch = this.args.indexOf('without_watch') !== -1;

        buildFileList(grunt, this, grunt.config.get('catena'));
    });
};
