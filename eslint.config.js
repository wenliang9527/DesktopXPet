// ESLint 9 flat config
// 详见 https://eslint.org/docs/latest/use/configure/configuration-files
const tseslint = require('typescript-eslint')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const prettierConfig = require('eslint-config-prettier')

module.exports = tseslint.config(
  // 全局忽略
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      'release/**',
      'dev-app-update.yml',
      '*.cjs',
      // VSCode 扩展是独立项目,有自己的构建配置
      'extensions/**'
    ]
  },

  // TypeScript recommended 基线(适用于所有 .ts/.tsx)
  ...tseslint.configs.recommended,

  // 渲染进程:React + Hooks
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    settings: {
      react: { version: 'detect' }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // React 17+ JSX transform 不需要 import React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // React Compiler 实验性规则过于严格,暂不启用
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'warn',
      // setState in effect 规则过于严格,现有代码有合理使用
      'react-hooks/set-state-in-effect': 'warn'
    }
  },

  // 主进程 / preload:Node 环境
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    rules: {
      // 主进程允许 console(用于 electron-log 之外的调试)
      'no-console': 'off'
    }
  },

  // 项目级宽松规则:避免历史代码一次性报错过多
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },

  // Prettier 关闭与格式化冲突的规则
  prettierConfig
)
