const express = require("express");
const router = express.Router();
const Withdraw = require("../models/Withdraw");
const User = require("../models/user");
const { default: mongoose } = require("mongoose");

// ✅ Withdraw Request
router.post("/", async (req, res) => {
  try {
    const { userId, amount, tradePassword } = req.body;

    if (!userId || !amount || !tradePassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const timestamp = new Date();
   const startOfDay = new Date(timestamp.setHours(0, 0, 0, 0));
    const endOfDay = new Date(timestamp.setHours(23, 59, 59, 999));

    const existingWithdraw = await Withdraw.findOne({
      user: userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingWithdraw) {
      return res.status(400).json({
        success: false,
        message: "You can only submit one withdraw request per day",
      });
    }
    // 1️⃣ Find user and validate trade password + bank details
    const user = await User.findOne({
      _id: userId,
      tradePassword: tradePassword,
      "bankDetails.accountNumber": { $exists: true, $ne: "" },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "User not found, invalid trade password, or bank details missing",
      });
    }

    // 2️⃣ Validate requested withdrawal amount
    if (amount > user.Withdrawal) {
      return res.status(400).json({
        success: false,
        message: "Requested amount exceeds available balance",
      });
    }

    if (amount < user.withdrawLimit) {
      return res.status(400).json({
        success: false,
        message: `Requested amount less then withdrawal limit of ${user.withdrawLimit}`,
      });
    }

    // 4️⃣ Save withdrawal request separately
    const withdraw = await Withdraw.create({ user: userId, amount, timestamp });
    // 3️⃣ Deduct balance and push withdrawal history atomically
    await User.updateOne(
      { _id: userId },
      {
        $inc: { Withdrawal: -amount },
        $push: {
          withdrawHistory: {
            amount,
            user: userId,
            _id: withdraw._id,
            status: "pending",
            timestamp,
          },
        },
      }
    );
    res.json({
      success: true,
      message: "Withdraw request submitted",
      withdraw,
    });
  } catch (err) {
    console.error("Withdraw Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get Withdraw History
router.get("/history/:userId", async (req, res) => {
  try {
    const history = await Withdraw.find({ user: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, history });
  } catch (err) {
    console.error("Withdraw History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
router.get("/withdraw-statement", async (req, res) => {
  try {
    // Get page and limit from query params, default: page=1, limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Total count of withdrawals
    const total = await Withdraw.countDocuments();

    // Fetch paginated withdrawals
    const history = await Withdraw.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      history,
    });
  } catch (err) {
    console.error("Withdraw History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/withdraw-pending", async (req, res) => {
  try {
    // Fetch all pending withdrawals, sort newest first
    const pending = await Withdraw.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .lean();

    res.json({
      success: true,
      message: "Pending withdrawals fetched successfully",
      data: pending,
    });
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Approve a withdrawal
router.put("/withdraw-approve/:id", async (req, res) => {
  try {
    const updated = await Withdraw.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    const { user, _id } = updated;

    await User.updateOne(
      {
        _id: user, // User document ID
        "withdrawHistory._id": new mongoose.Types.ObjectId(_id), // Match withdrawHistory._id
      },
      {
        $set: {
          "withdrawHistory.$.status": "approved",
          "withdrawHistory.$.approvedAt": new Date(), // optional: record approval time
        },
      }
    );
    res.json({ success: true, message: "Withdrawal approved", data: updated });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reject a withdrawal
router.put("/withdraw-reject/:id", async (req, res) => {
  try {
    const updated = await Withdraw.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    const { user, _id, amount } = updated;
    const numericAmount = Number(amount) || 0;
    console.log(_id);
    const userUpdate = await User.updateOne(
      {
        _id: user, // User document ID
        "withdrawHistory._id": new mongoose.Types.ObjectId(_id), // Match withdrawHistory._id
      },
      {
        $set: {
          "withdrawHistory.$.status": "rejected",
          "withdrawHistory.$.rejectedAt": new Date(),
        },
        $inc: { Withdrawal: numericAmount },
      }
    );

    console.log(userUpdate);
    res.json({ success: true, message: "Withdrawal rejected", data: updated });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// -------------------------------------------------------------------------------
// ✅ Save Bank Details (only once or update if needed)
router.post("/bank-details", async (req, res) => {
  try {
    const { userId, holderName, accountNumber, ifscCode, bankName, upiId } =
      req.body;

    // Validate
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    // ✅ MongoDB query update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "bankDetails.holderName": holderName,
          "bankDetails.accountNumber": accountNumber,
          "bankDetails.ifscCode": ifscCode,
          "bankDetails.bankName": bankName,
          "bankDetails.upiId": upiId,
        },
      },
      { new: true } // return updated document
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Bank details saved successfully",
      bankDetails: updatedUser.bankDetails,
    });
  } catch (err) {
    console.error("Bank Details Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/bank", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    // ✅ Fetch only bankDetails field (projection for efficiency)
    const user = await User.findById(userId, {
      bankDetails: 1,
      Withdrawal: 1,
      _id: 0,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ If no bank details saved yet
    if (!user.bankDetails || Object.keys(user.bankDetails).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No bank details found",
        bankDetails: {},
      });
    }

    // ✅ Return bank details
    res.json({
      success: true,
      message: "Bank details fetched successfully",
      bankDetails: user.bankDetails,
      Withdrawal: user.Withdrawal,
    });
  } catch (err) {
    console.error("Get Bank Details Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/bank-details/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { bankDetails, tradePassword } = req.body;

    // 🧩 Basic validation
    if (!userId || !bankDetails || !tradePassword) {
      return res.status(400).json({
        success: false,
        message: "User ID, bank details, and trade password are required",
      });
    }

    // 🔍 Find user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 🔒 Compare trade password (assuming it's hashed in DB)
    const isPasswordMatch = user.tradePassword === tradePassword;

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid trade password",
      });
    }

    // ✅ Update bank details
    user.bankDetails = bankDetails;
    await user.save();

    res.json({
      success: true,
      message: "Bank details updated successfully",
      bankDetails: user.bankDetails,
    });
  } catch (err) {
    console.error("Update Bank Details Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
