(function (window) {  // start self executing function...

'use strict';

const CLASS = {};
const CONST = {}; // Constants
const SINGLE = {}; // Singletons

window.addEventListener('load', function (e) {
    // Do not run callback for load event if an error has
    // been thrown while loading.
    if ($errorThrown) { return undefined; }

    // Expose $development as $DEV.
    CONST.$DEV = $development;

    $solveDependencies();

    // Enforce immutability after all dependencies are solved.
    $freezeModules();

    // Make internal functionality inacessible.
    // Internal objects and values.
    $development = undefined;
    $loading = undefined;
    $errorThrown = undefined;
    $rootClassProto = undefined;
    $descriptor = undefined;
    $singlePostInitModules = undefined;
    $hierarchy = undefined;

    // Internal functions.
    $solveDependencies = undefined;
    $wrapMain = undefined;
    $checkClasses = undefined;
    $checkMain = undefined;
    $checkClassLinks = undefined;
    $checkClassStructures = undefined;
    $appendRootClasses = undefined;
    $appendClass = undefined;
    $linkClassPrototypes = undefined;
    $appendChildClasses = undefined;
    $defineClassProperties = undefined;
    $checkSingles = undefined;
    $checkSingleStructures = undefined;
    $appendSingles = undefined;
    $defineSingleProperties = undefined;
    $invokeSinglePostInits = undefined;
    $freezeModules = undefined;
    $freezeConstObject = undefined;
    $freezeConstArray = undefined;

    new CLASS.Main();
});
