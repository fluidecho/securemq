"use strict";
//
// securemq: Secure Message Queue.
//
// Version: 0.0.7
// Author: Mark W. B. Ashcroft (mark [at] kurunt [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2014 Mark W. B. Ashcroft.
// Copyright (c) 2014 Kurunt.
//


var util = require('util');
var events = require('events');
var amp = require('amp');
var Message = require('amp-message');
var Parser = amp.Stream;
var ldjsonParser = require('./ldjson');
var preview = require('preview')('securemq');
var fs = require('fs');        // for reading https key and cert.
var url = require('url');
var querystring = require('querystring');
var extend = util._extend;
// http or https require-d inside functions.


// public api:
exports.bind = bind;
exports.connect = connect;
exports.checkService = checkService;
exports.refreshApikeys = refreshApikeys;


var sockets = [];     // connections made to bind.
var services = [];    // as set be send().
var tryed = 0;        // how many connection attemps made.
var CRLF = '\r\n';    // use to delineate messages when using ldjson protocol.


var patterns = [
  'pull',
  'push',
  'pub',
  'sub',
  'chit',
  'chat'
];


// temp settings: pass settings via 'options' in peer 'bind' and 'connect' functions, DO NOT SET/CHANGE HERE!
var settings = { 
  hwm: Infinity,              // number of messages.
  server_name: 'securemq',    // http 'server' name.
  throw_error: true,          // if catch socket connection error, throw.
  retry: Infinity,            // number of times to try reconnecting.
  secure: false,              // if true will use https key, cert and apikey as Basic Auth.
  apikey: undefined,          // if secure true connecting peer uses this as their apikey in Basic Auth.
  apikeys: [],                // if secure true will check connecting peers apikey (above) with this list, can be refershed via: refreshApikeys().
  hostname: '127.0.0.1',
  port: 3443,
  protocol: 'amp',            // messages can be sent in either: 'amp' (Abrstract Message Protocol) or 'ldjson' (Line Deineated JSON).
  reconnecttime: 3000
};
var httpModule = undefined;   // will be either http of https.


// error to check and retry if:
var ignore = {
  ECONNREFUSED: true,
  ECONNRESET: true,
  ETIMEDOUT: true,
  EHOSTUNREACH: true,
  ENETUNREACH: true,
  ENETDOWN: true,
  EPIPE: true,
  ENOENT: true
};
// TODO: if EADDRINUSE



function refreshApikeys(apikeys) {
  preview('refreshApikeys', apikeys);
  settings.apikeys = apikeys;
}



function bind(options) {
  preview('bind called');
  var settings = setSettings(options);
  return newServiceBind;
}



function connect(options) {
  preview('connect called');
  var settings = setSettings(options);
  return newServiceConnect;
}



function setSettings(options) {
 
  //preview('setSettings options', options);
 
  // set options to settings.
  
  if ( options.server ) {
    settings.server_name = options.server;
  }
  
  if ( options.hwm ) {
    settings.hwm = options.hwm;
  }

  if ( options.secure ) {
    httpModule = require('https');
    settings.secure = true;
    if ( options.apikeys != undefined ) {
      settings.apikeys = options.apikeys;
    }
    if ( options.apikey != undefined ) {
      settings.apikey = options.apikey;
    }    
    settings.key = options.key;
    settings.cert = options.cert;  
  } else {
    httpModule = require('http');
    settings.secure = false;
  }

  if ( options.throw_error != undefined ) {
    settings.throw_error = options.throw_error;
  }

  if ( options.retry ) {
    settings.retry = options.retry;
  }  
  
  if ( options.protocol ) {
    settings.protocol = options.protocol;
  }  
    
  settings.hostname = options.hostname;
  settings.port = options.port;
  
  if ( options.rejectUnauthorized != undefined ) {
    settings.rejectUnauthorized = options.rejectUnauthorized;
  }
  
  if ( options.reconnecttime ) {
    settings.reconnecttime = options.reconnecttime;
  }  
  
  //return settings;
  
}



