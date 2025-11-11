const express = require("express");
const router = express.Router();
const UPIDetails = require("../models/UPIDetails");

/**
 * ✅ 1. CREATE UPI details
 */
router.post("/save", async (req, res) => {
  try {
    const { upiId, payeeName } = req.body;

    if (!upiId || !payeeName) {
      return res.status(400).json({
        success: false,
        message: "upiId and payeeName are required",
      });
    }

    if (!/@/.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid UPI ID format",
      });
    }

    const record = await UPIDetails.create({ upiId, payeeName });

    return res.status(201).json({
      success: true,
      message: "UPI details saved successfully",
      data: record,
    });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ✅ 2. GET ALL UPI details
 */
router.get("/list", async (req, res) => {
  try {
    const records = await UPIDetails.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: records,
    });
  } catch (err) {
    console.error("LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/random", async (req, res) => {
  try {
    const count = await UPIDetails.countDocuments();

    if (count === 0) {
      return res.status(404).json({
        success: false,
        message: "No UPI records found",
      });
    }

    const randomIndex = Math.floor(Math.random() * count);
    const record = await UPIDetails.findOne().skip(randomIndex);

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (err) {
    console.error("RANDOM ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ✅ 4. UPDATE UPI details by ID
 */
router.put("/edit/:id", async (req, res) => {
  try {
    const { upiId, payeeName } = req.body;
    const { id } = req.params;

    const record = await UPIDetails.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "UPI details not found",
      });
    }

    if (upiId) {
      
      record.upiId = upiId;
    }

    if (payeeName) record.payeeName = payeeName;

    await record.save();

    return res.status(200).json({
      success: true,
      message: "UPI details updated successfully",
      data: record,
    });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ✅ 5. DELETE UPI detail by ID
 */
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const record = await UPIDetails.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "UPI record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "UPI record deleted successfully",
    });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
