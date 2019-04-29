> # catena
> Prototype Helper for JavaScript

&nbsp;

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install catena --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('catena');
```

&nbsp;

## Task

_**You must have the java command line tool installed for the google-closure-compiler npm module.**_

_Run this task with the_ `grunt catena` _command._

Task targets, files and options may be specified according to the Grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

&nbsp;

### Description

catena is a framework that facilites the use of prototypes and forces coding conventions that make the maintenance of big projects easier.

&nbsp;

### Demo

Basic chess game built with catena. [Click here for demo app.](https://github.com/jeanamarante/catena-demo)

&nbsp;

### Usage Example

```js
// Project configuration.
grunt.config.init({
    catena: {
        options: {
            externs: ['BLITTER', 'YUI', 'jQuery', 'd3'],
            license: 'LICENSE'
        },
        dev {
            src: ['js/'], // Must be directories.
            dest: 'dist/app.js',
            options: {
            	watch: true
            }
        },
        deploy {
            src: ['js/'],
            dest: 'dist/app.js',
            options: {
                test: true,
            	deploy: true
            }
        }
    }
});
```

__options.watch__  
Type: `Boolean`  
Default: `false`

Set watch to true to write dest file everytime time you change a file in one of the src directories. If deploy is true then watch will not run.

__options.test__  
Type: `Boolean`  
Default: `false`

Run static code analysis tools before deploying. If errors are found deploy will be canceled.

__options.lint__  
Type: `Boolean`  
Default: `true`

Analyze code with eslint when test is true.

__options.deploy__  
Type: `Boolean`  
Default: `false`

Optimize dest file for deployment. Will perform ADVANCED_COMPILATION with the closure compiler after pre optimization phase if minify is set to true.

__options.minify__  
Type: `Boolean`  
Default: `true`

dest file will be minified when deploy is true. If minify is false then dest file will be beautified instead.

__options.license__  
Type: `String`

Path to file containing license agreement.

__options.externs__  
Type: `String[]`  
Default: `[]`

List of globally exposed dependencies (libraries, frameworks, etc.) that prevent the closure compiler from throwing an error when minifying, externs are only applied when test or deploy is true.

_When working with external modules in catena, you should access properties and invoke methods using string literals. This will prevent the closure compiler from minifying property names for external modules. The closure compiler is set to use ADVANCED_COMPILATION always, by using string literals the compiler will leave property names as they are._

```js
// Wrong
BLITTER.getImageData('test-icon');

require('path').isAbsolute('/');

// Correct
BLITTER['getImageData']('test-icon');

require('path')['isAbsolute']('/');
```

&nbsp;

## Project Structure

All JavaScript files should be placed inside the src directories, all of them will be concatenated recursively. All projects must have a CLASS.Main module declared as the entry point of the application.

_You should only declare one module per file. catena will parse all JavaScript files in the src directories individually when deploy argument is used. Parsing will fail if more than one module is declared in a file._

```
srcDir
│   Main.js
│
├─── dir-one
│    │   FileOne.js
│    └─  FileTwo.js
│
└─── dir-two
     └─  FileThree.js
```

&nbsp;

## CLASS

References all of the modules that can be instantiated. Always remember to declare the append property for all CLASS modules as object literals. Properties declared in the append object are tied to the prototype of the CLASS module.

Here's a list of internal properties exposed by catena (inside the prototype of CLASS modules):

* $isClass
* $applied
* $parentName
* $name

```js
// Parent.js

CLASS.Parent = function () {
    // Constructor
};

CLASS.Parent.append = {
    // Properties declared in append will be shared by
    // all instances of the module in the prototype.
};

// Child.js

extend('Parent', 'Child');

CLASS.Child = function () {
    // Call parent's constructor and inherit all of its properties.
    this.super();
};

CLASS.Child.append = {
    // Properties that share the same name to any of the Parent's
    // append properties can be overwritten or overridden.
};
```

__extend__

Chain the child's prototype with the parent's prototype. Always declare at the top of the file.

```js
extend (parentName: String, childName: String)
```

__super__

Call the parent's constructor.

```js
super (args: Array)

// Example
// Point.js

CLASS.Point = function (x, y) {
    this.x = x;
    this.y = y;
};

// append omitted for brevity.

// Square.js

extend('Point', 'Square');

CLASS.Square = function (x, y, width, height) {
    // Pass arguments into the parent's constructor.
    this.super(x, y);

    this.width = width;
    this.height = height;
};

// append omitted for brevity.
```

__abstract__

Flag a method as abstract.

```js
abstract ()

// Example
// Shape.js

CLASS.Shape = function () {};

CLASS.Shape.append = {
    // If method is invoked directly, program will error out.
    calculateArea: function () {
        this.abstract();
    }
};

// Square.js

extend('Shape', 'Square');

// Omitted constructor for brevity.

