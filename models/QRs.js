const mongoose = require("mongoose");
// Mongoose Models
const QRSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("QR", QRSchema);
