/**
 * Routes
 */

// Auth dependencies
var passport = require('passport'),
    login    = require('connect-ensure-login');

// Utils
var casper       = require('casper'),
    _            = require('underscore'),
    url          = require('url');

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

/**
 * Constructs an OAuth request object that can then be used with a token and
 * token secret to proxy request to Twitter.
 *
 * Parameters:
 *   {object} client Contains twitterClientId & twitterClientSecret
 */
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

/**
 * Proxy the request to this API over to Twitter, wrapping it all up in a lovely
 * OAuth1.0A package. The Twitter API credentials are stored in the client
 * object.
 *
 * Parameters:
 *   {string} method HTTP method, and name of method on the OAuth object
 *   {string} path Twitter API URL path
 *   {object} config Keys: proxy_client_id, token and token_secret
 *   {object} req An express request object
 *   {object} client A document from the client collection, used to construct an
 *                   OAuth request object
 *   {function} cb Callback function for when the request is complete. Takes an
 *                 error, the response as a string and the full response object.
 */
var proxyRequest = function (method, path, config, req, client, cb) {
  // Pull the oa object from the in-memory cache, or create a new on and cache
  // the hell out of it.
  var oa = oauthCache[config.proxy_client_id] || constructOa(client);
  oauthCache[config.proxy_client_id] = oa;

  // Make sure the the oa object has the requisite method
  method = method.toLowerCase();
  if (!oa[method]) return cb(new Error("Unknown method"));

  var twitterUrl = url.format({
    protocol: 'https',
    host: 'api.twitter.com',
    pathname: path,
    query: req.query
  });

  return oa[method](
    twitterUrl,
    config.token,
    config.token_secret,
    cb
  );
};

/**
 * Proxy requests to all other URLs to Twitter, using the same path. It also
 * passes all query parameters, except those used by the proxy, on to Twitter.
 *
 * Requires proxy_client_id, token and token_scret. proxy_client_ids are
 * created when a app is creating using the admin panel.
 */
app.all('/*?',
  casper.check.query('proxy_client_id'),
  casper.check.query('token'),
  casper.check.query('token_secret'),
  function (req, res, next) {
    var config = {
      proxy_client_id: req.query.proxy_client_id,
      token: req.query.token,
      token_secret: req.query.token_secret
    };
    delete req.query.proxy_client_id;
    delete req.query.token;
    delete req.query.token_secret;

    // Find the client associated with this proxy_client_id
    Client
      .findOne({ clientId: config.proxy_client_id })
      .exec(casper.db(req, res, function (err, client) {
        if (err) return res.jsonp(500, { error: "Sorry, something went wrong." });
        if (!client) return res.jsonp(401, { error: "Could not match proxy_client_id." });
        // Prozy the request onward to Twitter. The OAuth parcel is created in
        // proxyRequest, and cached for later.
        proxyRequest(
          req.method,
          req.path,
          config,
          req,
          client,
          function (oaErr, strData, oaRes) {
            if (oaErr) return res.jsonp(502, { error: 'OAuth error. ' + oaErr });
            var data;
            try {
              data = JSON.parse(strData);
            } catch(e) {
              return res.jsonp(502, { error: "Malformed response from Twitter." });
            }
            res.jsonp(oaRes.statusCode, data);
          }
        );
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