const mongoose = require("mongoose");

const referralStageSchema = new mongoose.Schema({
  stage: { type: Number, required: true }, // 1 = direct, 2/3 = indirect
  person: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  stage: { type: Number, default: 0 },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  referrals: [referralStageSchema],
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
