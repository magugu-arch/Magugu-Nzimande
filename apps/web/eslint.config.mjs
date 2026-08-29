import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**'],
  },
  {
    rules: {
      // Food imagery is served as pre-generated derivatives through a <picture>
      // with a srcset, so next/image has nothing left to optimise here.
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // A non-null assertion needs a comment saying why it holds, which a rule
      // cannot check; this keeps them rare enough to spot in review.
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
];

export default config;