var bound = false;
function newServiceBind(service, pattern, _options) {


  preview('newServiceBind, service: ' +  service + ', pattern: ' + pattern + ', _options', _options);
  
  if ( bound ) {
    // now can allow many bind peers.
    //preview('newServiceBind, already bound! return'); 
    //return;
  } 
  
  var self = this;
  
  self.service = service;
  self.pattern = pattern; 
  
  var _settings = extend(settings);
  //preview('settings', _settings);
  
  var xsettings = {};
  xsettings.protocol = extend(_settings.protocol);
  xsettings.port = extend(_settings.port);
  xsettings.hwm = extend(_settings.hwm);
  
  var i = checkService(service);
  if ( i === false ) {
    var i = addService({ name: service, pattern: pattern, queue: [], n: 0, xsettings: xsettings, self: self });     // add new service
  }
  self.i = i;

  
  // can generate own keys using OpenSSL, see: http://nodejs.org/api/tls.html
  bound = true;   // just once.
  if ( _settings.secure ) {
    var server = httpModule.createServer({ key: fs.readFileSync(_settings.key), cert: fs.readFileSync(_settings.cert) }, onconnect);
  } else {
    var server = httpModule.createServer(onconnect);
    server.setTimeout(0);   // disabled http modules automatically disconecting peers after 2 mins (only for http not https).
  }
  
  server.on('error', function(err){
    preview('server', 'on error called', err);
    services[i].self.emit('error', err);
  });    
  
  server.on('connection', function(req, res){
    //req.setNoDelay(true);   // turn nagle batching alguruthum off.
    preview('server', 'on connection called');
  });  
  
  //preview('binding: ' + _settings.hostname + ':' + _settings.port);
  server.listen(_settings.port, _settings.hostname, function() {
    preview('bound');
    //services[i].self.emit('bound', true);   // TODO: securemq.bind returns eventEmitter so 'bound' event can be sent.
  });
  
  function onconnect(req, res) {
    preview('onconnect');

    // if client request favicon return.
    if (req.url === '/favicon.ico') {
      res.writeHead(200, {'Content-Type': 'image/x-icon'});
      res.end();
      return;
    }
    
    var apikey = undefined;
    // if secure connection, make sure connection peer is using valid apikey for Basic Auth.
    if ( _settings.secure ) {
      var header = req.headers['authorization']||'',        // get the header
        token = header.split(/\s+/).pop()||'',              // and the encoded auth token
        auth = new Buffer(token, 'base64').toString(),      // convert from base64
        parts = auth.split(/:/),                            // split on colon
        username = parts[0];  
        apikey = parts[1];
        var authValid = false;
        
        // TODO: IDEA: Maybe securemq should have a EE when connecting peer attemps authentication. How to return back to securemq pass/failure?
        //var authenticate = function(a) {
        //  //preview('authenticate: ' + a);
        //};
        //self.emit('authentication', {username: username, apikey: apikey}, authenticate);
        
        var apikeys = _settings.apikeys;
        if ( _options != undefined ) {
          if ( _options.apikeys != undefined ) {
            apikeys = _options.apikeys;
          }
        }
        
        for ( var ak in apikeys ) {
          if ( apikeys[ak] === apikey ) {
            authValid = true;
            break;
          }
        }

        if ( apikey === undefined || apikey === 'undefined' || apikey === '' ) {
          authValid = false;
        }
        preview('authValid: ' + authValid + ' apikeys: ' + apikeys + ' apikey: ' + apikey);
        if ( !authValid ) {
          preview('onRequest', 'request connect peer, not using valid apikey!');
          res.writeHead(401, {'Server': _settings.server_name, 'Content-Type': 'application/json; charset=utf-8', 'Connection': 'closed'});
          res.end(JSON.stringify({code: 401, status: 'unauthorized request, invalid apikey'}));
          return;           
        }        
    }  
    
    
    var client_host = ipAddress(req);
    //preview('onconnect, client_host: ' + client_host);
    
    var reqObj = url.parse(req.url);
    ////preview('onconnect', 'reqObj', reqObj);  
    var service, pattern;
    var ps = reqObj.pathname.split('/');
    for ( var p in  ps ) {
      if ( ps[p].trim() != '' || ps[p] === undefined ) {
        //preview('onconnect, p: ' + Number(p));
        if ( Number(p) === 1 ) {
          service = querystring.unescape(ps[p]);
        }
        if ( Number(p) === 2 ) {
          pattern = ps[p];
        }     
      }
    }  
    //preview('onconnect', 'service: ' + service);
    //preview('onconnect', 'pattern: ' + pattern);
    
    if ( service === undefined || pattern === undefined ) {
      res.writeHead(403, {'Server': _settings.server_name, 'Content-Type': 'application/json; charset=utf-8', 'Connection': 'closed'});
      res.write( JSON.stringify({"status": "invalid method request"}) + '\n' );
      res.end();
      return; 
    }
    
    var validPattern = false;
    for ( var pt in patterns ) {
      if ( pattern === patterns[pt] ) {
        validPattern = true;
      }
    }
    if ( validPattern === false ) {
      res.writeHead(403, {'Server': _settings.server_name, 'Content-Type': 'application/json; charset=utf-8', 'Connection': 'closed'});
      res.write( JSON.stringify({"status": "invalid pattern"}) + '\n' );
      res.end();
      return;     
    }

    // will allow 'connect' to use any 'service' as 'bind' may not yet have created it.
    res.writeHead(200, {'Server': _settings.server_name, 'Content-Type': 'application/json; charset=utf-8'});    // must be sent before flushing queues.


    var socket = { service: service, pattern: pattern, host: client_host, res: res, req: req };
    var i = addSocket(socket);

    var s = checkService(service);
    if ( s === false ) {
      //var i = addService({ name: service, pattern: pattern, queue: [], n: 0, xsettings: xsettings, self: self });     // add new service
      preview('checkService, false, service', service);
      return false;
    }


    req.on('close', function(){
      //preview('req on close for socket i: ' + i);
      removeSocket(socket);
      services[s].self.emit('closed', true);    // emit 'closed'
    });

    var reqObj = url.parse(req.url);
    ////preview('onRequest', 'reqObj', reqObj);
    
    var query = querystring.parse(reqObj.query);
    //preview('onRequest', 'query', query);

    var protocol = _settings.protocol;
    if ( query._protocol != undefined ) {
      protocol = query._protocol;
      delete query._protocol;
    }
  
    //preview('onRequest', 'query', query);
    
    preview('connected event', {query: query, client_host: client_host, service: service, pattern: pattern, apikey: apikey});
    services[s].self.emit('connected', {query: query, client_host: client_host, service: service, pattern: pattern, apikey: apikey});    // emit connected and pass any url query objects.
  
    // recieving messages from connection peer.
      // on chunk concate buffer.
      //req.on('data', function (chunk) {
       // //preview('onconnect', 'chunk: ' +  chunk.toString());
      //});     
  
  
    if ( protocol === 'ldjson' ) {

      // ldjson.
      var ldjsonparser = new ldjsonParser();
      ldjsonparser.on('error', function(e){
          preview('ldjsonparser', 'error', e);
      });   
      ldjsonparser.on('message', function(message){
          ////preview('ldjson', 'message', message);
          if ( message != '_0_' ) {   // _0_ is the start code sent by connect peer.
            services[s].self.emit('message', message);
          }
      });
      req.pipe(ldjsonparser);

    } else {    
  
      var parser = new Parser;
      parser.on('data', function(chunk){
        var message = new Message(chunk);
        ////preview('connect', 'message.args', message.args);
        if ( message.args != '_0_' ) {    // _0_ is the start code sent by connect peer.
          //services[s].self.emit('message', message.args[0]);
          services[s].self.emit('message', message.args);
        }
      });
      req.pipe(parser);
    
    }


    // flush queues.
    try {   // may not yet be created.
      preview('onconnect', 'checkService: ' + service + ' s: ' + s + ' q.l: ' + services[s].queue.length);
      if ( services[s].queue.length > 0 ) {
        var prev = services[s].queue;
        var len = prev.length;
        services[s].queue = [];
        preview('flush queued: ' + len + ' messages for service: ' + services[s].name);
        for (var z = 0; z < len; ++z) {
          _send('connect', services[s].name, services[s].pattern, s, prev[z]);
        }
        services[s].self.emit('flushed', prev.length);    // emit 'flushed', number of messages.
      }
    } catch(e) {
    }

    // NOTE: must do either .write() OR .end() to get bi-directional com working. Using a start/initeate code: _0_
    if ( _settings.protocol === 'ldjson' ) {
      var message = '_0_' + CRLF;
    } else {
      var message = new Message();
      message.push('_0_');    // _0_ is a code picked up by the bind peer to start coms.
      message = message.toBuffer();
    }
  
    res.write( message );   // must!


  }  
  
  
}
util.inherits(newServiceBind, events.EventEmitter);  



