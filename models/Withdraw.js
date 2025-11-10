const mongoose = require("mongoose");

const withdrawSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    timestamp: { type: String, required: true },
    phone:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdraw", withdrawSchema);
