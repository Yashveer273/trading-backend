const express = require("express");
const Coupon = require("../models/coupon");
const User = require("../models/user");

const router = express.Router();

// ✅ Apply a coupon for a user
router.post("/apply", async (req, res) => {
  try {
    const { userId, code, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Create coupon
    const coupon = new Coupon({ user: userId, code, amount });
    await coupon.save();

    // Add coupon amount to user's balance
    user.balance += amount;
    await user.save();

    res.status(201).json({ success: true, coupon, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
