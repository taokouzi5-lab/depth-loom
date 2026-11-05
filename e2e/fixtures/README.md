# E2E fixtures

`landscape.png` is a synthetic test image generated from `landscape.svg` by the
project author. It contains no third-party photography, people, or trademarks.
The fixture is dedicated to the public domain (CC0 1.0) so it can be committed
and redistributed with the test suite.

Regenerate (requires `sharp`, available transitively via Transformers.js):

```bash
node -e "import('sharp').then(async ({default: s}) => { await s('e2e/fixtures/landscape.svg', {density: 72}).png({compressionLevel: 9}).toFile('e2e/fixtures/landscape.png') })"
```
