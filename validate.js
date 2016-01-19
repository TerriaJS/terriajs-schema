/*jshint -W030 */
var v = new (require('jsonschema').Validator)();
var ValidatorResult = require('jsonschema').ValidatorResult;
var fs = require('fs');

var defaultVersion = 'master';

var argv = require('yargs')
    .usage('$0 [--version <version>] <catalog.json> [<anothercatalog.json> ...]')
    .describe('version', 'Version of schema to validate against (master, x.y.z)')
    .default('version', defaultVersion)
    .describe('terriajsdir', 'Directory containing TerriaJS, to deduce version automatically.')
    .describe('quiet', 'Suppress non-error output.')
    .boolean('quiet')
    .demand(1)
    .help('help')
    .argv;

argv.catalogFile = argv._[0];

if (argv.terriajsdir) {
    try  {
        argv.version = require( (argv.terriajsdir.match(/^[.\/]/) ? '' : './') + argv.terriajsdir + '/package.json').version;
    } catch (e) {
        console.warn(e.message);
        argv.version = defaultVersion;
        console.warn('Warning: using version "' + argv.version + '".');
    }

}

var path = argv.version;

var rootSchema;
function validate() {
    var filenames = argv._;
    var processed = 0, errors = 0;
    filenames.forEach(function(filename) {
        fs.readFile(filename, 'utf8', function(err, data) {
            if (err) {
                console.error("ERROR: File not found: " + filename);
                errors ++;
            } else {
                data = JSON.parse(data);
                var result  = v.validate(data, rootSchema);
                if (result.errors.length) {
                    process.stderr.write('FAILED: ' + filename);
                    argv.quiet || result.errors.forEach(function(error) {
                        if (error.instance.name && error.instance.type) {
                            // With our current schema, there is never a helpful error.message - just X didn't meet the oneOf criteria.
                            console.error('        "' + error.instance.name + '" (' + error.instance.type + ') ');
                        } else {
                          console.error(error.stack);
                          console.error('where ' + error.property + ' is: ');
                          console.error(JSON.stringify(error.instance, undefined, 2));
                        }
                    });
                    errors ++ ;
                } else {
                    argv.quiet || console.log('OK:     ' + filename);
                }
            }
            if (++processed === filenames.length) {
                done(errors);
            }
        });
    });
}

function done(errorCount) {
    if (errorCount > 0) {
        console.log(errorCount + ' catalog files failed validation.');
        process.exit(1);
    }
}

function loadNextSchema(filename, callback) {
    fs.readFile(path + '/' + filename, 'utf8', function(err, data) {
        if (err) {
            console.log();
            if (filename === 'Catalog.json' && argv.version !== defaultVersion) {
                path = defaultVersion;
                console.warn("WARNING: We don't have a schema for version '" + argv.version + "'. Falling back to '" + path + "'.");
                loadNextSchema(filename, callback);
            } else {
                console.error("ERROR: Missing file " + path + '/' + filename);
                process.exit(1);
            }
        } else {
            var schema = JSON.parse(data);
            if (!rootSchema) {
                rootSchema = schema;
                schema.id = '/' + filename;
            } else {
                schema.id = filename;
            }
            v.addSchema(schema);
            var next = v.unresolvedRefs.shift();
            if (next) {
                loadNextSchema(next, callback);
            } else {
                argv.quiet || console.log('Schema loaded.');
                callback();
            }
        }
    });
}
argv.quiet || process.stdout.write('Loading schema: ' + path + '/Catalog.json ... ');
loadNextSchema('Catalog.json', validate);