// ==================================
// modification
//
// Adds a modification fields to a schema and gives it a value to createdAat
// when saved for the first time, and modifiedAt every time it's saved.
// ==================================
module.exports = function (schema, options) {

  // Fields
  schema.add({
    createdAt: Date,
    modifiedAt: Date
  });

  // Pre
  schema.pre('save', function (next) {
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    this.modifiedAt = new Date();
    next();
  });

  // Index?
  if (options && options.index) {
    schema
      .path('modifiedAt')
      .index(options.index);
    schema
      .path('createdAt')
      .index(options.index);
  }

  schema.statics.touch = function (id) {
    this
      .findOne({ _id: id })
      .exec(function (err, obj) {
        if (err || !obj) return;
        obj.save();
      });
  };

};