CLASS.Square.append = {
    calculateArea: function () {
        // Calculate the area of the square with overwritten method.
    }
};

// Triangle.js

extend('Shape', 'Triangle');

// Omitted constructor for brevity.

CLASS.Triangle.append = {
    calculateArea: function () {
        // Calculate the area of the triangle.
    }
};
```

__Overriding Methods__

Invoke a method from a parent class while keeping the same context (instance reference).

```js
// Parent.js

CLASS.Parent = function () {};

CLASS.Parent.append = {
    callMe: function () {}
};

// Child.js

extend('Parent', 'Child');

CLASS.Child = function () {
    this.super(); // Call parent's constructor.
};

CLASS.Child.append = {
    // The _$_ shorthand references all CLASS module prototypes.
    callMe: function () {
        _$_.Parent.callMe.call(this);

        alert('With _$_ we can expand the functionality of Parent.callMe in Child.callMe');
    }
};
```

&nbsp;

## CONST

Constants used inside the app should be declared here. Properties declared inside CONST cannot be changed after the CLASS.Main module is initialized. Nested objects and arrays are recursively frozen too.

Here's a list of constants exposed by catena (inside CONST):

* $DEV: Will always be true unless you run catena with the deploy argument. Useful for performing tests at runtime prior to having your code deployed.

```js
CONST.GRAVITY = 9.8;
```

&nbsp;

## SINGLE

Singletons reference object literals, like the append property in CLASS modules. If the init or postInit method are declared in a SINGLE module, they will be invoked prior to CLASS.Main being instantiated.

Here's a list of internal properties exposed by catena (inside SINGLE modules):

* $isSingle
* $name

```js
SINGLE.Mouse = {
    // Declaring init or postInit as something other than a function will throw an error.
    // init and postInit will be unreachable after being invoked at the start of the program.
    init: function () {
        // Initialize singleton properties.
    },

    // postInit is invoked after all init methods are invoked.
    postInit: function () {
        // Interact with other initialized singletons.
    }
};
```

&nbsp;

## Access Modifiers

Public properties can be read, written and invoked externally.

```js
this.x = 0;
```

Private properties can only be read, written and invoked internally.

```js
this._x = 0;
```

Protected properties can only be read, written and invoked by instances of the same CLASS module.

```js
this.__x = 0;
```

_It is strongly advised to not start any references with $ as catena uses this convention internally to solve dependencies at runtime. The only internal properties you should access are the ones declared in CONST. Internal properties exposed in CLASS and SINGLE modules are used to solve dependencies at runtime and help with debugging when CONST.$DEV is true, you should never access them in your application as they will not be declared when deploying._

```js
// Wrong
CLASS.Test = function () {
    this.$testValue = 0;
};

CLASS.Test.append = {
    $testMethod: function () {}
};

let $testFunction = function () {};

// Correct
if (CONST.$DEV) {
    // Do expensive test.
}
```

&nbsp;

## Helper API

Functions that catena uses internally and are exposed to be used externally also.

&nbsp;

### Error Functions

__throwError__

All arguments are optional. Type will always be shown as uppercase. The index determines how far back in the call stack must be traveled to find the method that will be pretty printed beside the module's name in the message.

```js
throwError (message: String, type: String, module: Object, index: Number)
```

__throwArgumentError__

For throwArgumentError the last two params are optional but the first two are required for the error message.

```js
throwArgumentError (name: String, type: String, module: Object, index: Number)
```

&nbsp;

### Validation Functions

Type checking functions.

__isNaN,&nbsp; isNull,&nbsp; isArray,&nbsp; isEmptyArray,&nbsp; isNonEmptyArray,&nbsp; isObject,&nbsp; isNumber,&nbsp; isString,&nbsp; isEmptyString,&nbsp; isNonEmptyString,&nbsp; isBoolean,&nbsp; isFunction,&nbsp; isUndefined__

All of these functions require only one argument.

```js
func (arg: *) : Boolean

// Example
isArray([]);
```

__isInstance__

isInstance is unique compared to the other validation functions as it requires two arguments instead of one.

```js
isInstance (type: *, arg: *) : Boolean

// Example
isInstance(CLASS.Shape, new CLASS.Triangle());
```

&nbsp;

### Test Functions

__testArray,&nbsp; testEmptyArray,&nbsp; testNonEmptyArray,&nbsp; testObject,&nbsp; testNumber,&nbsp; testString,&nbsp; testEmptyString,&nbsp; testNonEmptyString,&nbsp; testBoolean,&nbsp; testFunction__

Functions that will check if type is valid and error the program out with throwArgumentError if type is invalid.

```js
testArray (arg: *, argName: String, module: Object, errorIndex: Number)
```

__testInstance,&nbsp; testOptionalInstance__

testInstance and testOptionalInstance are unique as they require two more arguments than the other functions.

```js
testInstance (type: *, arg: *, typeName: String, argName: String, module: Object, errorIndex: Number)
```
