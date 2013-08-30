'use strict';

//Configuration variables
var DOMAIN = 'www.google.com';
var FREQUENCY = 10;

//Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var yaping = require('yaping');
var mongoose = require('mongoose');
var app = express();

//Express
app.set('port', process.env.PORT || 3000);
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res) {
  res.redirect('/');
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

//Mongo configuration
mongoose.connect('mongodb://localhost/ping');
mongoose.connection.on('error', function(err) {
  console.log('MongoDB error: ' + err);
});
var pingSchema = new mongoose.Schema({
  domain: String,
  time: Number,
  run_at: {
    type: Date,
    default: Date.now
  }
});
var Ping = mongoose.model('Ping', pingSchema);


//API

app.get('/', function(req, res) {
  res.sendfile(path.join(__dirname,'public/index.html'));
});

//Get ping list, defaults to 10. This should be streamed or it may very well blow up. Maybe later.
app.get('/api/ping/list.json', function(req, res) {
  var DEFAULT_LIMIT = 10;
  var limit = parseInt(req.query.limit || '0', 10);
  var query = Ping.find();
  if (limit && !isNaN(limit)) {
    query.limit(limit);
  } else {
    query.limit(DEFAULT_LIMIT);
  }

  query.sort('-run_at');

  query.exec(function(err, list) {
    if (err) {
      throw new Error(err);
    }
    res.json(list);
  });
});

//Get average ping for given limit, defaults to 1000 latest records.
app.get('/api/ping/avg.json', function(req, res) {
  var limit = parseInt(req.query.limit || '0', 10);
  if (!limit || isNaN(limit)) {
    limit = 1000;
  }

  Ping.aggregate([
    {
      $limit: limit
    },
    {
      $sort: {
        time: 1
      }
    },
    {
      $group: {
        _id: '$domain',
        timeAvg: {
          $avg: '$time'
        }
      }
    }
  ], function(err, result) {
    if (err) {
      throw new Error(err);
    }
    res.json(result.pop());
  });
});

//Get max ping for given limit, defaults to 1000 latest records.
app.get('/api/ping/max.json', function(req, res) {
  var limit = parseInt(req.query.limit || '0', 10);
  if (!limit || isNaN(limit)) {
    limit = 1000;
  }

  Ping.aggregate([
    {
      $limit: limit
    },
    {
      $sort: {
        time: 1
      }
    },
    {
      $group: {
        _id: '$domain',
        timeMax: {
          $max: '$time'
        }
      }
    }
  ], function(err, result) {
    if (err) {
      throw new Error(err);
    }
    res.json(result.pop());
  });
});

//Get min ping for given limit, defaults to 1000 latest records.
app.get('/api/ping/min.json', function(req, res) {
  var limit = parseInt(req.query.limit || '0', 10);
  if (!limit || isNaN(limit)) {
    limit = 1000;
  }

  Ping.aggregate([
    {
      $limit: limit
    },
    {
      $sort: {
        time: 1
      }
    },
    {
      $group: {
        _id: '$domain',
        timeMin: {
          $min: '$time'
        }
      }
    }
  ], function(err, result) {
    if (err) {
      throw new Error(err);
    }
    res.json(result.pop());
  });
});

//Yaping
var runPing = function(){
  yaping(DOMAIN, function(err, result) {
    if (!err) {
      var entry = new Ping({
        domain: DOMAIN,
        time: result.time
      });

      entry.save(function(err, value) {
        if (err) {
          throw new Error(err);
        } else {
          console.log('New entry saved correctly.');
          console.log('Entry value: ' + value);
        }

      });
    } else {
      console.log('Error pinging ' + DOMAIN + '.');
      console.log('Information: ' + JSON.stringify(result));
    }
  });
};
setInterval(runPing, 1000*FREQUENCY);
