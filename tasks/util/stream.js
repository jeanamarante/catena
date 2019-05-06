'use strict';

const fs = require('fs');

// Keep track of the current index and array of strings used by
// the iterable functions.
const iterateData = {
    i: 0,
    item: null,
    collection: null
};

let throwAsyncError = null;

// Invoke when ReadStream closes.
let readableEndCallback = null;

// Invoke when manual writes to WriteStream are finished.
let writeFinishCallback = null;

// Invoke when WriteStream closes.
let writableEndCallback = null;

let writable = null;

/**
 * @function isIterating
 * @return {Boolean}
 * @api private
 */

function isIterating () {
    return iterateData.collection !== null;
}

/**
 * For as long as WriteStream exists then stream is writing.
 *
 * @function isWriting
 * @return {Boolean}
 * @api public
 */

function isWriting () {
    return writable !== null;
}

/**
 * @function hasReadableEndCallback
 * @return {Boolean}
 * @api private
 */

function hasReadableEndCallback () {
    return readableEndCallback !== null;
}

/**
 * @function testPipeFile
 * @api private
 */

function testPipeFile () {
    if (!isWriting()) {
        throwAsyncError(new Error('Cannot pipe file if there is no writable stream to pipe to.'));
    } else if (hasReadableEndCallback()) {
        throwAsyncError(new Error('Cannot pipe file while another file is still being piped.'));
    }
}

/**
 * @function testFunction
 * @param {*} arg
 * @param {String} argName
 * @api private
 */

function testFunction (arg, argName) {
    if (typeof arg !== 'function') {
        throwAsyncError(new Error(`${argName} must be function.`));
    }
}

/**
 * @function testWrite
 * @api private
 */

function testWrite () {
    if (!isWriting()) {
        throwAsyncError(new Error('Cannot write if no writable stream has been created.'));
    }
}

/**
 * @function resetIterateData
 * @api private
 */

function resetIterateData () {
    iterateData.i = 0;
    iterateData.item = null;
    iterateData.collection = null;
}

/**
 * Recursively pipe all files.
 *
 * @function iteratePipeFile
 * @api private
 */

function iteratePipeFile () {
    if (!isIterating()) { return undefined; }

    let data = iterateData;
    let file = data.collection[data.i];

    data.i++;

    if (data.i >= data.collection.length) {
        resetIterateData();
        pipeLastFile(file);
    } else {
        pipeFile(file, iteratePipeFile);
    }
}

/**
 * Recursively write content in array.
 *
 * @function iterateWriteArray
 * @api private
 */

function iterateWriteArray () {
    if (!isIterating()) { return undefined; }

    let data = iterateData;
    let content = data.collection[data.i];

    data.i++;

    if (data.i >= data.collection.length) {
        resetIterateData();

        writable.write(content, 'utf8', onWriteFinish);
    } else {
        writable.write(content, 'utf8', iterateWriteArray);
    }
}

/**
 * Recursively write content in linked list.
 *
 * @function iterateWriteLinkedList
 * @api private
 */

function iterateWriteLinkedList () {
    if (!isIterating()) { return undefined; }

    let data = iterateData;
    let content = iterateData.item.content;

    data.item = data.item.next;

    if (data.item === null) {
        resetIterateData();

        writable.write(content, 'utf8', onWriteFinish);
    } else {
        writable.write(content, 'utf8', iterateWriteLinkedList);
    }
}

/**
 * Pipe file contents without ending WriteStream.
 *
 * @function pipeFile
 * @param {String} file
 * @param {Function} endCallback
 * @api public
 */

function pipeFile (file, endCallback) {
    testPipeFile();
    testFunction(endCallback, 'endCallback');

    let readable = fs.createReadStream(file);

    readableEndCallback = endCallback;

    readable.once('error', throwAsyncError);
    readable.once('close', onReadableClose);

    readable.pipe(writable, { end: false });
};

