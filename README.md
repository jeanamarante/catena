> # catena
> Wrapper Library for Javascript OOP

&nbsp;

_catena is a small wrapper library I made that helps me follow clean and consistent coding conventions while writing client-side Javascript apps. I am personally using catena in a project called Moebius. I do not recommend using catena in projects that require compatibility with older browsers or projects in which you feel ES6 classes might do a better job. If you do use catena and find any issues please let me know and I'll try to reply asap. :)_

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
_Run this task with the_ `grunt catena` _command._

Task targets, files and options may be specified according to the Grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

&nbsp;

### Description

catena is a wrapper library that facilites the use of prototypes and forces coding conventions that facilitate the maintainance of big projects. It is recommended that you only use catena in native apps or websites that will run in a modern browser.

&nbsp;

### Demo

Basic chess game that shows the correct way to use catena. [Click here for demo app.](https://github.com/jeanamarante/catena-demo)

&nbsp;

### Usage Example

```js
// Project configuration.
grunt.config.init({
	catena: {
		src: 'modules',
		dest: 'dist/app.js',
		watch: true
	}
});
```

#### deploy (TODO)

Run task with deploy argument `grunt catena:deploy` to minify dest file.

#### src

Path to directory where all of the Javascript files will be recursively searched and concatenated into a single file.

#### dest

Path to concatenated Javascript file.

#### watch

Set watch to true to run the catena task every time you change a file in the src directory.

&nbsp;

### Project Structure

All Javascript files should be placed inside the src directory, all of them will be concatenated recursively. All projects must have a CLASS.Main module declared as the entry point of the application.

```
src
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

#### CLASS

References all of the modules that can be instantiated. Always remember to declare the append property for all CLASS modules as object literals. The append property is what ties the properties and methods of the CLASS module to the prototype chain.

Here's a list of properties exposed by catena (Inside the prototype of CLASS instances):

* $applied
* $name

```js
// Parent.js

CLASS.Parent = function () {
	// Constructor
};

CLASS.Parent.append = {
	// Properties and methods declared in append will
	// be shared by all instances of the module.
};

// Child.js

extend('Parent', 'Child');

CLASS.Child = function () {
	// Call parent's constructor and inherit all of its properties.
	this.super();
};

CLASS.Child.append = {
	// Any properties or methods that share the same name to
	// any of the Parent's are overwritten.
};
```

&nbsp;

#### CONST

Constants used inside the app should be declared here. Properties declared inside CONST cannot be changed after the Main module is initialized. Nested objects and arrays are recursively frozen too.

```js
CONST.GRAVITY = 9.8;
```

Here's a list of constants exposed by catena: (Inside CONST)

* $DEV: Will always be true unless you run catena with the deploy argument. Useful for performing expensive tests at runtime prior to having your code in production.

&nbsp;

#### SINGLE

Singletons reference object literals, like the append property in CLASS modules. If the init method is declared in a SINGLE module, it will be invoked prior to Main being instantiated.

Here's a list of properties exposed by catena: (Inside SINGLE modules)

* $name

```js
SINGLE.Mouse = {
    // Declaring init as something other than a function will throw an error.
    init: function () {}
};
```

&nbsp;

#### extend

Chain the child's prototype with the parent's prototype. Always declare at the top of the file.

_extend(parentName: String, childName: String);_

&nbsp;

#### super

Call the parent's constructor. Always declare at the top in the constructor.

_super(args);_

```js
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

&nbsp;

#### abstract

Flag a method inside a class as abstract. Program will error out if method is called directly.

_abstract();_

```js
// Shape.js

CLASS.Shape = function () {};

CLASS.Shape.append = {
	// If method is invoked, program will error out.
	calculateArea: function () {
		this.abstract();
	}
};

// Square.js

extend('Shape', 'Square');

// Omitted constructor for brevity.

CLASS.Square.append = {
	calculateArea: function () {
		// Calculate the area of the square.
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

&nbsp;

##### throwError

Arguments are optional. type will always be shown as uppercase. You can also use this method inside SINGLE modules.

_throwError(message: String, type: String);_

```js
// Shape.js

CLASS.GUIComponent = function (id) {
    this._el = document.getElementById(id);

    if (!this._el) {
        this.throwError('Element could not be found.');
    }
};

// Omitted append for brevity.
```

&nbsp;

#### Overriding Methods

Invoke a method from a specific class while keeping the same context (object reference).

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
	// The _$_ pointer references all CLASS module prototypes.
	callMe: function () {
		_$_.Parent.callMe.call(this);

		alert('With _$_ we can expand the functionality of Parent.callMe in Child.callMe');
	}
};
```

&nbsp;

#### Access Modifiers

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

It is strongly advised to not start any of your references with $ as catena uses this convention internally to solve dependencies at runtime.

```js
$solveDependencies = function () {};
```

&nbsp;

#### Utility Functions

Useful functions that catena uses internally that are exposed for you to use.

&nbsp;

##### isNaN,&nbsp; isNull,&nbsp; isArray,&nbsp; isObject,&nbsp; isNumber,&nbsp; isString,&nbsp; isBoolean,&nbsp; isFunction,&nbsp; isInstance,&nbsp; isUndefined

Collection of functions for data type checking.

_isArray(arg: *);_

isInstance is unique compared to the other functions as it requires two arguments instead of one.

_isInstance(type: *, arg: *);_
_isInstance(CLASS.Shape, new CLASS.Triangle());_
