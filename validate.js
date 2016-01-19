/*jshint -W030 */
var v = new (require('jsonschema').Validator)();
var ValidatorResult = require('jsonschema').ValidatorResult;
var fs = require('fs');

var argv = require('yargs')
    .usage('$0 [--version <version>] <catalog.json> [<anothercatalog.json> ...]')
    .describe('version', 'Version of schema to validate against (master, x.y.z)')
    .default('version', 'master')
    .describe('quiet', 'Suppress non-error output.')
    .boolean('quiet')
    .demand(1)
    .help('help')
    .argv;

argv.catalogFile = argv._[0];
var path = argv.version;
var rootSchema;
function validate() {
    var filenames = argv._;
    var processed = 0, errors = 0;
    filenames.forEach(function(filename) {
        fs.readFile(filename, 'utf8', function(err, data) {
            data = JSON.parse(data);
            var result  = v.validate(data, rootSchema);
            if (result.errors.length) {
                process.stdout.write('FAILED: ' + filename);
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

function loadNextSchema(filename) {
    fs.readFile(path + '/' + filename, 'utf8', function(err, data) {
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
            loadNextSchema(next);
        } else {
            argv.quiet || console.log('Done.');
            validate();
        }
    });
}
argv.quiet || process.stdout.write('Loading schema: ' + path + '/Catalog.json ... ');
loadNextSchema('Catalog.json');