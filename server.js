require("dotenv").config();
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8080;

// CORS for your frontend (Netlify)
app.use(cors({ origin: "*" }));

// Create uploads folder if missing
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${safe}`);
  }
});

const upload = multer({ storage });


// ⭐️ Upload + Email route
app.post("/upload-audio", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // ⭐️ Correct Gmail SMTP transporter (WORKS IN RAILWAY)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Voice Message" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: "New Voice Message 🎤💖",
      text: `A new voice message has arrived: ${fileName}`,
      attachments: [
        {
          filename: fileName,
          path: filePath
        }
      ]
    };

    // Send mail
    await transporter.sendMail(mailOptions);

    // Respond immediately
    res.json({ success: true, message: "Sent successfully 🎉" });

    // Async file remove
    fs.unlink(filePath, () => {});
  } catch (err) {
    console.error("EMAIL ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Check server route
app.get("/", (req, res) => {
  res.send("Voice message backend is running ✔");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
