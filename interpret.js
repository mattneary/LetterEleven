var Lambda = require('./Lambda');
(new Lambda()).load('/example.lambda', function(resp) {
	console.log(this.log);
});