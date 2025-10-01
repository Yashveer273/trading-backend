const express = require("express");
const multer = require("multer");
const path = require("path");
const Item = require("../models/luckySpin");

const luckySpinRouter = express.Router();

// Media folder setup
const mediaDir = path.join(__dirname, "..", "media");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * CREATE Item (max 8 items)
 */
luckySpinRouter.post("/item-save", upload.single("image"), async (req, res) => {
  try {
    const { itemName, priority, reward } = req.body;

    // Check max limit
    const count = await Item.countDocuments();
    if (count >= 8) {
      return res.status(400).json({ error: "Maximum of 8 items allowed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const imageUrl = `/media/${req.file.filename}`;

    const newItem = new Item({ itemName, priority, reward, imageUrl });
    await newItem.save();

    res.status(201).json({ message: "Item created successfully", item: newItem });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

/**
 * GET all items
 */
luckySpinRouter.get("/items", async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

/**
 * GET single item by id
 */
luckySpinRouter.get("/item", async (req, res) => {
  try {
    // Get top 8 items by priority (ascending = higher priority first)
    const topItems = await Item.find().sort({ priority: 1, createdAt: -1 }).limit(8);

    if (topItems.length === 0) {
      return res.status(404).json({ error: "No items found" });
    }

    // Pick a random item from the top 8
    const randomIndex = Math.floor(Math.random() * topItems.length);
    const selectedItem = topItems[randomIndex];

    res.status(200).json(selectedItem);
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

/**
 * UPDATE item by id
 * If new image uploaded, replace old image URL
 */
luckySpinRouter.put("/item/:id", upload.single("image"), async (req, res) => {
  try {
    const { itemName, priority, reward } = req.body;
    const updateData = { itemName, priority, reward };

    if (req.file) {
      updateData.imageUrl = `/media/${req.file.filename}`;
    }

    const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedItem) return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Item updated successfully", item: updatedItem });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

/**
 * DELETE item by id
 */
luckySpinRouter.delete("/item/:id", async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Item deleted successfully", item: deletedItem });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = luckySpinRouter;
