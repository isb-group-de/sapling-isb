module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': [
      '@swc/jest',
      {
        jsc: { target: 'es2022' },
        module: { type: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!@nestjs/)'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mikro-orm/core$': '<rootDir>/../test-support/mikro-orm-core.mock.cjs',
    '^@mikro-orm/decorators/legacy$':
      '<rootDir>/../test-support/mikro-orm-decorators-legacy.mock.cjs',
    '^@mikro-orm/nestjs$': '<rootDir>/../test-support/mikro-orm-nestjs.mock.cjs',
    '^@mikro-orm/postgresql$': '<rootDir>/../test-support/mikro-orm-postgresql.mock.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
