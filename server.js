require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: "*" }));

// ------------------ CLOUDINARY CONFIG ------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------ MULTER FILE STORAGE ------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  }
});
const upload = multer({ storage });


// ------------------ MAIN AUDIO UPLOAD ROUTE ------------------
app.post("/upload-audio", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;

    console.log("Uploading to Cloudinary...");

    // Upload audio to Cloudinary
    const cloudResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "video", // IMPORTANT for audio formats like webm/mp3
      folder: "voice_messages",
    });

    // Cloudinary gives us URL
    const audioUrl = cloudResult.secure_url;

    console.log("Cloudinary upload success:", audioUrl);

    // Delete local file
    fs.unlinkSync(filePath);

    // Prepare email payload for Brevo
    const emailPayload = {
      sender: { name: "Voice Message", email: "teruanudeep789@gmail.com" },
      to: [{ email: process.env.EMAIL_TO }],
      subject: "New Voice Message 🎤💖",
      htmlContent: `
        <p>You received a new voice message 🎤💖</p>
        <p><a href="${audioUrl}" target="_blank">Click here to listen</a></p>
      `
    };

    // Send email via Brevo
    await axios.post("https://api.brevo.com/v3/smtp/email", emailPayload, {
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      }
    });

    return res.json({ success: true, message: "Sent successfully 🎉" });

  } catch (error) {
    console.error("ERROR:", error?.response?.data || error);
    return res.status(500).json({ success: false, message: "Email sending failed" });
  }
});


// ------------------ HEALTH CHECK ------------------
app.get("/", (req, res) => {
  res.send("Voice message backend running ✔");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
