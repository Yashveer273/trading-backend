const express = require("express");
const Purchase = require("../models/purchase");
const User = require("../models/user");

const router = express.Router();

// ✅ Create a new purchase
router.post("/", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const purchase = new Purchase({ user: userId, amount });
    await purchase.save();

    res.status(201).json({ success: true, purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Get purchases of a user
router.get("/user/:userId", async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.params.userId });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.get("/:id/team", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("referrals.person", "phone stage");
    if (!user) return res.status(404).json({ message: "User not found" });

    const teamData = await Promise.all(
      user.referrals.map(async (r) => {
        const member = await User.findById(r.person);

        // Fetch purchases
        const purchases = await Purchase.find({ user: member._id }).sort({ purchasedAt: -1 });
        const totalBuy = purchases.reduce((sum, p) => sum + p.amount, 0);
        const purchaseHistory = purchases.map(
          (p) => `${p.product} - ₹${p.amount} @ ${p.purchasedAt.toISOString().slice(0, 10)}`
        );

        // Fetch coupons
        const coupons = await Coupon.find({ user: member._id });
        const totalCoupon = coupons.reduce((sum, c) => sum + c.amount, 0);

        return {
          name: member.phone,
          number: member.phone,
          totalBuy,
          purchaseHistory,
          directOrIndirect: r.stage === 1 ? "Direct" : "Indirect",
          balance: member.balance + totalCoupon, // final balance including coupon
        };
      })
    );

    res.json(teamData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
