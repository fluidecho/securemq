var preview = require('preview')('client');
var securemq = require('./../../');

var options = { 
  hostname: '127.0.0.1', 
  port: 3443, 
  secure: false, 
  rejectUnauthorized: false,
  apikey: 'za91j2bk72f483ap62x'
};
var service = securemq.connect(options);

var myService = new service('myService', 'sub');

myService.on('message', function(msg){
  preview('myService', 'message', msg);
});