function newServiceConnect(service, pattern, query, self) {

  preview('newServiceConnect', 'service: ' + service + ' pattern: ' + pattern);
  
  var _settings = extend(settings);
  
  var xsettings = {};
  xsettings.protocol = extend(_settings.protocol);
  xsettings.port = extend(_settings.port);
  xsettings.hwm = extend(_settings.hwm);  
  
  tryed++;    // connection attemps.
  
  if ( self === undefined ) {
    var self = this;
  }


  self.service = service;
  self.pattern = pattern;
  var i = checkService(service);
  if ( i === false ) {
    var i = addService({ name: service, pattern: pattern, queue: [], n: 0, xsettings: xsettings, self: self });     // add new service
  }
  self.i = i;
  
  // make http request.

  var options = {};   // set options for http request.
  
  var _query = '';
  if ( query != undefined ) {
    _query = '&' + querystring.stringify(query);
  }
  
  options.path = '/' + querystring.escape(service) + '/' + pattern + '/?_protocol=' + _settings.protocol + _query;
  options.method = 'PUT';
  options.hostname = _settings.hostname;
  options.port = _settings.port;  
  
  if ( _settings.rejectUnauthorized != undefined ) {
    options.rejectUnauthorized = _settings.rejectUnauthorized;
  }
  
  if ( _settings.secure ) {
    options.auth = 'connect:' + _settings.apikey;    // set Basic Auth from apikey.
  }
  
  
  preview('newServiceConnect', 'connect attempt address: ' + options.hostname + ':' + options.port + options.path);

  // sock is req
  var socket = undefined;
  var sock = httpModule.request(options, function(res) {
    
    //preview('connect', 'request, STATUS', res.statusCode);
    ////preview('connect', 'request, HEADERS', res.headers);
    
    var sr = checkService(service);
    //preview('connect', 'checkService: ' + sr);  
    
    if ( res.statusCode === 401 ) {
      var error = new Error('401, unauthorized request, invalid apikey');
      error.code = 401;
      if ( _settings.throw_error ) {
        services[i].self.emit('error', error);
        throw error;
      }
      services[i].self.emit('error', error);
    }

    if ( res.statusCode === 403 ) {
      var error = new Error('403, invalid pattern or request method');
      error.code = 403;
      if ( _settings.throw_error ) {
        services[i].self.emit('error', error);
        throw error;
      }
      services[i].self.emit('error', error); 
    }
  
    //if ( res.statusCode != 200  && tryed < settings.retry ) {
    //  //preview('connect', 'status code not 200, try reconnect');
    //  reconnect(service, pattern, query, self, services[i]);  // try reconnecting...
    //}

    if ( res.statusCode === 200 ) {
      tryed = 0;    // reset.
      services[i].self.emit('connected', query);    // emit connected and pass any url query objects.

      socket = { service: service, pattern: pattern, host: options.hostname, res: sock, req: res };
      var s = addSocket(socket);  

      // flush queues.
      try {   // may not yet be created.
        preview('connect', 'checkService: ' + service + ' sr: ' + sr + ' q.l: ' + services[sr].queue.length);
        if ( services[sr].queue.length > 0 ) {
          var prev = services[sr].queue;
          var len = prev.length;
          services[sr].queue = [];
          preview('flush queued: ' + len + ' messages for service: ' + services[sr].name);
          for (var z = 0; z < len; ++z) {
            _send('connect', services[sr].name, services[sr].pattern, s, prev[z]);
          }
          services[sr].self.emit('flushed', prev.length);   // emit 'flushed', number of messages.
        }
      } catch(e) {
      }     
    
    }


    if ( _settings.protocol === 'ldjson' ) {
      
      // ldjson.
      var ldjsonparser = new ldjsonParser();
      ldjsonparser.on('error', function(e){
          preview('ldjsonparser', 'error', e);
      });       
      ldjsonparser.on('message', function(message){
          ////preview('ldjson', 'message', message);
          if ( message != '_0_' ) {   // _0_ is the start code sent by connect peer.
            services[i].self.emit('message', message);
          }
      });
      res.pipe(ldjsonparser);
  
    } else {  
    
      // amp.
      var parser = new Parser;
      parser.on('data', function(chunk){
        ////preview('connect', 'chunk', chunk);
        ////preview('connect', 'chunk.toString(): ' + chunk.toString());
        var message = new Message(chunk);
        //preview('connect', 'message.args', message.args);
        if ( message.args != '_0_' ) {    // _0_ is the start code sent by connect peer.
          //services[i].self.emit('message', message.args[0]);
          
          services[i].self.emit('message', message.args);
        }
      });
      res.pipe(parser);
    
    }

  });
  
  sock.on('error', function(e) {

    preview('connect', 'sock.on.error, connection error!, e.message:' + e.message + ' ignore: ' + ignore[e.code]);
    if ( ignore[e.code] && tryed < _settings.retry  ) {
      ////preview('connect', 'can\'t connect to peer, try reconnecting!');
      //reconnect(service, pattern, query, self, services[i]);  // try reconnecting...
    } else {
      if ( _settings.throw_error ) {
        console.trace(e);
        throw e;
      } else {
        //preview('error, problem with socket: ' + e.message);
        services[i].self.emit('error', e);
      }
    }   
    
  });

  
  sock.on('close', function(e) {
    preview('connect', 'connection closed!');
    removeSocket(socket);
    services[i].self.emit('closed', true);
    if ( tryed < _settings.retry ) {
      //preview('connect', 'connection to peer closed, try reconnecting!');
      reconnect(service, pattern, query, self, services[i]);  // try reconnecting...
    }
  }); 
  
  
  // NOTE: must do either .write() OR .end() to get bi-directional com working. Using a start/initeate code: _0_
  if ( _settings.protocol === 'ldjson' ) {
    var message = '_0_' + CRLF;
  } else {
    var message = new Message();
    message.push('_0_');    // _0_ is a code picked up by the bind peer to start coms.
    message = message.toBuffer();
  }
  
  sock.write( message );    // must!
  //sock.end();
  
}
util.inherits(newServiceConnect, events.EventEmitter);   



