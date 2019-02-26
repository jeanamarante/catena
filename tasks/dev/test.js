'use strict';

const del = require('del');
const eslint = require('eslint');

const chalk = require('../util/chalk');

let throwAsyncError = null;

let lintCLI = null;

let dest = '';
let enabled = false;
let testing = false;
let deploying = false;

/**
 * @function canTest
 * @return {Boolean}
 * @api public
 */

function canTest () {
    return enabled && !testing;
}

/**
 * @function isTesting
 * @return {Boolean}
 * @api public
 */

function isTesting () {
    return testing;
}

/**
 * @function buildLintCLI
 * @param {Object} options
 * @api private
 */

function buildLintCLI (options) {
    if (!options.lint) { return undefined; }

    let cliOptions = {
        'envs': ['browser', 'node', 'amd', 'es6'],
        'globals': options.externs,
        'useEslintrc': false,
        'parserOptions': {
            'ecmaVersion': 9
        }
    };

    // Allow lintConfig to establish which rules are going to be
    // used if it is declared.
    if (typeof options.lintConfig === 'string') {
        cliOptions['configFile'] = options.lintConfig;
    } else {
        cliOptions['rules'] = {
            // Errors
            'no-cond-assign': 2,
            'no-constant-condition': 2,
            'no-dupe-args': 2,
            'no-dupe-keys': 2,
            'no-duplicate-case': 2,
            'no-empty-character-class': 2,
            'no-ex-assign': 2,
            'no-extra-semi': 2,
            'no-func-assign': 2,
            'no-inner-declarations': 2,
            'no-invalid-regexp': 2,
            'no-obj-calls': 2,
            'no-unexpected-multiline': 2,
            'no-unreachable': 2,
            'no-unsafe-negation': 2,
            'use-isnan': 2,
            'valid-typeof': 2,
            'eqeqeq': 2,
            'no-eq-null': 2,
            'no-global-assign': 2,

            // Warnings
            'no-compare-neg-zero': 1,
            'no-extra-boolean-cast': 1
        };
    }

    lintCLI = new eslint.CLIEngine(cliOptions);
}

/**
 * @function lint
 * @return {Boolean}
 * @api private
 */

function lint () {
    // If lintCLI has not been built then pass test by default.
    if (lintCLI === null) { return true; }

    let result = lintCLI.executeOnFiles([dest]).results[0];

    logLint('Error', 2, result.messages, result.errorCount, chalk.error);
    logLint('Warning', 1, result.messages, result.warningCount, chalk.warning);

    // If no errors are found then test has passed.
    return result.errorCount === 0;
}

/**
 * Iterate and log all lint errors and warnings.
 *
 * @function logLint
 * @param {String} type
 * @param {String} severity
 * @param {Array} messages
 * @param {Number} count
 * @param {Function} chalkColor
 * @api private
 */

function logLint (type, severity, messages, count, chalkColor) {
    // If no errors or warnings are found then log test as success by default.
    if (count === 0) {
        chalk.success(`\x0ANo lint ${type.toLowerCase()}s!`);

        return undefined;
    }

    chalkColor(`\x0ALint ${type}s: ${String(count)}`);
    chalkColor(chalk.divider);

    for (let i = 0, max = messages.length; i < max; i++) {
        let item = messages[i];

        // Only log items that match severity.
        if (item.severity !== severity) { continue; }

        let rule = item.ruleId === null ? 'fatal' : item.ruleId;

        chalkColor(`Rule: ${rule}`);
        chalkColor(`Line: ${String(item.line)}`);
        chalkColor(item.message);
        chalkColor(chalk.divider);
    }
}

/**
 * @function performTests
 * @api public
 */

function performTests () {
    if (!canTest()) { return undefined; }

    testing = true;

    chalk.init('Testing...', true);

    let lintPassed = lint();

    if (deploying) {
        // Development version of dest file after testing is not
        // needed when deploying app.
        del.sync(dest, { force: true });

        // When deploying app if any test fails with errors then
        // end task throwing error.
        if (!lintPassed) {
            throwAsyncError(new Error('Cannot deploy code with errors.'));
        }
    }

    testing = false;
}

module.exports = function (grunt, fileData, options, errorCallback) {
    throwAsyncError = errorCallback;

    dest = fileData.dest;
    enabled = options.test;
    deploying = options.deploy;

    if (enabled) {
        buildLintCLI(options);
    }

    // Return object referencing to public functions.
    return {
        canTest: canTest,
        isTesting: isTesting,
        performTests: performTests
    };
};
