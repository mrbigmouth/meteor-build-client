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
  root_url: 'http://localhost:7892',
  ddp_url: 'http://localhost:7893',
  template: fs.readFileSync(path.resolve(__dirname, 'index.html'), {encoding: 'utf-8'}),
  args: ['--debug']
});
```