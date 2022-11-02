module.exports = {
    "settings": {
        "react": {
            "version": "detect",
        },
    },
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "next/core-web-vitals",
        "prettier",
    ],
    "overrides": [
        {
            "files": [
                "**/*.js",
                "**/*.jsx",
                "**/*.ts",
                "**/*.tsx"
            ],
            "env": {
                "jest": true
            }
        }
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "react",
        "@typescript-eslint"
    ],
    "rules": {
    }
}
