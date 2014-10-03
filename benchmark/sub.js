
var securemq = require('..')
  , program = require('commander')
  , humanize = require('humanize-number');

program
  .option('-s, --size <n>', 'message size in bytes [200]', parseInt)
  .option('-d, --duration <n>', 'duration of test [5000]', parseInt)
  .parse(process.argv)

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: false,
  apikey: 'za91j2bk72f483ap62x',  
  rejectUnauthorized: false,    // false: if using self signed certificate.
  protocol: 'amp'
};
var service = securemq.connect(options);

var myService = new service('myService', 'sub');

var n = 0;
var ops = program.duration || 5000;
var bytes = program.size || 200;
var prev = start = Date.now();
var results = [];

console.log();

myService.on('message', function(msg){
  if (n++ % ops == 0) {
    var ms = Date.now() - prev;
    var sec = ms / 1000;
    var persec = ops / sec | 0;
    results.push(persec);
    process.stdout.write('\r  [' + persec + ' ops/s] [' + n + ']');
    prev = Date.now();
  }
});

function sum(arr) {
  return arr.reduce(function(sum, n){
    return sum + n;
  });
}

function min(arr) {
  return arr.reduce(function(min, n){
    return n < min
      ? n
      : min;
  });
}

function median(arr) {
  arr = arr.sort();
  return arr[arr.length / 2 | 0];
}

function done(){
  var ms = Date.now() - start;
  var avg = n / (ms / 1000);
  console.log('\n');
  console.log('      min: %s ops/s', humanize(min(results)));
  console.log('------------------------------');
  console.log(' *** mean: %s ops/s', humanize(avg | 0));
  console.log('------------------------------');  
  console.log('   median: %s ops/s', humanize(median(results)));
  console.log('    total: %s ops in %ds', humanize(n), ms / 1000);
  console.log('  through: %d mb/s', ((avg * bytes) / 1024 / 1024).toFixed(2));
  console.log();
  process.exit();
}

process.on('SIGINT', done);
setTimeout(done, program.duration || 5000);
