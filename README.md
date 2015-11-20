## Forked from https://github.com/frozeman/meteor-build-client

1.Change to a requireable module.
<br />
2.Accept --debug params.
<br />

##Sample

```js
const path = require('path');
require('meteor-client-builder')({
  sourcePath: path.resolve('meteor'),
  buildPath: path.resolve('client'),
  args: ['--debug']
});
```