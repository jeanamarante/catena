const chalk = require('chalk');

/**
 * @function log
 * @param {Function} chalkColor
 * @param {String} content
 * @param {Boolean} prependLineFeed
 * @api private
 */

function log (chalkColor, content, prependLineFeed) {
    content = prependLineFeed ? '\x0A' + content : content;

    console.log(chalkColor(content));
}

// Useful for separating iterable data.
module.exports.divider = '----------------------------------------';

/**
 * @function init
 * @param {String} content
 * @param {Boolean} prependLineFeed
 * @api public
 */

module.exports.init = function (content, prependLineFeed) {
    log(chalk.cyan, content, prependLineFeed);
};

/**
 * @function success
 * @param {String} content
 * @param {Boolean} prependLineFeed
 * @api public
 */

module.exports.success = function (content, prependLineFeed) {
    log(chalk.green, content, prependLineFeed);
};

/**
 * @function warning
 * @param {String} content
 * @param {Boolean} prependLineFeed
 * @api public
 */

module.exports.warning = function (content, prependLineFeed) {
    log(chalk.yellow, content, prependLineFeed);
};

/**
 * @function error
 * @param {String} content
 * @param {Boolean} prependLineFeed
 * @api public
 */

module.exports.error = function (content, prependLineFeed) {
    log(chalk.red, content, prependLineFeed);
};