function reconnect(service, pattern, query, self, s) {
  setTimeout(function() {
    preview('reconnect attempt');
    s.self.emit('reconnect attempt', true);
    newServiceConnect(service, pattern, query, self);
  }, settings.reconnecttime); 
}



// send prototype.
newServiceBind.prototype.send = function send(m) {
  _send('bind', this.service, this.pattern, this.i, m);
};



newServiceConnect.prototype.send = function send(m) {
  _send('connect', this.service, this.pattern, this.i, m);
};



// _send.
function _send(socktype, service, pattern, i, m) {
  preview('_send, socketType: ' + socktype +  ' service: ' + service + ' pattern: ' + pattern + ' m: ' + m + ' i: ' + i);

  var socks = [];
  for ( var s in sockets ) {
    if ( sockets[s].service === service ) {
      socks.push(sockets[s]);
    } 
  }
  preview('send', 'socks.length: ' + socks.length);
  if ( socks.length > 0 ) {
    if ( pattern === 'push' ) {
      roundrobin(i, socks, m);
    } else if ( pattern === 'pub' || pattern === 'chit' || pattern === 'chat' ) {
      broadcast(i, socks, m);
    }
  } else {
    if ( pattern === 'push' ) {
      enqueue(i, pattern, m);   // only push, pull sockets queue undeliverable messages.
    }
  }
}



