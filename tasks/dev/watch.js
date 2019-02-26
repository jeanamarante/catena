'use strict';

const LinkedList = require('linked-list');

const chalk = require('../util/chalk');
const stream = require('../util/stream');
const Watcher = require('./Watcher');

// Store the content of files that will be written to dest.
const writeLinkedList = new LinkedList();

// One watcher is needed per src directory.
const watchers = [];

// Store all items in writeLinkedList.
const fileRegistry = {};

let throwAsyncError = null;

// Grunt file methods.
let gruntRead = null;
let gruntIsFile = null;

// Keep track of time when writing starts in milliseconds.
let writeStartTime = 0;

// Amount of files that are being concatenated.
let fileCount = 0;

let tmpWrapStart = '';
let tmpWrapEnd = '';
let dest = '';

/**
 * @function isFileRegistered
 * @param {String} file
 * @return {Boolean}
 * @api private
 */

function isFileRegistered (file) {
    return fileRegistry[file] !== undefined;
}

/**
 * Read registered file's contents and store them into writeArray.
 *
 * @function readFile
 * @param {String} file
 * @return {String}
 * @api private
 */

function readFile (file) {
    if (!isFileRegistered(file)) { return undefined; }

    fileRegistry[file].content = gruntIsFile(file) ? gruntRead(file) + '\x0A' : '';
}

/**
 * @function addFile
 * @param {String} file
 * @api private
 */

function addFile (file) {
    if (isFileRegistered(file)) { return undefined; }

    let item = new LinkedList.Item();

    item.file = file;
    item.content = '';

    fileRegistry[file] = item;

    writeLinkedList.append(item);

    fileCount++;

    readFile(file);
}

/**
 * @function removeFile
 * @param {String} file
 * @api private
 */

function removeFile (file) {
    if (!isFileRegistered(file)) { return undefined; }

    let item = fileRegistry[file];

    item.detach();

    item.file = '';
    item.content = '';

    fileCount--;

    delete fileRegistry[file];
}

/**
 * Unregister old file and register new one.
 *
 * @function renameFile
 * @param {String} oldFile
 * @param {String} newFile
 * @api private
 */

function renameFile (oldFile, newFile) {
    if (!isFileRegistered(oldFile) || isFileRegistered(newFile)) { return undefined; }

    let item = fileRegistry[oldFile];

    item.file = newFile;

    fileRegistry[newFile] = item;

    delete fileRegistry[oldFile];
}

/**
 * @function writeFiles
 * @api private
 */

function writeFiles () {
    writeStartTime = Date.now();

    stream.createWriteStream(dest, onWriteStreamEnd);

    stream.write(tmpWrapStart, () => {
        stream.writeLinkedList(writeLinkedList, () => {
            stream.write(tmpWrapEnd, () => {
                stream.endWriteStream();
            });
        });
    });
}

/**
 * @function onWriteStreamEnd
 * @api private
 */

function onWriteStreamEnd () {
    let timeDelta = String(Date.now() - writeStartTime);
    let filePlural = fileCount === 1 ? '' : 's';

    writeStartTime = 0;

    chalk.success(`${String(fileCount)} file${filePlural} have been concatenated to dest in ${timeDelta}ms.`);
}

/**
 * Write files again whenever a watch event happens.
 *
 * @function onEvent
 * @param {Watcher} watcher
 * @api private
 */

function onEvent (watcher) {
    writeFiles();
}

/**
 * @function onFileAdd
 * @param {Watcher} watcher
 * @param {String} file
 * @api private
 */

function onFileAdd (watcher, file) {
    addFile(file);
}

/**
 * @function onFileRemove
 * @param {Watcher} watcher
 * @param {String} file
 * @api private
 */

function onFileRemove (watcher, file) {
    removeFile(file);
}

/**
 * @function onFileRename
 * @param {Watcher} watcher
 * @param {String} oldFile
 * @param {String} newFile
 * @api private
 */

function onFileRename (watcher, oldFile, newFile) {
    renameFile(oldFile, newFile);
}

/**
 * @function onFileChange
 * @param {Watcher} watcher
 * @param {String} file
 * @api private
 */

function onFileChange (watcher, file) {
    readFile(file);
}

module.exports = function (grunt, fileData, options, errorCallback, matches, flattenedMatches) {
    throwAsyncError = errorCallback;

    gruntRead = grunt.file.read;
    gruntIsFile = grunt.file.isFile;

    tmpWrapStart = grunt.file.read(fileData.tmpWrapStart);
    tmpWrapEnd = grunt.file.read(fileData.tmpWrapEnd);
    dest = fileData.dest;

    stream.setThrowAsyncError(errorCallback);

    chalk.init('Watching...\x0A', true);

    // Store matches.
    flattenedMatches.forEach((item) => { addFile(item); });

    // Create one watcher per src directory.
    for (let i = 0, max = fileData.src.length; i < max; i++) {
        let watcher = new Watcher(fileData.src[i], throwAsyncError);

        watchers.push(watcher);

        watcher.listenEvent(onEvent);
        watcher.listenFileAdd(onFileAdd);
        watcher.listenFileRemove(onFileRemove);
        watcher.listenFileRename(onFileRename);
        watcher.listenFileChange(onFileChange);

        // Matches for each src directory share the same index.
        watcher.storeMatches(matches[i]);
        watcher.watch();
    }
};
