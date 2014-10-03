var securemq = require('..') 
  , program = require('commander');

program
  .option('-s, --size <n>', 'message size in bytes [200]', parseInt)
  .option('-d, --duration <n>', 'duration of test [5000]', parseInt)
  .parse(process.argv)

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: false,
  key: __dirname + '/keys/test-key.pem',
  cert: __dirname + '/keys/test-cert.pem',
  apikey: 'za91j2bk72f483ap62x',
  protocol: 'amp' 
};
var service = securemq.bind(options);

var myService = new service('myService', 'pub');
console.log('pub bound');

myService.on('closed', function(msg){
  // connect peer has closed, so can exit this program.
  process.exit();
});


var BATCHING = true;
var SIZE = program.size;

var dataX = ']C\9DJ*\92\CC\E0" 54\D2]C\9DJ*\92\CC\E0"\D9C?\86\9A\81CΎ\D9qc\813\CE\91\DBZ\C1\B7\E3\EC\C9O\AFX*\Md d\A14\98ΐ\AC\00S;\96Jdw\9FcUʅ*x\F6\FA^\AC\C6.T,. ☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><☃ {"": } abcDEFG \u00bd HIJKl 36 mnopQRST uvwxYZ 0123456789 {"": } \u00be 9876543210 ~!@#$%^&*()_+{}:">?><';
var dataZ = dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX + dataX;

var dataA = new Buffer(dataZ);
var data = dataA.slice(0, SIZE);

var msg = {};
msg.id = 0;
msg.events = [];

console.log('sending %d byte messages', data.length);


// batching, nable-ish
var bsize = 0;
var BATCH_SIZE = 16450; // bytes.

function batch(data) {

	//TODO rewirte this!!!
  msg.events.push(data.toString('base64'));   // convert buffer into base64.

  bsize += data.length;

  if ( bsize >= BATCH_SIZE ) {
    bsize = 0;  // reset.
    myService.send([msg]);
    msg.events = [];    // reset.
    msg.id++;
  }

}


function more() {

  if ( BATCHING === true ) {
    batch(data);
  } else {
    // without batching
    msg.events.push(data.toString('base64'));
    
    myService.send([msg]);
    msg.events = [];    // reset.
    msg.id++;   
  }

  setImmediate(more);

}

more();

