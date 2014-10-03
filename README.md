# SecureMQ

Message-oriented secure service inspired by axon and zeromq.  

SecureMQ uses HTTPS for transport rather than plain TCP, this allows SecureMQ to have:

  - encryption (TLS/SSL).
  - authentication (Basic).
  - firewall friendliness (single port).  
  
SecureMQ is completely written in javascript for nodeJS and does not need a binding like zeromq.

## Installation

From your terminal, requires [nodeJS](http://nodejs.org/).

```
npm install securemq
```

If using the __secure__ option you will need to have TLS (SSL) key and certificate files. These can be built using OpenSSL for example:

Key, _key.pem_ file:

```
openssl genrsa -out key.pem 1024
```
Certificate, _cert.pem_ file:

```
openssl req -new -key key.pem -out cert.pem
```
To create a self-signed certificate:

```
openssl x509 -req -in cert.pem -signkey key.pem -out cert.pem
```

## Events

  - `closed` when peer closes.
  - `error` (err) when an un-handled socket error occurs.
  - `reconnect attempt` when a reconnection attempt is made.
  - `connected` (connection as object) when connected to the peer, or a peer connection is accepted.
  - `queued` (msg) when a message is enqueued, can use to save unsent messages.
  - `flushed` (total messages) queued when messages are flushed on connection.
  - `message` (msg) the message received by peer.

## Patterns

  - push / pull
  - pub / sub
  - chit / chat
  
## Examples

See `examples` folder. To print debugging info use the _--preview_ argument when running the app, for example:

```
node examples/pushpull/push.js --preview
```

## Push / Pull Example

`push`s distribute messages round-robin:

```js
var securemq = require('securemq');

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: true,
  key: __dirname + '/key.pem',
  cert: __dirname + '/cert.pem',
  apikey: 'za91j2bk72f483ap62x' 
};
var service = securemq.bind(options);

var myService = new service('myService', 'push');
console.log('myService:push server started');

setInterval(function(){
  myService.send('hello');
}, 100);
```
Receiver of `push` messages:

```js
var securemq = require('securemq');

var options = { 
  hostname: '127.0.0.1', 
  port: 3443, 
  secure: true, 
  rejectUnauthorized: false,
  apikey: 'za91j2bk72f483ap62x' 
};
var service = securemq.connect(options);

var myService = new service('myService', 'pull');

myService.on('message', function(msg){
  console.log(msg.toString());
});
```

## Chit / Chat Example

`chit`s is bi-directional, broadcast to all `chat` peers and can receive messages back:

```js
var securemq = require('securemq');

var options = {
  hostname: '127.0.0.1',
  port: 3443,
  secure: true,
  key: __dirname + '/key.pem',
  cert: __dirname + '/cert.pem',
  apikey: 'za91j2bk72f483ap62x' 
};
var service = securemq.bind(options);

var myService = new service('myService', 'chit');
console.log('myService:chit server started');

myService.on('message', function(msg){
  console.log(msg.toString());
});

setInterval(function(){
  myService.send('hello chat');
}, 100);
```

`chat`s is bi-directional, can receive and send messages to `chit`:

```js
var securemq = require('securemq');

var options = { 
  hostname: '127.0.0.1', 
  port: 3443, 
  secure: true, 
  rejectUnauthorized: false,
  apikey: 'za91j2bk72f483ap62x' 
};
var service = securemq.connect(options);

var myService = new service('myService', 'chat');

myService.on('message', function(msg){
  console.log(msg.toString());
});

setInterval(function(){
  myService.send('hello chit');
}, 1000);
```

## Options

```
__hwm__: _Infinity_,                // number of messages before High Water Mark is breached.
__server_name__: _'securemq'_,      // HTTP 'server' name.
__throw_error__: _true_,            // if catch socket connection error, throw error.
__retry__: _Infinity_,              // number of times to try reconnecting.
__secure__: _false_,                // if true: will use HTTPS key, cert and apikey as Basic Auth, if false: uses HTTP.
__key__: _'/key.pem'_,              // if secure true: path to TLS/SSL key file.
__cert__: _'/cert.pem'_,            // if secure true: path to TLS/SSL certificate file.
__apikey__: _undefined_,            // if secure true: will use this as Basic Auth.
__rejectUnauthorized__: _false_,    // if secure true and if using a self-signed certificate.
__hostname__: _'127.0.0.1'_,
__port__: _3443_,
__protocol__: _'amp'_,              // messages can be sent in either: 'amp' (Abstract Message Protocol) or 'ldjson' (Line Delimited JSON).
__reconnecttime__: _3000_           // milliseconds after reconnection attempt.
```

## Message Protocol

SecureMQ has two message protocols for you to choose from; [AMP](https://github.com/visionmedia/node-amp) protocol, with [node-amp-message](https://github.com/visionmedia/node-amp-message), the second protocol available is [Line Delimited JSON](http://en.wikipedia.org/wiki/Line_Delimited_JSON).  

SecureMQ uses AMP by default as it is fastest and most flexible. AMP allows you to apply any message codec, such as: json, msgpack, or to use node.js objects like buffer (binary). Line Delimited JSON is useful for connecting `peer`s written in different languages.  

Set message protocol options `amp`, `ldjson`:
```js
{
  protocol: 'amp'   // (default), or: 'ldjson' for Line Delimited JSON.
}
```

## Performance

You can benchmark securemq. With `secure` set to true will be slower as messages are encrypted.  

Benchmark without `batching`:
```
make bench
```
Benchmark with `batching`:
```
make benchbatch
```
### Results

Sending a `200` byte sized `batched` `unsecure` message, on my laptop (dual-core i7), I get around __183,546__ messages per second:

```
  [2208 ops/s] [10001]

      min: 2,208 ops/s
     mean: 2,211 ops/s
   median: 2,230 ops/s
    total: 11,057 ops in 5s
  through: 0.42 mb/s

------------------------------
   events: 917,731
       id: 23,388
     mean: 183,546 ops/s.
------------------------------
```

## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

