var path = require('path');
var beautify = require('js-beautify');

module.exports = function (grunt, task, taskData, tmpDir) {
    var compileFilePath = path.join(tmpDir, 'compile.js');
    var parsedSrcFilesPath = path.join(tmpDir, 'parsed-src-files.js');

    var content = beautify(grunt.file.read(compileFilePath));

    grunt.file.write(taskData.dest, content);

    // Force delete the files js-beautify uses to beautify dest file
    // after callback provided to js-beautify is invoked.
    grunt.registerTask('cleanup:catena', '', function () {
        var deleteOptions = {
            force: true
        };

        grunt.file.delete(compileFilePath, deleteOptions);
        grunt.file.delete(parsedSrcFilesPath, deleteOptions);
    });

    grunt.task.run('cleanup:catena');
};
