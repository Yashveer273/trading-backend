const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: { type: String, required: true }, // VIP1, VIP2, etc.
  amount: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Purchase", purchaseSchema);
