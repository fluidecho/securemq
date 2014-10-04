var preview = require('preview')('service');
var securemq = require('./../../');

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: false,
  key: __dirname + '/key.pem',
  cert: __dirname + '/cert.pem',
  apikeys: ['za91j2bk72f483ap62x']
};
var service = securemq.bind(options);

// chit broadcasts to all chat peers, and chat can send messages back to chit.
var myService = new service('myService', 'chit');
preview('myService:chit server started');

myService.on('message', function(msg){
  preview('myService', 'message', msg);
});

var x = 0;
setInterval(function(){
  myService.send({foo: 'bar', x: x++});
}, 1000);
