module.exports = {
  '*.{js,jsx,ts,tsx}': ['prettier --write', 'eslint --fix'],
  '**/*.ts?(x)': ['bin/tsc-lint.sh'],
  '*.json': ['prettier --write'],
};
