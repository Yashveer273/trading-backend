const express = require("express");
const Giftcode = require("../models/Giftcode");

const giftRourter = express.Router();

/**
 * POST /api/giftcodes/add
 * Create a new giftcode
 */
giftRourter.post("/add", async (req, res) => {

  try {
    const { creator, amount, users, newUsersOnly, expiry } = req.body;

    const newGiftcode = new Giftcode({
      creator,
      amount,
      users,
      newUsersOnly: newUsersOnly || false,
      expiry: expiry || "No",
      time: new Date().toISOString(),
    });

    await newGiftcode.save();
    res.status(201).json({ success: true, giftcode: newGiftcode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/giftcodes
 * Get all giftcodes
 */
giftRourter.get("/", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 0;
    const giftcodes = await Giftcode.find({}).limit(limit);
    res.json({ success: true, giftcodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/giftcodes/:id
 * Get giftcode by ID
 */
giftRourter.get("/:id", async (req, res) => {
  try {
    const giftcode = await Giftcode.findById(req.params.id);
    if (!giftcode)
      return res.status(404).json({ success: false, message: "Giftcode not found" });

    res.json({ success: true, giftcode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/giftcodes/:id
 * Update giftcode by ID
 */
giftRourter.put("/:id", async (req, res) => {
  try {
    const { creator, amount, users, newUsersOnly, expiry } = req.body;

    const updatedGiftcode = await Giftcode.findByIdAndUpdate(
      req.params.id,
      { creator, amount, users, newUsersOnly, expiry },
      { new: true, runValidators: true }
    );

    if (!updatedGiftcode)
      return res.status(404).json({ success: false, message: "Giftcode not found" });

    res.json({ success: true, giftcode: updatedGiftcode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/giftcodes/:id
 * Delete giftcode by ID
 */
giftRourter.delete("/:id", async (req, res) => {
  try {
    const deletedGiftcode = await Giftcode.findByIdAndDelete(req.params.id);

    if (!deletedGiftcode)
      return res.status(404).json({ success: false, message: "Giftcode not found" });

    res.json({ success: true, message: "Giftcode deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = giftRourter;
