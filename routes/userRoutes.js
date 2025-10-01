const express = require("express");
const User = require("../models/user");
const Purchase = require("../models/purchase");

const UserRouter = express.Router();

// GET all users
UserRouter.get("/", async (req, res) => {
  try {
    const users = await User.find().populate("referredBy", "phone referralCode");
    const data = await Promise.all(users.map(async user => {
      const purchases = await Purchase.find({ user: user._id });
      const totalBuy = purchases.reduce((sum, p) => sum + p.amount, 0);
      return {
        _id: user._id,
        phone: user.phone,
        referredBy: user.referredBy?.phone || "-",
        stage: user.stage,
        totalBuy,
        balance: user.balance,
      };
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get team of a user
UserRouter.get("/:id/team", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("referrals.person", "phone referralCode");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Transform team data
    const teamData = user.referrals.map((r) => ({
      phone: r.ids[0]?.phone || "N/A",
      stage: r.stage,
      totalBuy: r.totalRecharge || 0,
      purchaseHistory: [], // later: link to real purchases
      balance: 0, // placeholder
      profit: r.totalCommission || 0,
    }));

    res.json(teamData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

    // Generate JWT token
    const token = jwt.sign({ phone }, SECRET_KEY, { expiresIn: "7d" });

    // Create base user
    let newUser = new User({
      phone,
      password, // ⚠️ hash before saving in production
      referralCode,
      stage: 0,
      referredBy: null,
      referrals: [],
      token, // store token
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
      token, // return token to client
      user: newUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Check if fields provided
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password are required" });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ⚠️ In production use bcrypt.compare
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Generate new JWT
    const token = jwt.sign({ phone: user.phone }, SECRET_KEY, { expiresIn: "7d" });

    // Save token in DB
    user.token = token;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = UserRouter;
