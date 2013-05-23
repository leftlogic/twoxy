/**
 * Routes
 */

// Auth dependencies
var passport = require('passport'),
    login    = require('connect-ensure-login');

// Utils
var casper       = require('casper'),
    _            = require('underscore');

// Databse dependecies
var Client   = require('../models').Client;

// OAuth deps
var oauth = require('oauth');

module.exports = function (app) {

/**
 * Root
 */

app.get('/',
  login.ensureLoggedIn('/login'),
  function (req, res, next) {
    Client
      .find({ twitterUserId: req.user.profile.id })
      .exec(function (err, apps) {
        if (err) return next(err);
        res.render('apps.html', {
          apps: apps
        });
      });
  });

/**
 * Apps
 */

app.get('/apps/new',
  login.ensureLoggedIn('/login'),
  function (req, res, next) {
    console.log(req.flash('data')[0]);
    res.render('new-app.html', {
      data: req.flash('data')[0],
      msgs: req.flash('msg')
    });
  });

app.post('/apps/new',
  login.ensureLoggedIn('/login'),
  casper.allow.body(['name', 'twitterClientId', 'twitterClientSecret']),
  function (req, res, next) {
    if (req.body.name &&
        req.body.twitterClientId &&
        req.body.twitterClientSecret) return next();
    req.flash('msg', { type: 'error', text: 'All fields must be filled in.' });
    req.flash('data', req.body);
    res.redirect('back');
  },
  function (req, res, next) {
    var client = new Client(req.body);
    client.set({
      twitterUserId: req.user.profile.id
    });
    client.save(function (err) {
      console.log(err);
      if (err) {
        req.flash('msg', { type: 'error', text: 'Sorry – something went wrong while saving, please try again.' });
        return res.redirect('back');
      }
      req.flash('msg', { type: 'success', text: 'Great! Your app was created successfully.' });
      res.redirect('/app/' + client._id);
    });
  });

/**
 * App
 */

app.get('/app/:_id',
  login.ensureLoggedIn('/login'),
  function (req, res, next) {
    Client
      .findOne({ _id: req.params._id })
      .exec(function (err, app) {
        if (err) return res.redirect('/');
        res.render('app.html', {
          app: app,
          msgs: req.flash('msg')
        });
      });
  });

/**
 * Login
 */

app.get('/login',
  function (req, res) {
    console.log(req.session);
    res.render('login.html', {
      msgs: req.flash('msg')
    });
  });

app.post('/login',
  passport.authenticate('twitter', {
    successReturnToOrRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  }));

/**
 * Authentication
 */

app.get('/auth/twitter',
  passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

/**
 * API
 */

var oauthCache = {};

var constructOa = function (client) {
  return new oauth.OAuth(
    'https://api.twitter.com/oauth/request_token',
    'https://api.twitter.com/oauth/access_token',
    client.twitterClientId,
    client.twitterClientSecret,
    '1.0A',
    null,
    'HMAC-SHA1'
  );
};

var proxyRequest = function (method, data, client, cb) {
  var oa = oauthCache[data.client_id] || constructOa(client);
  oauthCache[data.client_id] = oa;

  method = method.toLowerCase();
  if (!oa[method]) return cb(new Error("Unknown method"));

  return oa[method](
    data.url,
    data.token,
    data.token_secret,
    cb
  );
};

app.all('/twitter',
  casper.check.query('client_id'),
  casper.check.query('token'),
  casper.check.query('token_secret'),
  casper.check.query('url'),
  function (req, res, next) {
    Client
      .findOne({ clientId: req.query.client_id })
      .exec(casper.db(req, res, function (err, client) {
        proxyRequest(req.method, req.query, client, function (oaErr, strData, oaRes) {
          if (err) return res.jsonp(400, oaErr);
          var data;
          try {
            data = JSON.parse(strData);
          } catch(e) {
            return res.jsonp(500, new Error("Malformed response from Twitter."));
          }
          res.jsonp(data);
        });
      }));
  });

/**
 * Setup
 */

app.post('/setup/client',
  function (req, res) {
    var client = new Client(req.body);
    client.save(function (err) {
      if (err) return res.send(500, err);
      res.jsonp(client);
    });
  });

};