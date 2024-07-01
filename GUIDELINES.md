# Livelink Contribution Guidelines

## **PHILOSOPHY**

### SRP to be SOLID

Ensure each logic block is contained within a dedicated interface to enhance readability and maintainability.

```
1 function/module/class = 1 responsibility
```

### Encapsulation Forever

Encapsulate class functions and methods within an interface to reduce complexity, making the code easier to maintain and extend.

### If you spot it, you clean it

Before pushing changes, ensure any created or modified files are cleaned according to these guidelines.

## **COMMENTS**

### Always explain commented code

Always provide a line explaining the purpose of any commented code. If there is no explanation, remove the comment.

### JSDoc

Use JSDoc to annotate everything, classes, attributes and methods.

```javascript
/**
 * A classic class.
 */
class MyClass {
    /**
     * Some attribute.
     */
    my_attribute: Type;

    /**
     * Some method.
     */
    myMethod() : ReturnType {}
}
```

## **NAMING CONVENTION**

-   `PascalCase` for class names, enums, types and interfaces.
-   `camelCase` for class methods and functions.
-   `snake_case` for variables, class fields and function parameters.

## **CLASSES**

### Access modifiers

#### For any class

-   Use `#` prefix for [Private Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties).
-   Use the `protected` TypeScript keyword with a `_` prefix, as `protected` cannot be combined with the `#` prefix.
-   Use the `@internal` JSDoc annotation for properties that should not emit their TypeScript declaration, working around the lack of a `friend` concept in TypeScript to allow select classes access to private members without exposing them to everyone.
-   Do not use the `public` TypeScript keyword; it is implicit.
-   **Always** specify explicitly the return type of a function/method

Example:

```typescript
/**
 * A terrific class.
 */
class MyClass {
    /**
     * A public attribute that can be accessed by anyone.
     */
    my_public_field: Type;

    /**
     * An attribute strictly private to the class.
     */
    #my_private_field: Type;

    /**
     * An attribute that can be accessed by any derived class.
     */
    protected _my_protected_field: Type;

    /**
     * An attribute that can technically be accessed by anyone but won't be exported in the
     * Typescript type declaration.
     * @internal
     */
    _my_friend_field: Type;

    /**
     * A method that can be called by anyone.
     */
    myPublicMethod(): ReturnType {
        // do something
    }

    /**
     * A method that can only be called by another method of the class.
     */
    #myPrivateMethod(): ReturnType {
        // do something
    }

    /**
     * A method that can only be called by another method of the class or any method of any
     * derived class.
     */
    protected _myProtectedMethod(): ReturnType {
        // do something
    }

    /**
     * A method that can technically be called by anyone but that won't be exposed in the emitted
     * Typescript type declaration.
     * @internal
     */
    _myFriendMethod(): ReturnType {
        // do something
    }
}
```

#### For a [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) object like [Entity](./livelink.js/sources/Entity.ts):

-   Use the `private` TypeScript keyword instead of the `#` prefix.

Example:

```javascript
/**
 * A class that's is going to be used through a Proxy.
 */
class MyProxiedClass {
    /**
     * A field that needs to be private to the class.
     */
    private _my_private_field: Type;

    /**
     * A method that needs to be private to the class.
     */
    private _myPrivateMethod1() : ReturnType {}
}
```

Reason: `#` does not work properly with proxied objects.
