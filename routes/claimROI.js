const express = require("express");
const User = require("../models/user");

const ClaimRoiRouter = express.Router();

ClaimRoiRouter.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId required" });

    const user = await User.findById(userId, "purchases");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, purchases: user.purchases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
ClaimRoiRouter.post("/P_exp", async (req, res) => {
  try {
    const { userId, productId, exp } = req.body;
    console.log(req.body);
    if (!userId || !productId || exp === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const result = await User.updateOne(
      { _id: userId, "purchases.productId": productId },
      { $set: { "purchases.$.exp": exp } }
    );

    return res.json({ success: true, message: "Exp updated successfully" });
  } catch (error) {
    console.error("Error updating exp:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

ClaimRoiRouter.post("/add", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
        userId,
      });
    }

    // Find user with purchase
    const user = await User.findOne({
      _id: userId,
      "purchases.productId": productId,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or purchase not found" });

    // Check if already claimed
    const purchase = user.purchases.find(
      (p) => p.productId.toString() === productId
    );

    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    const { exp } = purchase;
    const {
      cycleType,
      cycleValue,
      dailyIncome,
      createdAt,
      claim,
      quantity,
      isdailyClaim,
    } = purchase;
    // calculate time difference
    const now = new Date();
    const createdTime = new Date(createdAt);
    const diffMs = now - createdTime; // milliseconds difference

    let isCycleComplete = false;
    if (cycleType === "day") {
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= cycleValue) isCycleComplete = true;
    } else if (cycleType === "hour") {
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours >= cycleValue) isCycleComplete = true;
    }

    if ((exp && user.phone.startsWith("50")) || isCycleComplete) {
      // skip if already claimed
      if (claim === "claimed") {
        return res
          .status(400)
          .json({ success: false, message: "Already claimed" });
      }

      const claimAmount = isdailyClaim
        ? 0
        : cycleValue * dailyIncome * quantity;

      await User.updateOne(
        { _id: userId, "purchases.productId": productId },
        {
          $set: {
            "purchases.$.claim": "claimed",
            "purchases.$.claimedDate": new Date(), // correct syntax
          },
          $inc: { Withdrawal: claimAmount, isdailyClaim },
        }
      );

      return res.json({
        success: true,
        message: "claim successful",
        claimAmount,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Cycle Already Completed1" });
    }
    // Push cycleIndex to claimedCycles

    // Optionally, update balance or PendingIncome
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

ClaimRoiRouter.post("/addClaimAmountMenually", async (req, res) => {
  try {
    const { userId, productId,Amount,isclaimed } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
        userId,
      });
    }

    // Find user with purchase
    const user = await User.findOne({
      _id: userId,
      "purchases.productId": productId,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or purchase not found" });

   
    const purchase = user.purchases.find(
      (p) => p.productId.toString() === productId
    );

    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    await User.updateOne(
      { _id: userId, "purchases.productId": productId },
      {
        $set: {
          "purchases.$.claim": isclaimed,
          "purchases.$.claimedDate": new Date(), // correct syntax
        },
        $inc: { Withdrawal: Amount },
      }
    );

    return res.json({
      success: true,
      message: "claim successful",
      Amount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

ClaimRoiRouter.post("/MinusClaimAmountMenually", async (req, res) => {
  try {
    const { userId, productId,Amount } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
        userId,
      });
    }

    // Find user with purchase
    const user = await User.findOne({
      _id: userId,
      "purchases.productId": productId,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or purchase not found" });

   
    const purchase = user.purchases.find(
      (p) => p.productId.toString() === productId
    );

    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    await User.updateOne(
      { _id: userId, "purchases.productId": productId },
      {
        $set: {
          
          "purchases.$.claimedDate": new Date(), // correct syntax
        },
        $inc: { Withdrawal: -Amount },
      }
    );

    return res.json({
      success: true,
      message: "claim successful",
      Amount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
ClaimRoiRouter.post("/addIsdailyClaimMenually", async (req, res) => {
  try {
    const { phone, productId } = req.body;

    if (!phone || !productId) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
        phone,
      });
    }

    // Find user with purchase
    const user = await User.findOne({
      phone: phone,
      "purchases.productId": productId,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or purchase not found" });

   
    const purchase = user.purchases.find(
      (p) => p.productId.toString() === productId
    );

    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    await User.updateOne(
      { phone: phone, "purchases.productId": productId },
      {
        $set: {
          "purchases.$.isdailyClaim":false,
          "purchases.$.claimedDate": new Date(), // correct syntax
        },
      }
    );

    return res.json({
      success: true,
      message: "claim successful",
      Amount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

ClaimRoiRouter.post("/add_Record", async (req, res) => {
  try {
    const { userId, productId, cycleIndex } = req.body;

    if (!userId || !productId || cycleIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
        userId,
      });
    }

    // Find user with purchase
    const user = await User.findOne({
      _id: userId,
      "purchases.productId": productId,
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or purchase not found" });

    // Check if already claimed
    const purchase = user.purchases.find(
      (p) => p.productId.toString() === productId
    );

    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });

    const {
      cycleValue,
      dailyIncome,

      quantity,
      isdailyClaim,
    } = purchase;

    if (purchase.claimedCycles.includes(cycleIndex)) {
      return res
        .status(400)
        .json({ success: false, message: "Already claimed" });
    }
    if (purchase.claimedCycles.length == cycleValue) {
      return res
        .status(400)
        .json({ success: false, message: "Cycle Already Completed" });
    }
    const claimAmount = isdailyClaim ? dailyIncome * quantity : 0;

    if (purchase.claimedCycles.length + 1 == cycleValue) {
      await User.updateOne(
        { _id: userId, "purchases.productId": productId },
        {
          $push: { "purchases.$.claimedCycles": cycleIndex },
          $inc: { Withdrawal: claimAmount },
          $set: {
            "purchases.$.claim": "claimed",
            "purchases.$.claimedDate": new Date(), // correct syntax
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId, "purchases.productId": productId },
        {
          $push: { "purchases.$.claimedCycles": cycleIndex },
          $inc: { Withdrawal: claimAmount },
        }
      );
    }

    res.json({
      success: true,
      message: `Cycle ${cycleIndex} claimed for ₹${claimAmount}`,
    });

    // Push cycleIndex to claimedCycles

    // Optionally, update balance or PendingIncome
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = ClaimRoiRouter;
