const mongoose = require("mongoose");
const luckySpin = require("./luckySpin");

const referralStageSchema = new mongoose.Schema({

  totalRecharge: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  ids: [{ phone: String,person:String }],
});

const luckySpinSchema = new mongoose.Schema({
  spinsToday: { type: Number, default: 1 }, // how many spins user has done today
  lastSpinDate: { type: Date, default: null }, // last spin date
  createdAt: { type: Date, default: Date.now },
});
const referredBySchema = new mongoose.Schema(
  {
    refCode: { type: String, default: null },
    phone: { type: String, default: null },
  },
  { _id: false } // no separate _id for this embedded doc
);

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },

  referredBy:referredBySchema,

  // Team levels (stage = level number)
    team1: [referralStageSchema], // Stage 1 (Level 1)
    team2: [referralStageSchema], // Stage 2 (Level 2)
    team3: [referralStageSchema], // Stage 3 (Level 3)

  totalBuy: { type: Number, default: 0 },
  pendingIncome: { type: Number, default: 0 },
  productIncome: { type: Number, default: 0 },
  tasksReward: { type: Number, default: 0 },
  Withdrawal:{ type: Number, default: 0 },
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
