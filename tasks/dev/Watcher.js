const fs = require('fs');
const path = require('path');
const nsfw = require('nsfw');

/**
 * @class Watcher
 * @param {String} src
 * @param {Function} errorCallback
 */

class Watcher {
    constructor (src, errorCallback) {
        this._src = src;
        this._watcher = null;
        this._storingMatches = false;
        this._throwAsyncError = errorCallback;

        // Directories are stored as arrays of file names and files as strings.
        // Initialize src as directory to prevent addDirectoryRecursively method
        // from reaching maximum call stack size.
        this._storage = { [src]: [] };

        // Sometimes nsfw will show MODIFIED file events repeatedly. To prevent change
        // callback from being invoked many times for the same file then keep track
        // of unique files that have invoked the change callback once.
        this._modifiedFiles = new Map();

        this._eventCallback = null;
        this._fileAddCallback = null;
        this._fileRemoveCallback = null;
        this._fileRenameCallback = null;
        this._fileChangeCallback = null;
    }

    /**
     * @function isWatching
     * @return {Boolean}
     * @api public
     */

    isWatching () {
        return this._watcher !== null;
    }

    /**
     * @function hasStoredPath
     * @param {String} file
     * @return {Boolean}
     * @api public
     */

    hasStoredPath (file) {
        return this._storage[file] !== undefined;
    }

    /**
     * Check file system if path is directory or JS file.
     *
     * @function isValidFile
     * @param {String} file
     * @return {Boolean}
     * @api public
     */

    isValidFile (file) {
        return fs.existsSync(file) && (fs.statSync(file).isDirectory() || path.extname(file) === '.js');
    }

    /**
     * @function isStoredFile
     * @param {String} file
     * @return {Boolean}
     * @api public
     */

    isStoredFile (file) {
        return this._storage[file] === 'FILE';
    }

    /**
     * @function isStoredDirectory
     * @param {String} directory
     * @return {Boolean}
     * @api public
     */

    isStoredDirectory (directory) {
        return Array.isArray(this._storage[directory]);
    }

    /**
     * @function listenEvent
     * @param {Function} callback
     * @api public
     */

    listenEvent (callback) {
        this._eventCallback = callback;
    }

    /**
     * @function listenFileAdd
     * @param {Function} callback
     * @api public
     */

    listenFileAdd (callback) {
        this._fileAddCallback = callback;
    }

    /**
     * @function listenFileRemove
     * @param {Function} callback
     * @api public
     */

    listenFileRemove (callback) {
        this._fileRemoveCallback = callback;
    }

    /**
     * @function listenFileRename
     * @param {Function} callback
     * @api public
     */

    listenFileRename (callback) {
        this._fileRenameCallback = callback;
    }

    /**
     * @function listenFileChange
     * @param {Function} callback
     * @api public
     */

    listenFileChange (callback) {
        this._fileChangeCallback = callback;
    }

    /**
     * @function storeMatches
     * @param {Array} matches
     * @api public
     */

    storeMatches (matches) {
        // Do not invoke add callback for paths that are meant to be cached.
        this._storingMatches = true;

        for (let i = 0, max = matches.length; i < max; i++) {
            this.addPath(matches[i]);
        }

        this._storingMatches = false;
    }

    /**
     * @function addPath
     * @param {String} file
     * @return {Boolean}
     * @api public
     */

    addPath (file) {
        if (this.hasStoredPath(file) || !this.isValidFile(file)) {
            return false;
        } else {
            this._addDirectoryRecursively(file);

            if (fs.statSync(file).isDirectory()) {
                this._storage[file] = [];
            } else {
                this._storage[file] = 'FILE';

                if (!this._storingMatches) {
                    this._fileAddCallback(this, file);
                }
            }

            return true;
        }
    }

    /**
     * @function removePath
     * @param {String} file
     * @return {Boolean}
     * @api public
     */

    removePath (file) {
        if (!this.hasStoredPath(file)) { return false; }

        let directory = path.dirname(file);

        if (this.isStoredDirectory(directory)) {
            let arr = this._storage[directory];
            let index = arr.indexOf(path.basename(file));

            if (index !== -1) {
                arr.splice(index, 1);
            }
        }

        if (this.isStoredDirectory(file)) {
            this._removeDirectory(file);
        } else {
            this._removeFile(file);
        }

        return true;
    }

    /**
     * @function renamePath
     * @param {String} oldFile
     * @param {String} newFile
     * @return {Boolean}
     * @api public
     */

