import * as h from './hidden';
import makeModulePlugin from './babelPlugin';

const makeModuleTransformer = (babelCore, makeImporter) => {
  function transformSource(source, sourceOptions = {}) {
    // Transform the script/expression source for import expressions.
    const parserPlugins = ['dynamicImport'];
    if (sourceOptions.sourceType === 'module') {
      parserPlugins.push('importMeta');
    }

    // console.log(`transforming`, sourceOptions, source);
    const modulePlugin = makeModulePlugin(sourceOptions);
    const output = babelCore.transform(source, {
      parserOpts: {
        plugins: parserPlugins,
      },
      generatorOpts: {
        retainLines: true,
      },
      plugins: [modulePlugin],
    });

    // console.log(`transformed to`, output.code);
    return output.code;
  }

  function createStaticRecord(moduleSource) {
    // Transform the Module source code.
    const sourceOptions = {
      sourceType: 'module',
      // exportNames of variables that are only initialized and used, but
      // never assigned to. The exportName 'default' has no localName.
      fixedExports: [],
      // Record of imported module specifier names to list of importNames.
      // The importName '*' is that module's module namespace object.
      imports: {},
      // exportNames of variables that are assigned to, or reexported and
      // therefore assumed live. A reexported variable might not have any
      // localName.
      liveExportMap: {},
      hoistedDecls: [],
      importSources: {},
      importDecls: [],
    };
    const scriptSource = transformSource(moduleSource, sourceOptions);

    let preamble = sourceOptions.importDecls.join(',');
    if (preamble !== '') {
      preamble = `let ${preamble};`;
    }
    const js = JSON.stringify;
    const isrc = sourceOptions.importSources;
    preamble += `${h.HIDDEN_IMPORTS}({${Object.keys(isrc)
      .map(
        src =>
          `${js(src)}:{${Object.entries(isrc[src])
            .map(([exp, upds]) => `${js(exp)}: [${upds.join(',')}]`)
            .join(',')}}`,
      )
      .join(',')}});`;
    preamble += sourceOptions.hoistedDecls
      .map(vname => `${h.HIDDEN_LIVE}.${vname}();`)
      .join('');

    // The functor captures the SES `arguments`, which is definitely
    // less bad than the functor's arguments (which we are trying to
    // hide.
    //
    // It must also be strict to enforce strictness of modules.
    // We use destructuring parameters, so 'use strict' is not allowed
    // but the function actually is strict.
    const functorSource = `\
(({ \
  imports: ${h.HIDDEN_IMPORTS}, \
  constVar: ${h.HIDDEN_ONCE}, \
  letVar: ${h.HIDDEN_LIVE}, \
 }) => { \
  ${preamble} \
  ${scriptSource}
})`;

    const moduleStaticRecord = {
      moduleSource,
      imports: sourceOptions.imports,
      liveExportMap: sourceOptions.liveExportMap,
      fixedExports: sourceOptions.fixedExports,
      functorSource,
    };
    return moduleStaticRecord;
  }

  return {
    rewrite(ss) {
      // Transform the source into evaluable form.
      const { allowHidden, endowments, src: source, url } = ss;

      // Make an importer that uses our transform for its submodules.
      function curryImporter(srcSpec) {
        return makeImporter(srcSpec, endowments);
      }

      // Create an import expression for the given URL.
      function makeImportExpr() {
        // TODO: Provide a way to allow hardening of the import expression.
        const importExpr = spec => curryImporter({ url, spec });
        importExpr.meta = Object.create(null);
        importExpr.meta.url = url;
        return importExpr;
      }

      // Add the $h_import hidden endowment for import expressions.
      Object.assign(endowments, {
        [h.HIDDEN_IMPORT]: makeImportExpr(),
      });

      if (ss.sourceType === 'module') {
        // Do the rewrite of our own sources.
        const linkageRecord = createStaticRecord(source);
        Object.assign(endowments, {
          // Import our own source directly, returning a promise.
          [h.HIDDEN_IMPORT_SELF]: curryImporter({ url, linkageRecord }),
        });
        return {
          ...ss,
          endowments,
          allowHidden: true,
          linkageRecord,
          sourceType: 'script',
          src: `${h.HIDDEN_IMPORT_SELF}();`,
        };
      }

      // Transform the Script or Expression source code with import expression.
      const maybeSource = transformSource(source, {
        allowHidden,
        sourceType: 'script',
      });

      // Work around Babel appending semicolons.
      const actualSource =
        ss.sourceType === 'expression' &&
        maybeSource.endsWith(';') &&
        !source.endsWith(';')
          ? maybeSource.slice(0, -1)
          : maybeSource;

      // console.log(ss.isExpr, `generated`, src, `from`, ast);
      return { ...ss, endowments, src: actualSource };
    },
  };
};

export default makeModuleTransformer;