function checkService(service) {
  for ( var i in services ) {
    if ( services[i].name === service ) {
      preview('checkService pid:' + process.pid + ', this service already exists, i: ' + i, ',name: ' + services[i].name);
      return Number(i);   // TODO: return servce pattern too!
    } 
  }
  preview('checkService pid:' + process.pid + ', cant find service must be new: ' + service);
  return false;
}



function pack(args) {
  var msg = new Message(args);
  return msg.toBuffer();
}



// socket.write in roundrobin.
function roundrobin(i, socks, m) {
  preview('roundrobin', 'm.length: ' + m.length + ', raw m', m);
  
  var len = socks.length;
  var sock = socks[services[i].n++ % len];  

  if ( services[i].xsettings.protocol === 'ldjson' ) {
    // ldjson.
    var message = JSON.stringify(m) + CRLF;
  } else {
    // amp.
    // for each message if array of:
    if ( Object.prototype.toString.call(m) != '[object Array]' ) {
      var marray = [];
      marray.push(m);
    } else {
      var marray = m;
    }    
    var message = new Message();
    for ( var a in marray ) {
      //console.log('m in arr: ' + m[a]);
      message.push(marray[a]);
    }
    
    message = message.toBuffer();
  }
  //preview('roundrobin', 'paked message', message);
  
  sock.res.write( message );
}



