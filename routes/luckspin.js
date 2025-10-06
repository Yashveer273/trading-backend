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
 * GET single item 
 */
// luckySpinRouter.js
luckySpinRouter.get("/spinItem", async (req, res) => {
  try {
    const allItems = await Item.find().sort({ priority: 1, createdAt: -1 });
    if (!allItems.length) return res.status(404).json({ error: "No items found" });

    const topCount = Math.min(7, allItems.length); // top 7 high-priority items
    const highPriorityItems = allItems.slice(0, topCount);
    const remainingItems = allItems.slice(topCount); // rest

    // Weighted random: 70% chance pick from highPriority, 30% chance pick from remaining
    const rand = Math.random();

    let selectedItem;
    if (rand < 0.7 || remainingItems.length === 0) {
      // pick from high priority
      selectedItem = highPriorityItems[Math.floor(Math.random() * highPriorityItems.length)];
    } else {
      // pick from remaining items
      selectedItem = remainingItems[Math.floor(Math.random() * remainingItems.length)];
    }

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
