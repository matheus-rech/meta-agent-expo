const fs = require('fs');
const path = require('path');

// Create stub for react-native-worklets/plugin if not installed.
// babel-preset-expo tries to require it when detected, but we don't
// use worklets or reanimated in this project.
const dir = path.join(__dirname, '..', 'node_modules', 'react-native-worklets');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'plugin.js'),
    'module.exports = function() { return { visitor: {} }; };'
  );
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    '{"name":"react-native-worklets","version":"0.0.0","main":"plugin.js"}'
  );
  console.log('Created react-native-worklets stub');
}
