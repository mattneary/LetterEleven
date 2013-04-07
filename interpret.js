var Lambda = require('./Lambda');
(new Lambda()).load('/example.lambda', function(env) {
	console.log(env.TWO(function(x){return x+1})(0));
});