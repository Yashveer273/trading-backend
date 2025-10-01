const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Coupon", couponSchema);
