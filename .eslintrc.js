module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "ignorePatterns": [
        "node_modules",
        "generated",
        "**/__tests__/*",
        "**/__mocks__/*",
        "Dangerfile.*",
        "*.d.ts"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "extends": [
        "@pagopa/eslint-config/strong",
    ],
    "rules": {
        "@typescript-eslint/naming-convention": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "prefer-arrow/prefer-arrow-functions": "off",
        "functional/prefer-readonly-type": "off",
        "arrow-body-style": "off",
        "jsdoc/check-indentation": "off",
        "sort-keys": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "import/order": "off",
        "extra-rules/no-commented-out-code": "off",
        "no-console": "off",
        "sonarjs/no-identical-functions": "off",
        "@typescript-eslint/array-type": "off",
        "no-constant-condition": "off",
        "max-params": "off",
        "functional/immutable-data": "off",
        "jsdoc/newline-after-description": "off",
        "no-irregular-whitespace": "off",
        "functional/no-let": "off",
        "@typescript-eslint/ban-types": "off",
        "no-invalid-this": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-shadow": "off",
        "no-prototype-builtins": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "sonarjs/cognitive-complexity": "off",
        "@typescript-eslint/no-empty-interface": "off"
    }
}
