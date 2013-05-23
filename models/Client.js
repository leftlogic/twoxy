var mongoose      = require('mongoose'),
    crypto        = require('crypto'),
    modified      = require('./plugins/modified'),
    Schema        = mongoose.Schema,
    ObjectId      = Schema.ObjectId;

/**
 * Client Schema
 */
var clientSchema = new Schema({
  name: { type: String, required: true },
  clientId: { type: String, unique: true },
  twitterUserId: { type: Number, required: true },
  twitterClientId: { type: String, required: true },
  twitterClientSecret: { type: String, required: true }
  // Other information added by plugin
});

/**
 * Pres
 */
clientSchema.pre('save', function (next) {
  if (!this.clientId) {
    var sha256 = crypto.createHash('sha256');
    sha256.update(''+Date.now(), 'utf8');
    this.clientId = sha256.digest('hex');
  }
  next();
});

/**
 * Plugins
 */
clientSchema.plugin(modified, {
  index: true
});

module.exports = mongoose.model('Client', clientSchema);