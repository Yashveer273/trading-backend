const express = require("express");
const QR = require("../models/QRs");
const Payment = require("../models/payment");

const multer = require("multer");
const QRPayRourter = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    const filename = `${Date.now()}-${base}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });



// --- API 1: Upload QR Image ---
QRPayRourter.post("/api/upload", upload.single("qr"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'qr')" });
    const qr = await QR.create({ filename: req.file.filename });
    return res.json({ success: true, qr, url: `${req.protocol}://${req.get("host")}/QRuploads/${req.file.filename}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 2: Get Random QR (latest 3) ---
QRPayRourter.get("/api/qr/random", async (req, res) => {
  try {
    const qrs = await QR.find().sort({ createdAt: -1 }).limit(3);
    if (!qrs || qrs.length === 0) return res.status(404).json({ error: "No QRs available" });
    const choice = qrs[Math.floor(Math.random() * qrs.length)];
    return res.json({ filename: choice.filename, url: `${req.protocol}://${req.get("host")}/QRuploads/${choice.filename}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 3: Create Payment ---
QRPayRourter.post("/api/payments", async (req, res) => {
  try {
    const { userId, amount, utr, qrImageName } = req.body;
    if (!userId || !amount || !utr || !qrImageName) return res.status(400).json({ error: "Missing fields" });
    const payment = await Payment.create({ userId, amount, utr, qrImageName, approved: false });
    return res.json({ success: true, payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 4: Get Pending Payments (Admin) ---
QRPayRourter.get("/api/admin/pending", async (req, res) => {
  try {
    const pending = await Payment.find({ approved: false }).sort({ createdAt: -1 });
    const withUrl = pending.map((p) => ({
      _id: p._id,
      userId: p.userId,
      amount: p.amount,
      utr: p.utr,
      qrImageName: p.qrImageName,
      qrUrl: `${req.protocol}://${req.get("host")}/QRuploads/${p.qrImageName}`,
      approved: p.approved,
      remarks: p.remarks,
      createdAt: p.createdAt,
    }));
    return res.json(withUrl);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 5: Update Payment Status (Admin) ---
QRPayRourter.patch("/api/admin/payments/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { approved, remarks } = req.body;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (typeof approved === "boolean") payment.approved = approved;
    if (remarks) payment.remarks = remarks;
    await payment.save();
    return res.json({ success: true, payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- Extra API: List All QRs ---
QRPayRourter.get("/api/qrs", async (req, res) => {
  try {
    const qrs = await QR.find().sort({ createdAt: -1 });
    const result = qrs.map((qr) => ({
      _id: qr._id,
      filename: qr.filename,
      url: `${req.protocol}://${req.get("host")}/QRuploads/${qr.filename}`,
      createdAt: qr.createdAt,
    }));
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

QRPayRourter.get("/test", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<title>QR & Payment API Tester</title>
</head>
<body>
<h1>QR & Payment API Tester</h1>

<h2>Upload QR</h2>
<form id="uploadForm" enctype="multipart/form-data">
<input type="file" name="qr" />
<button type="submit">Upload</button>
</form>
<pre id="uploadResult"></pre>

<h2>Get Random QR</h2>
<button onclick="getRandomQR()">Fetch Random QR</button>
<pre id="randomQR"></pre>

<h2>Create Payment</h2>
<form id="paymentForm">
<input type="text" name="userId" placeholder="User ID" required />
<input type="number" name="amount" placeholder="Amount" required />
<input type="text" name="utr" placeholder="UTR" required />
<input type="text" name="qrImageName" placeholder="QR Image Filename" required />
<button type="submit">Create Payment</button>
</form>
<pre id="paymentResult"></pre>

<h2>Admin: Pending Payments</h2>
<button onclick="getPending()">Fetch Pending</button>
<div id="pending"></div>

<script>
// Upload QR
uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch('/QR/api/upload', { method: 'POST', body: formData });
  document.getElementById('uploadResult').textContent = JSON.stringify(await res.json(), null, 2);
};

// Random QR
function getRandomQR() {
  fetch('/QR/api/qr/random').then(r => r.json()).then(data => document.getElementById('randomQR').textContent = JSON.stringify(data, null, 2));
}

// Create Payment
paymentForm.onsubmit = async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.amount = Number(payload.amount);
  const res = await fetch('/QR/api/payments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  document.getElementById('paymentResult').textContent = JSON.stringify(await res.json(), null, 2);
};

// Fetch Pending Payments
async function getPending() {
  const res = await fetch('/QR/api/admin/pending');
  const data = await res.json();
  const container = document.getElementById('pending');
  container.innerHTML='';
  data.forEach(p=>{
    const div = document.createElement('div');
    div.innerHTML = \`<p><b>User:</b> \${p.userId}, <b>Amount:</b> \${p.amount}, <b>UTR:</b> \${p.utr}</p>
    <img src='\${p.qrUrl}' width='150'/><br>
    <button onclick="updateStatus('\${p._id}', true)">Approve</button>
    <button onclick="updateStatus('\${p._id}', false)">Reject</button><hr>\`;
    container.appendChild(div);
  });
}

// Approve/Reject Payment
async function updateStatus(id, status){
  const res = await fetch('/QR/api/admin/payments/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({approved:status})});
  alert('Updated: '+JSON.stringify(await res.json()));
  getPending();
}
</script>
</body>
</html>`);
});

module.exports = QRPayRourter;
