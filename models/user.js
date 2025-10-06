const mongoose = require("mongoose");
const luckySpin = require("./luckySpin");

const referralStageSchema = new mongoose.Schema({
  stage: { type: Number, required: true },
  person: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  totalRecharge: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 0 },
  ids: [{ phone: String }],
});
const luckySpinSchema = new mongoose.Schema({
  spinsToday: { type: Number, default: 1 }, // how many spins user has done today
  lastSpinDate: { type: Date, default: null }, // last spin date
  createdAt: { type: Date, default: Date.now },
});
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  stage: { type: Number, default: 0 },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  referrals: [referralStageSchema],
  totalBuy: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  withdrawLimit:{ type: Number, default: 1000 },
  purchases: { type: Array, default: [] },
  tradePassword: { type: String, required: true },
  // ✅ New field for bank details
  bankDetails: {
    holderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    bankName: { type: String },
    upiId: { type: String }
   
  },
 luckySpin: { type: luckySpinSchema, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
