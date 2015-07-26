define('parsley/validator', [
    'parsley/utils'
], function (ParsleyUtils) {

  var requirementConverters = {
    string: function(string) {
      return string;
    },
    integer: function(string) {
      if (isNaN(string))
        throw 'Requirement is not an integer: "' + string + '"';
      return parseInt(string, 10);
    },
    number: function(string) {
      if (isNaN(string))
        throw 'Requirement is not a number: "' + string + '"';
      return parseFloat(string);
    },
    reference: function(string) { // Unused for now
      var result = $(string);
      if (result.length === 0)
        throw 'No such reference: "' + string + '"';
      return result;
    },
    regexp: function(regexp) {
      var flags = '';

      // Test if RegExp is literal, if not, nothing to be done, otherwise, we need to isolate flags and pattern
      if (!!(/^\/.*\/(?:[gimy]*)$/.test(regexp))) {
        // Replace the regexp literal string with the first match group: ([gimy]*)
        // If no flag is present, this will be a blank string
        flags = regexp.replace(/.*\/([gimy]*)$/, '$1');
        // Again, replace the regexp literal string with the first match group:
        // everything excluding the opening and closing slashes and the flags
        regexp = regexp.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
      }
      return new RegExp(regexp, flags);
    }
  };

  var convertArrayRequirement = function(string, length) {
    var m = string.match(/^\s*\[(.*)\]\s*$/)
    if (!m)
      throw 'Requirement is not an array: "' + string + '"';
    var values = m[1].split(',').map(ParsleyUtils.trimString);
    if (values.length !== length)
      throw 'Requirement has ' + values.length + ' values when ' + length + ' are needed';
    return values;
  };

  var convertRequirement = function(requirementType, string) {
    var converter = requirementConverters[requirementType || 'string'];
    if (!converter)
      throw 'Unknown requirement specification: "' + requirementType + '"';
    return converter(string);
  }


  // A Validator needs to implement two methods:
  // `validate(value, requirements...)`, returning `true`, `false`
  // `parseRequirements(requirementString), returning an array of values

  var ParsleyValidator = function(spec) {
    $.extend(this, spec);
    if (spec.parametersTransformer) {
      ParsleyUtils.warnOnce('parametersTransformer is deprecated. Use requirementType or define parseRequirements instead');
      this.parseRequirements = function(requirementString) {
        var result = spec.parametersTransformer(requirementString)
        return $.isArray(result) ? result : [result];
      };
    }
  };

  ParsleyValidator.prototype = {
    parseAndValidate: function(value, requirements) {
      var args = this.parseRequirements(requirements);
      args.unshift(value);
      return this.validate.apply(this, args);
    },

    // Returns `true` iff the given `value` is valid according the given requirements.
    validate: function(value, requirementArg1, requirementArg2) {
      if(this.fn) {
        // TODO: Guess if array
        // Legacy style validator:
        if(arguments.length > 2)
          requirementArg1 = [].slice.call(arguments, 1);
        return this.fn.call(this, value, requirementArg1);
      }

      if ($.isArray(value)) {
        if (!this.validateMultiple)
          throw 'Validator ' + this.name + ' does not handle multiple values';
        return this.validateMultiple.apply(this, arguments);
      } else {
        if (this.validateNumber) {
          if (isNaN(value))
            return false;
          value = parseFloat(value);
          return this.validateNumber.apply(this, arguments);
        }
        if (this.validateString) {
          return this.validateString.apply(this, arguments);
        }
        throw 'Validator ' + this.name + ' only handles multiple values';
      }
    },

    // Parses `requirements` into an array of arguments,
    // according to `this.requirementType`
    parseRequirements: function(requirements) {
      if ('string' !== typeof requirements) {
        // Assume requirement already parsed
        // but make sure we return an array
        return $.isArray(requirements) ? requirements : [requirements];
      }
      var type = this.requirementType;
      if ($.isArray(type)) {
        var values = convertArrayRequirement(requirements, type.length);
        for (var i = 0; i < values.length; i++)
          values[i] = convertRequirement(type[i], values[i]);
        return values;
      } else {
        return [convertRequirement(type, requirements)];
      }
    },
    // Defaults:
    requirementType: 'string',

    priority: 2

  };

  return ParsleyValidator;
});
