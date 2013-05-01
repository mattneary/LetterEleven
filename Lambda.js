// node and client-side compatibility
try {
	require; module;
} catch(err) {
	require = function(){};
	module = { exports: [] };
}

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
		var chars = expr.split(''), parts = [], read, parens = 0, build = '';
		if( chars[0] == '`' ) {	
			// delay parsing of quoted expression
			return ['`', expr.split(' ').slice(1).join(' ')];
		}
		
		// parse nested parentheticals
		while( (read = chars.shift()) ) {
			if( read == '(' ) parens++;
			else if( read == ')' ) parens--;
			
			if( read.match(/\s/) && parens == 0 ) {
				parts.push(build);
				build = '';
			} else {
				build += read;
			}
		};
		if( build ) parts.push(build);
		if( parts[0].match(/^\([\s\S]+\)$/) ) {
			parts[0] = parse(parts[0].substr(1, parts[0].length - 2));
		}
		
		if( parts.length == 1 ) {
			return invocation_parse(expr.substr(1, expr.length - 2));
		}
		return invocation_recursive_parse(parts[0], parts.slice(1));
	};
	var parse = function(expr) {
		/*
			expr := <lambda><var> -> <expr>
					| <var> = <expr>
					| <expr> <expr>
					| (<expr>)
					| <var>							
		*/		
		var rules = [
			[/^[^=]+=[^=]+$/, equation_parse],
			[/^[^-)(]+->[\S\s]+$/, lambda_parse],
			[/^([\S]+|\([^)]+\)) [\S\s]+$/, invocation_parse],
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
		_env[name] = eval(values[0], _env).value;
		return _env;
	};
	var eval = function(x, env) {
		x = x.value == undefined ? x : x.value;
	
		// expose external data-types for use with the output functions
		if( typeof x == 'function' ) {
			return { env: env, value: x };
		} else if( typeof x == 'number' ) {
			return { env: env, value: x };
		} else if( typeof x == 'boolean' ) {
			return { env: env, value: x };
		}
		
		var value;
		if( typeof x == 'string' ) {
			// variable references
			value =  env[x];
		} else if( x[0] == '=' ) {
			// variable assignment
			env[x[1]] = eval(x[2], env).value;
			value = env[x[1]];
		} else if( x[0] == 'lambda' ) {
			// lambda definition
			value = function() { return eval(x[2], Env(x[1], arguments, env)) };
		} else {	
			if( x[0] == '`' ) {
				// treat quoted expressions as lambdas of dropped values
				return { env: env, value: eval(['lambda', '_', parse(x[1])], env) };
			}

			// function invocation			
			var _env = {};
			var exps = x.map(function(expr) {
				var evaled = eval(expr, env);
				return evaled.value == undefined ? evaled : (_env = evaled.env, evaled.value); 
			});
			var applied = exps.shift().apply(_env, exps);
			return { env: env, value: applied && applied.value != undefined ? applied.value : applied };
		}
		return { env: env, value: value };
	};
	
	var log = [];
	var library = {
		// provide output functions of Booleans, Numbers, and Lists of either type.
		BOOL: function(bool, nested) {
			var parse = bool(true).value(false).value;
			if(!nested) log.push('line '+this.line+": "+parse);
			return parse;
		},
		NUM: function(num, nested) {
			if(!nested) log.push('line '+this.line+": "+num(function(x){return x+1;}).value(0).value);
			return num(function(x){return x+1;}).value(0).value;
		},
		CHAR: function(num, nested) {
			var code = num(function(x){return x+1;}).value(0).value;			
			if(!nested) log.push('line '+this.line+": "+String.fromCharCode(code));
			return String.fromCharCode(code);
		},
		LIST: function(type_parser) {		
			var _list = function(list, nested) {
				var parse = this.BOOL(this.NULL(list).value, true) ? [] : [type_parser(this.FST(list).value, true), _list(this.SND(list), true)];
				if(!nested) log.push('line '+this.line+": "+JSON.stringify(parse));
				return parse;
			}.bind(this);
			return _list;
		},		
		line: -8
	};	
	
	var incr_line = function(resp) {
		resp.env.line = (resp.env.line || 0) + 1;
		return resp;
	};
	
	// evaluate subsequent expressions with modified env
	var interpret_dependency_chain = function(exprs) {
		var parsed = parse(exprs.shift());
		return exprs.length == 0 ? eval(parsed, library) : eval(parsed, incr_line(interpret_dependency_chain(exprs)).env);
	};
	
	// evaluate a multi-line program
	var interpret = function(program) {
		// provide functions for convenience
		var prelude = [
			"PAIR = λx->λy->λf->f x y",
			"TRUE = λx->λy->x",
			"FALSE = λx->λy->y",
			"FST = λp->p TRUE",
			"SND = λp->p FALSE",
			"NIL = λx->TRUE",
			"KILL = λx->λy->FALSE",
			"NULL = λp->p KILL",
			", = λf->f NIL"
		];
		// reverse so that the first written is the most deeply nested
		var exprs = prelude.concat(program.split('\n')).reverse();
		return interpret_dependency_chain(exprs);
	};
	
	return {
		parse: parse,
		eval: eval,
		interpret: interpret,
		load: function(file, cb) {
			var thiz = this;
			// read in and then interpret program
			fs.readFile(__dirname + file, function(err, data) {
				cb.call(thiz, interpret(""+data));
			});
		},
		log: log
	};
};
module.exports = Lambda;