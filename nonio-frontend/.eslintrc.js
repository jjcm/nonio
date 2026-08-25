module.exports = {
    'env': {
        'browser': true,
        'es6': true,
        'amd': true
    },
    'extends': 'eslint:recommended',
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly'
    },
    'settings': {
        'import/parser': 'babel-eslint'
    },
    'parserOptions': {
        'ecmaVersion': 2019,
        'sourceType': 'module'
    },
    'rules': {
        'indent': [
            'error', 2, {"SwitchCase": 1}
        ],
        'linebreak-style': [
            'error',
            'windows'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'never'
        ],
        'no-case-declarations': off
    }
}