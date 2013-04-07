var fs = require('fs');
var Lambda = function() {
	var identity = function(x) {
		return x;
	};
	var equation_parse = function(expr) {
		var parts = expr.split(/\s*=\s*/);
		return ['=', parts[0], parse(parts[1])];
	};
	var lambda_parse = function(expr) {
		var parts = expr.split('->');
		return ['lambda', parts[0].substr(1), parse(parts.slice(1).join('->'))];
	};
	var invocation_recursive_parse = function(fn, arguments) {
		var arg = arguments.shift(),
			application = [fn, arg.match(/^\([\s\S]+\)$/) ? parse(arg.substr(1, arg.length-2)) : arg];
		return arguments.length > 0 ? invocation_recursive_parse(application, arguments) : application;
	};
	var invocation_parse = function(expr) {
		var parts = expr.match(/\([\S\s]+\)|[^)(\s]+/g);
		return invocation_recursive_parse(parts[0], parts.slice(1));
	};
	var parse = function(expr) {
		/*
			expr := <lambda><var> -> <expr>
					| <var> = <expr>
					| <expr> <expr>
					| (<expr> <expr>)
					| <var>							
		*/
		var rules = [
			[/^[^=]+=[^=]+$/, equation_parse],
			[/^[^-]+->[\S\s]+$/, lambda_parse],
			[/^[\S]+ [\S\s]+$/, invocation_parse],
			[/^/, identity]
		];
		
		// parse expression with matching rule
		var parsed;
		rules.forEach(function(rule) {
			if( rule[0].test(expr) && !parsed ) {
				parsed = rule[1](expr);
			}
		});
		
		return parsed;
	};
	var Env = function(name, values, env) {
		// clone then augment environment making scope without side-effects
		var _env = {};
		for( var key in env ) {
			_env[key] = env[key];
		}
		_env[name] = eval(values[0], _env);
		return _env;
	};
	var eval = function(x, env) {
		// sloppy handling of external data-types - for rendering
		if( typeof x == 'function' ) {
			return x;
		} else if( typeof x == 'number' ) {
			return x;
		}
		
		if( typeof x == 'string' ) {
			// variable references
			return env[x];
		} else if( x[0] == '=' ) {
			// variable assignment
			env[x[1]] = eval(x[2], env);
		} else if( x[0] == 'lambda' ) {
			// lambda definition
			return function() { return eval(x[2], Env(x[1], arguments, env)) };
		} else {
			// function invocation
			var exps = x.map(function(expr) { return eval(expr, env); });
			return exps.shift().apply({}, exps);
		}
		return env;
	};
	
	// evaluate subsequent expressions with modified env
	var interpret_dependency_chain = function(exprs) {
		var parsed = parse(exprs.shift());
		return exprs.length == 0 ? eval(parsed, {}) : eval(parsed, interpret_dependency_chain(exprs));
	};
	
	// evaluate a multi-line program
	var interpret = function(program) {
		// reverse so that the first written is the most deeply nested
		var exprs = program.split('\n').reverse();
		return interpret_dependency_chain(exprs);
	};
	
	return {
		parse: parse,
		eval: eval,
		interpret: interpret,
		load: function(file, cb) {
			// read in and then interpret program
			fs.readFile(__dirname + file, function(err, data) {
				// TODO: types so that we know how to render, e.g., Number or Bool.
				cb(interpret(""+data));
			});	
		}
	};	
};
module.exports = Lambda;