#!/usr/bin/env node
var argv = require('yargs')
    .usage('$0 [--version <version>] <catalog.json> [<anothercatalog.json> ...]')
    .describe('version', 'Version of schema to validate against (master, x.y.z)')
    .default('version', defaultVersion)
    .describe('terriajsdir', 'Directory containing TerriaJS, to deduce version automatically.')
    .describe('quiet', 'Suppress non-error output.')
    .describe('schemadir', 'Path to the exact schema dir, to skip all schema detection logic.')
    .boolean('quiet')
    .demand(1)
    .help('help')
    .argv;

argv.catalogFile = argv._[0];

require('./validateSchema')(argv);