const express = require("express");
const User = require("../models/user");
const jwt = require('jsonwebtoken');

const UserRouter = express.Router();
const SECRET_KEY="SECRET_KEY12356789";
// GET all users

UserRouter.get("/", async (req, res) => {
  try {
    const users = await User.find().populate("referredBy", "phone");
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
UserRouter.get("/user", async (req, res) => {
  const {userId}=req.query;
  try {
    const users = await User.findById(userId);
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// Direct team (Stage 1)
UserRouter.get("/:userId/direct-team", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("referrals.person", "phone");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const directTeam = user.referrals
      .filter(r => r.stage === 1)
      .map(r => ({
        phone: r.person?.phone || "-",
        stage: r.stage,
        totalCommission: r.totalCommission || 0,
      }));

    res.status(200).json({ success: true, team: directTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Indirect team (Stage 2 & 3)
UserRouter.get("/:userId/indirect-team", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("referrals.person", "phone");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const indirectTeam = user.referrals
      .filter(r => r.stage === 2 || r.stage === 3)
      .map(r => ({
        phone: r.person?.phone || "-",
        stage: r.stage,
        totalCommission: r.totalCommission || 0,
      }));

    res.status(200).json({ success: true, team: indirectTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Withdraw Limit
UserRouter.get("/:userId/withdraw-limit", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      withdrawLimit: user.withdrawLimit,
      balance: user.balance,
    });
  } catch (err) {
    console.error("Withdraw Limit Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Withdraw Limit (Admin / Testing)
UserRouter.put("/:userId/withdraw-limit", async (req, res) => {
  try {
    const { limit } = req.body;
    if (!limit) return res.status(400).json({ success: false, message: "Limit is required" });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { withdrawLimit: limit },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      message: "Withdraw limit updated",
      withdrawLimit: user.withdrawLimit,
    });
  } catch (err) {
    console.error("Update Withdraw Limit Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});




// POST /api/auth/register
const generateReferralCode = () =>
  Math.random().toString(36).substr(2, 6).toUpperCase();

const COMMISSION_RATES = { 1: 10, 2: 5, 3: 2 };

UserRouter.post("/register", async (req, res) => {
  try {
    const { phone, password, refCode,tradePassword } = req.body;

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
      token, 
      tradePassword
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
