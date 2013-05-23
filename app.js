/**
 * twitter-proxy
 */

/**
 * Module dependencies.
 */

var http        = require('http'),
    path        = require('path');

var express     = require('express'),
    cons        = require('consolidate'),
    swig        = require('swig'),
    flash       = require('connect-flash');

var passport    = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy;

var mongoose    = require('mongoose'),
    db          = mongoose.connection,
    MongoStore  = require('connect-mongo')(express),
    routes      = require('./routes');

/**
 * Configuration
 * See: http://s.phuu.net/12PFa6J
 */

// Grab the config file if it's there
var configFile;
try {
  configFile = require('./config.json');
} catch (e) {
  configFile = {};
}

// Then configure!
var config = {
  port: parseInt(process.argv[2], 10) ||
        parseInt(process.env.PORT, 10) ||
        configFile.port ||
        3789,
  db: process.env.MONGOHQ_URL ||
      process.env.DB_URI ||
      configFile.db ||
      'mongodb://localhost:27017/twitter-proxy',
  cookieSecret: process.env.COOKIE_SECRET ||
                'secret',
  twitter: {
    id:          configFile.TWITTER_ID ||
                 process.env.TWITTER_ID,
    secret:      configFile.TWITTER_SECRET ||
                 process.env.TWITTER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK ||
                 'http://localhost:3789/auth/twitter/callback'
  }
};

console.log(config);

/**
 * Database configuration
 */

// Connect to the DB
mongoose = mongoose.connect(config.db);

// Query logging
mongoose.set('debug', true);

// Error logging
db.on('error', console.error.bind(console, 'Database: Connection error:'));
db.once('open', function () {
  console.log("Database: Connected.");
});

/**
 * Passport setup
 */

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new TwitterStrategy({
    consumerKey: config.twitter.id,
    consumerSecret: config.twitter.secret,
    callbackURL: config.twitter.callbackURL
  },
  function(token, tokenSecret, profile, done) {
    return done(null, {
      token: token,
      token_secret: tokenSecret,
      profile: profile
    });
  }
));

/**
 * Express configuration
 */

var app = express();

// All environments
app.set('port', config.port || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.set('view options', { layout: false });
app.engine('html', cons.swig);
swig.init({
  root: __dirname + '/views',
  allowErrors: true,
  cache: (app.get('env') !== 'development')
});
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser(config.cookieSecret));
app.use(express.session({
  secret: config.cookieSecret,
  store: new MongoStore({
    url: config.db
  })
}));

// Setup passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Express routing
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Development-only config
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

/**
 * Utils
 */

app.fn = {};
app.fn.render = function () {
  var args = [].slice.call(arguments);
  return function (req, res) {
    res.render.apply(res, args);
  };
};

/**
 * Routing
 */

routes(app);

/**
 * Get the party started
 */
http
  .createServer(app)
  .listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
  });
