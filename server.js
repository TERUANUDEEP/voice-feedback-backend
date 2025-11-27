// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = `${timestamp}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

// Upload endpoint
app.post('/upload-audio', upload.single('voice'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Nodemailer setup
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Voice Message" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: 'New Voice Message 🎤💖',
      text: `A new voice message has arrived: ${originalName}`,
      attachments: [{ filename: originalName, path: filePath }]
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // ⭐ SEND JSON RESPONSE *IMMEDIATELY*
    res.status(200).json({ success: true, message: "Sent successfully 🎉" });

    // Delete file AFTER sending response (non-blocking)
    fs.unlink(filePath, (err) => {
      if (err) console.error("Delete error:", err);
    });

  } catch (err) {
    console.error("Error in /upload-audio:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Check server
app.get('/', (req, res) => {
  res.send("Voice message server running ✔️");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
