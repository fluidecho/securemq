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

If using the __secure__ option you will need to have TLS (SSL) key and certificate files. These can be built using OpenSSL, for example:

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
  apikeys: ['za91j2bk72f483ap62x'] 
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
  apikeys: ['za91j2bk72f483ap62x'] 
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

  - `hwm` _(number)_ of messages before High Water Mark is breached.
  - `server_name` _(string)_ HTTP 'server' name.
  - `throw_error` _(boolean)_ if catch socket connection error, throw error.
  - `retry` _(number)_ of times to try reconnecting.
  - `secure` _(boolean)_ if true: will use HTTPS key, cert and apikey as Basic Auth, if false: uses HTTP.
  - `key` _(filename)_ if secure true: path to TLS/SSL key file.
  - `cert` _(filename)_ if secure true: path to TLS/SSL certificate file.
  - `apikeys` _(array)_ if secure true and bind peer, will use this as Basic Auth.
  - `apikey` _(string)_ if secure true and connecting peer, will use this as Basic Auth.  
  - `rejectUnauthorized` _(boolean)_ if secure true and if using a self-signed certificate.
  - `hostname` _(IP/domain)_ address to bind or connect.
  - `port` _(number)_ port to bind or connect.
  - `protocol` _(amp|ldjson)_ messages can be sent in either: 'amp' (Abstract Message Protocol) or 'ldjson' (Line Delimited JSON).
  - `reconnecttime` _(milliseconds)_ after reconnection attempt.


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

Sending a `200` byte sized `batched` `unsecure` message, on my laptop (dual-core i7), I get around __211,513__ messages per second:

```
  [2569 ops/s] [10001]

      min: 2,569 ops/s
     mean: 2,548 ops/s
   median: 2,594 ops/s
    total: 12,571 ops in 4.933s
  through: 0.49 mb/s

------------------------------
   events: 1,043,393
       id: 24,723
 *** mean: 211,513 ops/s.
------------------------------
```

## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

