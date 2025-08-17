import type { Config } from 'jest';
const { createCjsPreset } = require('jest-preset-angular/presets') as typeof import('jest-preset-angular/presets');

export default {
  ...createCjsPreset({
    tsconfig: '<rootDir>/projects/ng-queuex/tsconfig.test.json',
  }),
  setupFilesAfterEnv: ['<rootDir>/projects/ng-queuex/setup-jest.ts'],
  testMatch: ['<rootDir>/projects/**/*.test.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist',
    '<rootDir>/.vscode',
    '<rootDir>/.angular'
  ]
} satisfies Config;
