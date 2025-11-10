const mongoose = require("mongoose");
// Mongoose Models


const PaymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  utr: { type: String, required: true,unique: true, },
  qrImageName: { type: String, required: true },
  approved: { type: String, default: "Pending" },
  phone:{ type: Number, default: 0 },
 
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Payment", PaymentSchema);