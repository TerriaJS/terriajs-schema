"use strict";
/*jshint -W030, node:true*/

var v = new (require('jsonschema').Validator)();
var ValidatorResult = require('jsonschema').ValidatorResult;
var when = require('when');
var node = require('when/node');
var fn = require('when/function');
var fs = require('fs');
var fsp = node.liftAll(fs);
var path = require('path');
var defaultVersion = 'master';
var schemaBasePath = path.join(__dirname, 'schema');
var argv, schemaPath;
var rootSchema;

var readFile = function(filename){ return fsp.readFile(filename, 'utf8'); };

function validate(filenames) {
    function isUsefulError(error) {
        // Now the delicate art of trying to guess which errors are meaningful and which are just spam.
        // We suppress "meta-errors", assuming that a useful error is deeper in the tree.
        return ['allOf','anyOf','not','oneOf'].indexOf(error.name) === -1;
    }
    var processed = 0, errors = 0, pad = '  ';
    return when.map(when.map(filenames, readFile), function(fileContent, i) {
        var result  = v.validate(JSON.parse(fileContent), rootSchema);
        if (result.errors.length) {
            console.error('FAILED: ' + filenames[i] + ':' );
            var shownErrors = result.errors.filter(isUsefulError);
            if (!shownErrors.length) {
                shownErrors = result.errors;
            }
            shownErrors.forEach(function(error) {
              console.error(pad + error.name + ' ' +  error.stack);
              console.error(pad + '  Value: ' + JSON.stringify(error.instance).slice(0,160));
            });
            errors ++;
        } else {
            argv.quiet || console.log('OK:     ' + filenames[i]);
        }
    }).then(function() { 
        if (errors > 0) {
            console.log(errors + ' catalog files failed validation.');
        }
        return errors;
    }).catch(function(err) {
        console.error("FATAL ERROR: Problem loading file: " + err.message);
        return 1;
    });
}

function loadNextSchema(filename) {
    return readFile(path.join(schemaPath, filename)).then(function(data) {
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
            return loadNextSchema(next);
        } else {
            argv.quiet || console.log('Schema loaded.');
        }
    }).catch(function(err) {
        console.log(err);
        if (filename === 'Catalog.json' && argv.version !== defaultVersion) {
            schemaPath = path.join(schemaBasePath, defaultVersion);
            console.warn("\nWARNING: We don't have a schema for version '" + argv.version + "'. Falling back to '" + defaultVersion + "'.");
            return loadNextSchema(filename);
        } else {
            throw Error("\nERROR: Missing file " + path.join(schemaPath, filename));
        }
    });
}
/**
 * Runs validation for a number of files.
 * @param  {Object} options yargs values
 * @return {Object}         Promise for the number of validation errors.
 */
module.exports = function(options) {
    argv = options;
    argv.version = argv.version || defaultVersion;
    !argv.quiet && console.log('TerriaJS-Schema validator v' + require('./package.json').version);
    if (argv.terriajsdir) {
        try  {
            argv.version = JSON.parse(fs.readFileSync(path.join(argv.terriajsdir, 'package.json'), 'utf8')).version;
        } catch (e) {
            console.warn(e.message);
            argv.version = defaultVersion;
            console.warn('Warning: using version "' + argv.version + '".');
        }
    }
    schemaPath = argv.schemadir || path.join(schemaBasePath, argv.version);
    argv.quiet || process.stdout.write('Loading schema: ' + path.join(schemaPath, '/Catalog.json ... '));
    return loadNextSchema('Catalog.json').then(function() { 
        return validate(argv._);
    });
};
module.exports.defaultVersion = defaultVersion;