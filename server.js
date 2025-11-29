// Rebuild trigger


require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: "*" }));

// Create uploads folder if missing
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  }
});
const upload = multer({ storage });


// ⭐ NEW — Brevo API Email Sender
app.post("/upload-audio", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const inputPath = req.file.path;         // original .webm file
    const outputPath = inputPath + ".mp3";   // output file

    // Setup ffmpeg
    const ffmpeg = require("fluent-ffmpeg");
    const ffmpegPath = require("ffmpeg-static");
    ffmpeg.setFfmpegPath(ffmpegPath);

    // Convert WEBM → MP3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    // Read converted file as Base64
    const base64File = fs.readFileSync(outputPath).toString("base64");

    // Replace .webm with .mp3 in filename
    const fileName = req.file.originalname.replace(".webm", ".mp3");

    // Email payload for Brevo
    const emailPayload = {
      sender: {
        name: "Voice Message",
        email: process.env.EMAIL_TO   // Use your verified Gmail
      },
      to: [
        { email: process.env.EMAIL_TO }
      ],
      subject: "New Voice Message 🎤💖",
      htmlContent: "<p>You received a new voice message!</p>",
      attachment: [
        {
          name: fileName,
          content: base64File
        }
      ]
    };

    // Send using Brevo Email API
    await axios.post("https://api.brevo.com/v3/smtp/email", emailPayload, {
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      }
    });

    // Cleanup files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return res.json({ success: true, message: "Sent successfully 🎉" });

  } catch (error) {
    console.error("BREVO API ERROR:", error?.response?.data || error);
    return res.status(500).json({
      success: false,
      message: "Email sending failed"
    });
  }
});



// Health check
app.get("/", (req, res) => {
  res.send("Voice message backend (Brevo API) running ✔");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
