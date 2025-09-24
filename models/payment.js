const mongoose = require("mongoose");
// Mongoose Models


const PaymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  utr: { type: String, required: true },
  qrImageName: { type: String, required: true },
  approved: { type: Boolean, default: false },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Payment", PaymentSchema);