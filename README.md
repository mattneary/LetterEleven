Implementation
==============
Each line is separated out and then interpreted, with the environment value being passed along to the next line (cf. Monads). Interpretation consists of two steps: parsing and evaluation.

Parsing
-------
The Lambda Calculus syntax is very simple. All expressions are of the following type.

	expr := <lambda><var> -> <expr>
			| <var> = <expr>
			| <expr> <expr>
			| (<expr> <expr>)
			| <var>	

So the parsing process simply finds the pattern which a given expression matches and then decomposes the expression into variables, lambdas, or more expressions which in turn will be parsed.

Evaluation
----------
Evaluation interprets each expression and generates its JavaScript form. An environment variable is maintained to handle scoping and variables in general. Evaluation follows very naturally from the parsed form and is a simple string of cases (lambda, variable, etc.).

Roadmap
=======
- A typing system is needed for automatic rendering of Church Forms (e.g., numbers and booleans).
- The goal is to generalize this implementation to make general interpretation a lot less intimidating. Scheme, for example, would be very easily built on this foundation.