(function (window) {  // start self executing function...

'use strict';

const CLASS = {};
const CONST = {}; // Constants
const SINGLE = {}; // Singletons

// Pointer to all CLASS module prototypes.
const _$_ = {};

window.addEventListener('load', function (e) {
    // Expose $development as $DEV.
    CONST.$DEV = $development;

    $solveDependencies();

    // Enforce immutability after all dependencies are solved.
    $freezeModules();

    // Make internal functionality inacessible.
    // Internal objects and values.
    $development = undefined;
    $loading = undefined;
    $rootClassProto = undefined;
    $descriptor = undefined;
    $hierarchy = undefined;

    // Internal functions.
    $solveDependencies = undefined;
    $wrapMain = undefined;
    $checkClasses = undefined;
    $checkMain = undefined;
    $checkClassLinks = undefined;
    $checkClassStructures = undefined;
    $appendSuperClasses = undefined;
    $appendClass = undefined;
    $linkClassPrototypes = undefined;
    $appendChildClasses = undefined;
    $defineClassProperties = undefined;
    $checkSingles = undefined;
    $checkSingleStructures = undefined;
    $appendSingles = undefined;
    $defineSingleProperties = undefined;
    $freezeModules = undefined;
    $freezeConstObject = undefined;
    $freezeConstArray = undefined;

    new CLASS.Main();
});
