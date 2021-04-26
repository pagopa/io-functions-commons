# io-functions-commons

Common code across Azure functions of project IO.

To release a new package on GitHub and npm:

yarn release-it <minor|major|patch>

## Upgrading from 13.x to 14.x

Version 14.x is the first version that uses italia-utils 5.x,
a major upgrade to the package that generates the provided Typescript definitions.

This translates in the fact that you must upgrade italia-utils to a version >= 5.x
if you want to upgrade your deps using io-functions-common 14.x.

testpr
