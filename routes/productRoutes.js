const express = require("express");
const Product = require("../models/Product");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const fs = require("fs");

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // save files to the uploads folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // unique filename
  },
});

const upload = multer({ storage });



// ---------------- CREATE product ----------------
router.post("/add", upload.single("image"), async (req, res) => {
  console.log(req.body);
 
  try {
    const { categoryName, productName, price, cycleType, cycleValue, daily, hour, badge } = req.body;

    let imageUrl = "";
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`; // save relative path
    }

    const newProduct = new Product({
      categoryName,
      productName,
      price,
      cycleType,
      cycleValue,
      daily: Number(daily) || 0,
      hour: Number(hour) || 0,
      imageUrl,
      badge,
    });

    await newProduct.save();
    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
     console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- GET all products ----------------
router.get("/", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 0;
    const products = await Product.find({}).limit(limit);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- GET product by ID ----------------
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- UPDATE product ----------------
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { categoryName, productName, price, cycleType, cycleValue, daily, hour, badge } = req.body;

    let updateData = {
      categoryName,
      productName,
      price,
      cycleType,
      cycleValue,
      daily: Number(daily) || 0,
      hour: Number(hour) || 0,
      badge,
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, product: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- DELETE product ----------------
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
