const currentDate = new Date();

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 70000,
  coverageDirectory: './test/out',
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test/out',
        filename: 'index.html',
        pageTitle: `Automatic Test Results. Execution: ${currentDate.toLocaleString()}`,
      },
    ],
  ],
};
