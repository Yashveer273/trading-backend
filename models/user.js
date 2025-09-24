const mongoose = require("mongoose");

const referralStageSchema = new mongoose.Schema({
  stage: { type: Number, required: true }, // 1, 2, 3
  person: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  totalRecharge: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 0 },
  ids: [{ phone: String }],
});

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },

  stage: { type: Number, default: 0 }, // 👈 quick lookup stage
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  referrals: [referralStageSchema], // 👈 team details

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