// socket.wite in broadcast.
function broadcast(i, socks, m) {
  preview('broadcast', 'm.length: ' + m.length + ', raw m', m);

  if ( services[i].xsettings.protocol === 'ldjson' ) {
    // ldjson.
    var message = JSON.stringify(m) + CRLF;
  } else {
    // amp.
    
    // for each message if array of:
    if ( Object.prototype.toString.call(m) != '[object Array]' ) {
      var marray = [];
      marray.push(m);
    } else {
      var marray = m;
    }
    
    var message = new Buffer(0);
    for ( var a in marray ) {
      
      var msg = new Message();
      //console.log('m in arr: ' + m[a]);
      
      if ( Object.prototype.toString.call(marray[a]) === '[object Array]' ) {
        var msg = new Message(marray[a]);
      } else {
        var msg = new Message([marray[a]]);
      }
      
      // TODO:
      //msg.push(m[a][0]);    // the event meta
      //msg.push(m[a][1]);    // the blob
      //msg.push(m[a]);
    
      message = Buffer.concat([message, msg.toBuffer()]);
    
    }
    
  }
  
  //preview('broadcast', 'm.length: ' + m.length + ', paked message', message);
  
  for ( var sock in socks ) {
    socks[sock].res.write( message );
  }
  
}



function enqueue(i, pattern, m) {
  preview('enqueue', 'queue: ' + services[i].name + ', queued: ' + services[i].queue.length);
  services[i].self.emit('queued', m);   // message event so can save if want before droping.
  if (services[i].queue.length >= services[i].xsettings.hwm) return drop(m);
  services[i].queue.push(m);
}



function drop(m) {
  //preview('drop', m);
  // emit 'drop' m.   // TODO: emit drop event.
}



function addService(service) {
  var i = services.push(service) - 1;
  preview('addService, i: ' + i + ', name: ' + service.name);
  return i;
}



function addSocket(socket) {
  var i = sockets.push(socket) - 1;
  preview('addSocket: ' + i);
  return i;
}



function removeSocket(socket) {
  var i = sockets.indexOf(socket);
  if (!~i) return;

  preview('removeSocket: ' + i);
  sockets.splice(i, 1);   // delete this socket.
  //preview('removeSocket sockets.length: ' + sockets.length);
}



function ipAddress(request) { 
  return (request.headers['x-forwarded-for'] || '').split(',')[0] 
    || request.connection.remoteAddress 
    || request.socket.remoteAddress;
}

