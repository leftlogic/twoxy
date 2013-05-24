var t       = require('tap'),
    request = require('request'),
    _       = require('underscore'),
    url     = require('url');

var config = {
  url: process.env.DEV_URL,
  twitter: {
    id: process.env.TWITTER_ID,
    secret: process.env.TWITTER_SECRET,
    token: process.env.TWITTER_TOKEN,
    token_secret: process.env.TWITTER_TOKEN_SECRET
  },
  proxy: {
    id: process.env.PROXY_ID
  }
};

/**
 * Make a URL from the path and a query object
 */
var u = function (path, query) {
  query = query || {};
  var base = url.parse(config.url);
  base.pathname = path;
  base.query = query;
  return url.format(base);
};

/**
 * Make a query object from the defaults (from the config) and any supplied
 * in the obj argument
 */
var q = function (obj) {
  obj = obj || {};
  var defaults = {
    proxy_client_id: config.proxy.id,
    token: config.twitter.token,
    token_secret: config.twitter.token_secret,
  };
  return _.defaults({}, obj, defaults);
};

var json = function (url, cb) {
  return request({
    url: url,
    json: true,
    jar: request.jar()
  }, cb);
};

/**
 * Tests
 */

t.test('twitter api', function (t) {

  t.test('get my timeline', function (t) {

    json(u('/1.1/statuses/user_timeline.json', q()), function (err, res, body) {
      t.ok(body.length, 'Tweet were returned.');
      t.end();
    });

  });

  t.test('get my settings', function (t) {

    json(u('/1.1/account/settings.json', q()), function (err, res, body) {
      t.ok(body.screen_name, 'Data was returned.');
      t.end();
    });

  });

  t.end();

});