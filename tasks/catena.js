var path = require('path');
var tmpDir = path.resolve(__dirname, 'tmp/');
var clientSideDir = path.resolve(__dirname, 'lib/client-side/');
var parsedSrcFilesPath = path.join(tmpDir, 'parsed-src-files.js');

// Lists of file paths stored for file concatenation.
var fileRegistry = {
    start: [],
    src: [],
    end: []
};

// Task arguments.
var deploying = false;
var withoutWatch = false;
var withoutMinify = false;

/**
 * Write temporary file that declares if application is in development mode or not.
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
 * Only JavaScript is allowed to be added into list of files.
 *
 * @function isInvalidFile
 * @param {String} file
 * @param {Object} stats
 * @return {Boolean}
 * @api private
 */

function isInvalidFile (file, stats) {
    // Do not block access to directories.
    return !(stats.isDirectory() || path.extname(file) === '.js');
}

/**
 * Store all JavaScript files in the order that they'll be concatenated.
 *
 * @function registerFiles
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function registerFiles (grunt, task, taskData) {
    if (typeof taskData.src !== 'string' || typeof taskData.dest !== 'string') {
        return undefined;
    } else if (!grunt.file.isDir(taskData.src)) {
        return undefined;
    }

    // Start wrap.
    fileRegistry.start.push(path.join(clientSideDir, 'wrapper-start.js'));
    fileRegistry.start.push(writeDevFile(grunt));
    fileRegistry.start.push(path.join(clientSideDir, 'dependencies.js'));
    fileRegistry.start.push(path.join(clientSideDir, 'class-properties.js'));
    fileRegistry.start.push(path.join(clientSideDir, 'utility-functions.js'));

    // End wrap.
    fileRegistry.end.push(path.join(clientSideDir, 'wrapper-end.js'));

    // recursive-readdir is asynchronous.
    var done = task.async();

    require('recursive-readdir')(taskData.src, [isInvalidFile], function (err, srcFiles) {
        // Finish recursive-addir.
        done();

        // Solve dependencies ahead of time before minifying when deploying.
        if (deploying) {
            grunt.registerTask('parse:catena', '', function () {
                require('./lib/compile/parse.js')(grunt, task, taskData, tmpDir, srcFiles);

                // All concatenated and parsed JavaScript files in src directory.
                fileRegistry.src.push(parsedSrcFilesPath);

                concat(grunt, task, taskData);
            });

            grunt.task.run('parse:catena');

        } else {
            // All JavaScript files in src directory.
            fileRegistry.src = srcFiles;

            concat(grunt, task, taskData);
        }
    });
}

/**
 * Concatenate all modules into a single JS file.
 *
 * @function concat
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function concat (grunt, task, taskData) {
    if (!grunt.task.exists('concat')) {
        grunt.loadNpmTasks('grunt-contrib-concat');
    }

    grunt.config('concat.catena', {
        src: fileRegistry.start.concat(fileRegistry.src, fileRegistry.end),

        // Concatenate all files as a temporary file when deploying.
        dest: deploying ? path.join(tmpDir, 'compile.js') : taskData.dest
    });

    if (deploying) {
        deploy(grunt, task, taskData);
    } else {
        grunt.task.run('concat:catena');

        watch(grunt, task, taskData);
    }
}

/**
 * Run concat task in tandem with other tasks.
 *
 * @function deploy
 * @param {Object} grunt
 * @param {Object} task
 * @param {Object} taskData
 * @api private
 */

function deploy (grunt, task, taskData) {
    grunt.registerTask('license:catena', '', function () {
        license(grunt, task, taskData);
    });

    if (withoutMinify) {
        grunt.registerTask('beautify:catena', '', function () {
            require('./lib/compile/beautify.js')(grunt, task, taskData, tmpDir);
        });

        grunt.task.run('concat:catena', 'beautify:catena', 'license:catena');

    } else {
        grunt.registerTask('minify:catena', '', function () {
            require('./lib/compile/minify.js')(grunt, task, taskData, tmpDir);
        });

        grunt.task.run('concat:catena', 'minify:catena', 'license:catena');
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

    // Prepend content read from license file as multi-line comment.
    var content = '';

    content += '/****************************************';
    content += '\x0A' + grunt.file.read(taskData.license) + '\x0A';
    content += '****************************************/';
    content += '\x0A\x0A\x0A' + grunt.file.read(taskData.dest);

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
        withoutMinify = this.args.indexOf('without_minify') !== -1;

        registerFiles(grunt, this, grunt.config.get('catena'));
    });
};
