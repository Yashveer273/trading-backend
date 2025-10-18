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

 
  try {
    const { categoryName, productName, price, cycleType, cycleValue, daily, hour,purchaseType, badge,productExplanation } = req.body;
    var pExplanation=[];
    
if (typeof productExplanation === 'string') {
        pExplanation = JSON.parse(productExplanation);
    }

    // --- Your original validation starts here ---
    if (!Array.isArray(pExplanation)) {
        console.log(productExplanation); // This will log the stringified value if parsing failed/was skipped
        return res.status(500).json({ 
            success: false, 
            message: "Invalid data: productExplanation must be an array." 
        });
    }
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
       productExplanation:pExplanation,
      daily: Number(daily) || 0,
      hour: Number(hour) || 0,
      imageUrl,
      purchaseType,
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

    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- GET product by ID ----------------
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------- UPDATE product ----------------
router.put("/:id", upload.single("image"), async (req, res) => {
    // Destructure all fields from req.body (or where they are expected)
    const { 
        categoryName, 
        productName, 
        price, 
        cycleType, 
        cycleValue, 
        productExplanation: rawProductExplanation, // Rename to raw
        daily, 
        hour, 
        purchaseType, 
        badge 
    } = req.body;
    
    // 1. Initialize a variable for the parsed array
    let finalProductExplanation = [];

    // 2. Implement Parsing and Validation
    try {
        if (typeof rawProductExplanation === 'string') {
            finalProductExplanation = JSON.parse(rawProductExplanation);
        } else if (Array.isArray(rawProductExplanation)) {
             // Case where it was sent as a raw JSON array (good practice)
            finalProductExplanation = rawProductExplanation;
        }

        // --- Validation Check ---
        if (!Array.isArray(finalProductExplanation)) {
            // If it's not an array after parsing/checking
            console.log("Raw productExplanation:", rawProductExplanation); 
            return res.status(500).json({ 
                success: false, 
                message: "Invalid data: productExplanation must be an array." 
            });
        }
        
    } catch (e) {
        // Handle JSON parsing error
        console.error("Failed to parse productExplanation:", e);
        return res.status(400).json({ 
            success: false, 
            message: "Invalid JSON format for productExplanation." 
        });
    }

    // 3. Construct updateData using the validated/parsed array
    try {
        let updateData = {
            categoryName,
            productName,
            price,
            cycleType,
            cycleValue,
            productExplanation: finalProductExplanation, // Use the parsed/validated array
            daily: Number(daily) || 0,
            hour: Number(hour) || 0,
            purchaseType,
            badge,
            // REMOVED the duplicate 'productExplanation' field
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
        // Handle Mongoose/Database errors
        res.status(500).json({ success: false, message: error.message });
    }
});

// ---------------- DELETE product ----------------
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
