# TODO

- [x] Check if we can save on Entity Proxy by defining accessors for each component
    - One drawback is that we can't delete components with `delete entity.component`
    - We can use `entity.component = undefined` instead
