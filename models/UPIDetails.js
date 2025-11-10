const mongoose = require("mongoose");

const UpiDetailsSchema = new mongoose.Schema({
  upiId: {
    type: String,
    required: true,
    trim: true,
  },
  payeeName: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("UPIDetails", UpiDetailsSchema);