/**
 * Pipe files recursively and then end WriteStream.
 *
 * @function pipeFileArray
 * @param {Array} arr
 * @api public
 */

 function pipeFileArray (arr) {
    testPipeFile();

    // Just end WriteStream if no files need to be read to keep default pipe behavior.
    if (arr.length === 0) {
        writable.end();
    } else {
        iterateData.collection = arr;

        iteratePipeFile();
    }
};

/**
 * Pipe file contents and then end WriteStream.
 *
 * @function pipeLastFile
 * @param {String} file
 * @api public
 */

 function pipeLastFile (file) {
    testPipeFile();

    let readable = fs.createReadStream(file);

    readable.once('error', throwAsyncError);

    readable.pipe(writable);
};

/**
 * @function onReadableClose
 * @api private
 */

function onReadableClose () {
    let cb = readableEndCallback;

    readableEndCallback = null;

    // Always append line feed when ReadStream finishes piping.
    writable.write('\x0A', 'utf8', cb);
}

/**
 * @function onWritableClose
 * @api private
 */

function onWritableClose () {
    let cb = writableEndCallback;

    writable = null;
    writableEndCallback = null;

    writeFinishCallback = null;

    cb();
}

/**
 * Callback used when manual writes to WriteStream are finished.
 *
 * @function onWriteFinish
 * @api private
 */

function onWriteFinish () {
    let cb = writeFinishCallback;

    writeFinishCallback = null;

    cb();
}

/**
 * @function setThrowAsyncError
 * @param {Function} callback
 * @api public
 */

module.exports.setThrowAsyncError = function (callback) {
    throwAsyncError = callback;
};

/**
 * @function createWriteStream
 * @param {String} file
 * @param {Function} endCallback
 * @api public
 */

module.exports.createWriteStream = function (file, endCallback) {
    if (isWriting()) {
        throwAsyncError(new Error('Cannot create writable stream while there is another one that has not finished.'));
    }

    testFunction(endCallback, 'endCallback');

    writable = fs.createWriteStream(file);

    writableEndCallback = endCallback;

    writable.once('error', throwAsyncError);
    writable.once('close', onWritableClose);
};

/**
 * @function endWriteStream
 * @api public
 */

module.exports.endWriteStream = function () {
    if (!isWriting()) {
        throwAsyncError(new Error('Cannot end writable stream if it has not been created.'));
    }

    if (isIterating()) {
        resetIterateData();
    }

    writable.end();
};

/**
 * Manually write string data to WriteStream.
 *
 * @function write
 * @param {String} content
 * @param {Function} finishCallback
 * @api public
 */

module.exports.write = function (content, finishCallback) {
    testWrite();
    testFunction(finishCallback, 'finishCallback');

    writeFinishCallback = finishCallback;

    writable.write(content, 'utf8', onWriteFinish);
};

/**
 * Manually write all string data in array to WriteStream.
 *
 * @function writeArray
 * @param {Array} arr
 * @param {Function} finishCallback
 * @api public
 */

module.exports.writeArray = function (arr, finishCallback) {
    testWrite();
    testFunction(finishCallback, 'finishCallback');

    if (arr.length === 0) {
        finishCallback();
    } else {
        writeFinishCallback = finishCallback;

        iterateData.collection = arr;

        iterateWriteArray();
    }
};

/**
 * Manually write all string data in linked list to WriteStream.
 *
 * @function writeLinkedList
 * @param {LinkedList} linkedList
 * @param {Function} finishCallback
 * @api public
 */

module.exports.writeLinkedList = function (linkedList, finishCallback) {
    testWrite();
    testFunction(finishCallback, 'finishCallback');

    if (linkedList.head === null) {
        finishCallback();
    } else {
        writeFinishCallback = finishCallback;

        iterateData.item = linkedList.head;
        iterateData.collection = linkedList;

        iterateWriteLinkedList();
    }
};

module.exports.isWriting = isWriting;
module.exports.pipeFile = pipeFile;
module.exports.pipeFileArray = pipeFileArray;
module.exports.pipeLastFile = pipeLastFile;
