import test from 'ava';
import '../ses.js';

lockdown();

test('static module record constructor', t => {
  const msr = new StaticModuleRecord(`
    import foo from 'import-default-export-from-me.js';
    import oof from 'import-default-export-from-me.js';
    import * as bar from 'import-all-from-me.js';
    import { fizz, buzz } from 'import-named-exports-from-me.js';
    import { color as colour } from 'import-named-export-and-rename.js';

    export let quuux = null;

    export { qux } from 'import-and-reexport-name-from-me.js';
    export * from 'import-and-export-all.js';
    export default 42;
    export const quux = 'Hello, World!';

    // Late binding of an exported variable.
    quuux = 'Hello, World!';
  `);

  t.is(
    '[object StaticModuleRecord]',
    msr.toString(),
    'instance string representation should be fixed',
  );
  t.is(
    'function StaticModuleRecord() { [native code] }',
    StaticModuleRecord.toString(),
    'constructor string representation should be fixed',
  );

  t.deepEqual(
    msr.imports,
    [
      'import-all-from-me.js',
      'import-and-export-all.js',
      'import-and-reexport-name-from-me.js',
      'import-default-export-from-me.js',
      'import-named-export-and-rename.js',
      'import-named-exports-from-me.js',
    ],
    'should capture sorted unique imports',
  );

  t.truthy(Object.isFrozen(msr), 'StaticModuleRecords should be frozen');
  t.truthy(
    Object.isFrozen(msr.imports),
    'StaticModuleRecord imports should be frozen',
  );
});
