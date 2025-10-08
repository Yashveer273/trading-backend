const express = require("express");
const User = require("../models/user");


const ClaimRoiRouter = express.Router();


ClaimRoiRouter.get("/",async (req, res) => {
 try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    const user = await User.findById(userId, "purchases");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, purchases: user.purchases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


ClaimRoiRouter.post("/add", async (req, res) => {
  try {
    const { userId, productId, cycleIndex, claimAmount } = req.body;
console.log(req.body);
    if (!userId || !productId || cycleIndex === undefined || !claimAmount) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    // Find user with purchase
    const user = await User.findOne({
      _id: userId,
      "purchases.productId": productId,
    });

    if (!user) return res.status(404).json({ success: false, message: "User or purchase not found" });

    // Check if already claimed
    const purchase = user.purchases.find(p => p.productId.toString() === productId);
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });

    if (purchase.claimedCycles.includes(cycleIndex)) {
      return res.status(400).json({ success: false, message: "Already claimed" });
    }

    // Push cycleIndex to claimedCycles
    await User.updateOne(
      { _id: userId, "purchases.productId": productId },
      { $push: { "purchases.$.claimedCycles": cycleIndex } }
    );

    // Optionally, update balance or PendingIncome
    await User.updateOne(
      { _id: userId },
      { $inc: { balance: claimAmount, PendingIncome: -claimAmount } }
    );

    res.json({ success: true, message: `Cycle ${cycleIndex} claimed for ₹${claimAmount}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = ClaimRoiRouter;