    renamePath (oldFile, newFile) {
        let oldValid = isValidFile(oldFile);
        let newValid = isValidFile(newFile);

        if (!oldValid || !newValid) {
            if (oldValid) {
                this.removePath(oldFile);
            }

            if (newValid) {
                this.addPath(newFile);
            }

            return false;
        }

        if (!this.hasStoredPath(oldFile) || this.hasStoredPath(newFile)) {
            return false;
        } else {
            if (this.isStoredDirectory(oldFile)) {
                this._renameDirectory(oldFile, newFile);
            } else {
                this._renameFile(oldFile, newFile);
            }

            return true;
        }
    }

    /**
     * @function watch
     * @api public
     */

    watch () {
        let self = this;

        let promise = nsfw(this._src, this._onEvent.bind(this), {
            // Only throw first error in errors array for simplicity.
            errorCallback: (errors) => {
                self._throwAsyncError(errors[0]);
            }
        });

        // Start watching src directory once watcher is ready.
        promise.then((watcher) => {
            self._watcher = watcher;
            self._watcher.start();
        });
    }

    get src () {
        return this._src;
    }

    get storage () {
        return this._storage;
    }

    get storageRoot () {
        return this._storage[this._src];
    }

    static get NSFW_CREATED () { return nsfw.actions.CREATED; }
    static get NSFW_DELETED () { return nsfw.actions.DELETED; }
    static get NSFW_MODIFIED () { return nsfw.actions.MODIFIED; }
    static get NSFW_RENAMED () { return nsfw.actions.RENAMED; }

    /**
     * If directory exists push path base to array it points to. Otherwise create
     * new array with path base and try to add recursively parent directories if they
     * do not exist.
     *
     * @function addDirectoryRecursively
     * @param {String} file
     * @api private
     */

    _addDirectoryRecursively (file) {
        let directory = path.dirname(file);

        if (!this.hasStoredPath(directory)) {
            if (this._src !== directory) {
                this._addDirectoryRecursively(directory);

                this._storage[directory] = [path.basename(file)];
            }
        } else {
            this._storage[directory].push(path.basename(file));
        }
    }

    /**
     * @function removeFile
     * @param {String} file
     * @api private
     */

    _removeFile (file) {
        delete this._storage[file];

        this._fileRemoveCallback(this, file);
    }

    /**
     * Remove all files and sub directories recursively.
     *
     * @function removeDirectory
     * @param {String} directory
     * @api private
     */

    _removeDirectory (directory) {
        let arr = this._storage[directory];

        for (let i = 0, max = arr.length; i < max; i++) {
            let subPath = path.join(directory, arr[i]);

            if (this.isStoredDirectory(subPath)) {
                this._removeDirectory(subPath);
            } else {
                this._removeFile(subPath);
            }
        }

        delete this._storage[directory];
    }

    /**
     * @function renameFile
     * @param {String} oldFile
     * @param {String} newFile
     * @api private
     */

    _renameFile (oldFile, newFile) {
        this._storage[newFile] = this._storage[oldFile];

        delete this._storage[oldFile];

        this._fileRenameCallback(this, oldFile, newFile);
    }

    /**
     * @function renameDirectory
     * @param {String} oldDirectory
     * @param {String} newDirectory
     * @api private
     */

    _renameDirectory (oldDirectory, newDirectory) {
        let arr = this._storage[oldDirectory];

        this._storage[newDirectory] = arr;

        delete this._storage[oldDirectory];

        for (let i = 0, max = arr.length; i < max; i++) {
            let oldSubPath = path.join(oldDirectory, arr[i]);
            let newSubPath = path.join(newDirectory, arr[i]);

            if (this.isStoredDirectory(oldSubPath)) {
                this._renameDirectory(oldSubPath, newSubPath);
            } else {
                this._renameFile(oldSubPath, newSubPath);
            }
        }
    }

    /**
     * @function onEvents
     * @param {Array} events
     * @api private
     */

    _onEvent (events) {
        for (let i = 0, max = events.length; i < max; i++) {
            let data = events[i];

            if (data.action === Watcher.NSFW_RENAMED) {
                let oldFile = path.join(data.directory, data.oldFile);
                let newFile = path.join(data.newDirectory, data.newFile);

                this.renamePath(oldFile, newFile);
            } else {
                let file = path.join(data.directory, data.file);

                switch (data.action) {
                    case Watcher.NSFW_CREATED:
                        this.addPath(file);
                        break;

                    case Watcher.NSFW_DELETED:
                        this.removePath(file);
                        break;

                    case Watcher.NSFW_MODIFIED:
                        // Keep track of files that have been changed to prevent
                        // file change callback from being invoked more than once.
                        if (this.isStoredFile(file) && !this._modifiedFiles.has(file)) {
                            this._modifiedFiles.set(file, true);

                            this._fileChangeCallback(this, file);
                        }
                        break;
                }
            }
        }

        this._modifiedFiles.clear();

        this._eventCallback(this);
    }
}

module.exports = Watcher;
