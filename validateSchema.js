/*jshint -W030 */

var v = new (require('jsonschema').Validator)();
var ValidatorResult = require('jsonschema').ValidatorResult;
var fs = require('fs');
var path = require('path');
var defaultVersion = 'master';
var schemaBasePath = path.join(__dirname, 'schema');
var argv;
var schemaPath = argv.schemadir || path.join(schemaBasePath, argv.version);
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
                var result  = v.validate(data, rootSchema, {/*throwError: true*/});
                if (result.errors.length) {
                    var pad = '  ';
                    console.error('FAILED: ' + filename + ':' );
                    argv.quiet || result.errors.forEach(function(error) {
                        // Now the delicate art of trying to guess which errors are meaningful and which are just spam.
                        // We suppress "meta-errors", assuming that a useful error is deeper in the tree.
                        if (['allOf','anyOf','not','oneOf'].indexOf(error.name) === -1) {
                          console.error(pad + error.name + ' ' +  error.stack);
                          console.error(pad + 'where ' + error.property + ' is ' + JSON.stringify(error.instance).slice(0,160));
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
    fs.readFile(path.join(schemaPath, filename), 'utf8', function(err, data) {
        if (err) {
            console.log();
            if (filename === 'Catalog.json' && argv.version !== defaultVersion) {
                schemaPath = path.join(schemaBasePath, defaultVersion);
                console.warn("WARNING: We don't have a schema for version '" + argv.version + "'. Falling back to '" + defaultVersion + "'.");
                loadNextSchema(filename, callback);
            } else {
                console.error("ERROR: Missing file " + path.join(schemaPath, filename));
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

module.exports = function(options) {
    argv = options;
    if (argv.terriajsdir) {
        try  {
            argv.version = JSON.parse(fs.readFileSync(path.join(argv.terriajsdir, 'package.json'), 'utf8')).version;
        } catch (e) {
            console.warn(e.message);
            argv.version = defaultVersion;
            console.warn('Warning: using version "' + argv.version + '".');
        }
    }
    argv.quiet || process.stdout.write('Loading schema: ' + path.join(schemaPath, '/Catalog.json ... '));
    loadNextSchema('Catalog.json', validate);
};