"use strict";
//
// ldjson: Line Delineated JSON Parser.
//
// Version: 0.0.2
// Author: Mark W. B. Ashcroft (mark [at] kurunt [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2015 Mark W. B. Ashcroft.
// Copyright (c) 2015 Fluidecho.
//


// Note, about Line Delineated Format see: http://en.wikipedia.org/wiki/Line_Delimited_JSON

var Stream = require('stream').Writable;


module.exports = Parser;    // expose.


var options = {
  encoding: 'utf8',
  maxbuffer: 102400   // 102400 = 100 KB.
};


// Parser({options})
function Parser(op) {
  if ( op != undefined ) {
    if ( op.encoding ) {
      options.encoding = op.encoding;
    }
    if ( op.maxbuffer ) {
      options.maxbuffer = op.maxbuffer;
    } 
  }
  Stream.call(this, options);
}
Parser.prototype.__proto__ = Stream.prototype;    // inherit from `Stream.prototype`.


var buffer = new Buffer(0);   // concat until message completed.
var bufferLoop  = new Buffer(0);


Parser.prototype._write = function(chunk, encoding, cb){

  if ( chunk.length > options.maxbuffer ) {
    this.emit('error', 'chunk exceed MAXBUFFER! close request.');
    return cb(false);
  } 

  buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);    // on chunk concate buffer.

  if ( buffer.length > options.maxbuffer ) {
    this.emit('error', 'buffer chunks exceed MAXBUFFER! close request.');
    return cb(false);     
  }

  bufferLoop = null;
  bufferLoop = new Buffer(buffer.length); 
  bufferLoop = buffer;

  var cr = -99;   // reason for setting to -99 so wont trigger when i = 0 if CR here was also 0.
  var LF = 10;    // line feed is 10 decimal value in ascii eg: \n = 10.
  var CR = 13;    // carage return is 13 decimal value in ascii eg: \r = 13.

  // examine chunk for individual messages.
  var i = 0, x = 0;
  for (i = 0; i < bufferLoop.length; i++) {

		// TODO: test, performance tip, use: bufferLoop[i] instread of bufferLoop.readUInt8(i), much faster.

    // check if delineate is escaped. ascii 47 = / (escaped).
    //if ( bufferLoop.readUInt8(i) === CR ) {
    if ( bufferLoop[i] === CR ) {
      cr = i;
    }

		if ( bufferLoop[i] === LF && i === (cr + 1) ) {
    //if ( bufferLoop.readUInt8(i) === LF && i === (cr + 1) ) {
      //console.log('client> is delineate \r\n here, at: ' + i + ' x: ' + x);

      buffer = null;
      buffer = new Buffer(bufferLoop.length - (i + 1));
      buffer = bufferLoop.slice(i + 1);

      var m = bufferLoop.slice(x, i - 1).toString(options.encoding);    // -1 because delineate is 2 characters: \r\n

      if ( m === '_0_' ) {
      
        this.emit('message', '_0_');
      
      } else {
      
        var message = JSON.parse(m);
        this.emit('message', message);
      
      }

      x = i + 1;
    }

  }

  cb();
};


