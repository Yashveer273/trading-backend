const express = require("express");
const SocialLinks = require( "../models/socialmedia.js");

const SocialMediaRourter = express.Router();

// ✅ CREATE (POST)
SocialMediaRourter.post("/", async (req, res) => {
  try {
    const { telegramUsernameLink, telegramGroupLink } = req.body;

    if (!telegramUsernameLink || !telegramGroupLink) {
      return res.status(400).json({
        success: false,
        message: "Both links are required",
      });
    }

    // 🧠 Check if a record already exists
    const existing = await SocialLinks.findOne();

    if (existing) {
      // ✅ If exists → update it
      existing.telegramUsernameLink = telegramUsernameLink;
      existing.telegramGroupLink = telegramGroupLink;
      await existing.save();

      return res.json({
        success: true,
        message: "Links updated successfully",
        data: existing,
      });
    } else {
      // ✅ If not exists → create new
      const newLinks = new SocialLinks({
        telegramUsernameLink,
        telegramGroupLink,
      });
      await newLinks.save();

      return res.json({
        success: true,
        message: "Links created successfully",
        data: newLinks,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ✅ GET ALL LINKS
SocialMediaRourter.get("/", async (req, res) => {
  try {
    const links = await SocialLinks.find();
    res.json({ success: true, data: links });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ GET SINGLE LINK BY ID
SocialMediaRourter.get("/:id", async (req, res) => {
  try {
    const link = await SocialLinks.findById(req.params.id);
    if (!link) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: link });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ UPDATE (PUT)
SocialMediaRourter.put("/:id", async (req, res) => {
  try {
    const { telegramUsernameLink, telegramGroupLink } = req.body;
    const updated = await SocialLinks.findByIdAndUpdate(
      req.params.id,
      { telegramUsernameLink, telegramGroupLink },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Links updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ DELETE (optional)
SocialMediaRourter.delete("/:id", async (req, res) => {
  try {
    const deleted = await SocialLinks.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = SocialMediaRourter;
