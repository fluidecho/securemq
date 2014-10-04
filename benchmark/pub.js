
var securemq = require('..')
  , program = require('commander');

program
  .option('-t, --per-tick <n>', 'messages per tick [10]', parseInt)
  .option('-s, --size <n>', 'message size in bytes [200]', parseInt)
  .option('-d, --duration <n>', 'duration of test [5000]', parseInt)
  .parse(process.argv)

var perTick = program.perTick || 1000;

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: false,
  key: __dirname + '/keys/key.pem',
  cert: __dirname + '/keys/cert.pem',
  apikeys: ['za91j2bk72f483ap62x'],
  protocol: 'amp' 
};
var service = securemq.bind(options);

var myService = new service('myService', 'pub');
console.log('pub bound');

myService.on('closed', function(msg){
  // connect peer has closed, so can exit this program.
  process.exit();
});

var buf = new Buffer(Array(program.size || 200).join('a'));
console.log('sending %d per tick', perTick);
console.log('sending %d byte messages', buf.length);

function more() {
  for (var i = 0; i < perTick; ++i) myService.send([buf]);
  setImmediate(more);
}

more();


