module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/gmail.ts',
    'lib/userGmail.ts',
    'lib/sharedGmail.ts',
    'app/api/mail/send/route.ts',
    'app/api/mail/reply/route.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
  ],
};
