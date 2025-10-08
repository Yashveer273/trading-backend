const express = require("express");
const Commission = require("../models/Commission");
const jwt = require('jsonwebtoken');

const CommissionRouter = express.Router();

// ✅ Get current commission settings
CommissionRouter.get("/",async (req, res) => {
  try {
    let commission = await Commission.findOne();
    if (!commission) {
      commission = await Commission.create({});
    }
    res.status(200).json({ success: true, data: commission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//  Update commission percentages
CommissionRouter.put("/update", async (req, res) => {
  try {
    const { level1, level2, level3 } = req.body;

    let commission = await Commission.findOne();
    if (!commission) {
      commission = await Commission.create({});
    }

    if (level1 !== undefined) commission.level1 = level1;
    if (level2 !== undefined) commission.level2 = level2;
    if (level3 !== undefined) commission.level3 = level3;

    await commission.save();

    res.status(200).json({
      success: true,
      message: "Commission percentages updated successfully!",
      data: commission,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = CommissionRouter;