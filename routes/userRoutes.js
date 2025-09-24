const express = require("express");
const UserRouter = express.Router();
const User = require("../models/user");

const generateReferralCode = () =>
  Math.random().toString(36).substr(2, 6).toUpperCase();

const COMMISSION_RATES = { 1: 10, 2: 5, 3: 2 };

// POST /api/auth/register
UserRouter.post("/register", async (req, res) => {
  try {
    const { phone, password, refCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // Generate referral code for new user
    const referralCode = generateReferralCode();

    // Create base user
    let newUser = new User({
      phone,
      password,
      referralCode,
      stage: 0,
      referredBy: null,
      referrals: [],
    });
    await newUser.save();

    // If referral used
    if (refCode) {
      let referrer = await User.findOne({ referralCode: refCode });

      if (referrer) {
        // New user is stage 1
        newUser.stage = 1;
        newUser.referredBy = referrer._id;
        await newUser.save();

        // Walk up the tree for 3 levels
        let current = referrer;
        for (let lvl = 1; lvl <= 3 && current; lvl++) {
          current.referrals.push({
            stage: lvl,
            person: newUser._id,
            totalRecharge: 0,
            totalCommission: 0,
            commissionRate: COMMISSION_RATES[lvl],
            ids: [{ phone: newUser.phone }],
          });

          // 🔑 bump stage if needed (max 3)
          if (current.stage < lvl + 1) {
            current.stage = lvl + 1;
          }

          await current.save();

          // Move up to parent
          if (!current.referredBy) break;
          current = await User.findById(current.referredBy);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = UserRouter;
