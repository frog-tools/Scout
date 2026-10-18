const { version } = require('./package.json');

module.exports = ({ config }) => ({ ...config, version });
