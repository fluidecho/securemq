var preview = require('preview')('service');
var securemq = require('./../../');

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: false,
  key: __dirname + '/test-key.pem',
  cert: __dirname + '/test-cert.pem',
  apikey: 'za91j2bk72f483ap62x' 
};
var service = securemq.bind(options);

var myService = new service('myService', 'pub');
preview('myService:pub server started');

var x = 0;
setInterval(function(){
  myService.send({foo: 'bar', x: x++});
}, 1000);
