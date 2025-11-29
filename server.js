require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: "*" }));

// uploads folder
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}-${safe}`);
  }
});
const upload = multer({ storage });

// ⭐ MAIN ROUTE — convert WEBM → MP3 → send
app.post("/upload-audio", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file" });

    const inputPath = req.file.path;
    const mp3Path = inputPath.replace(".webm", ".mp3");

    // Convert to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("libmp3lame")
        .toFormat("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(mp3Path);
    });

    // Read MP3 as base64
    const base64File = fs.readFileSync(mp3Path).toString("base64");

    const emailPayload = {
      sender: { name: "Voice Message", email: "no-reply@yourdomain.com" },
      to: [{ email: process.env.EMAIL_TO }],
      subject: "New Voice Message 🎤💖",
      htmlContent: "<p>You received a new voice message!</p>",
      attachments: [
        {
          name: "voice-message.mp3",
          content: base64File,
          type: "audio/mp3"
        }
      ]
    };

    await axios.post("https://api.brevo.com/v3/smtp/email", emailPayload, {
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      }
    });

    // cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(mp3Path);

    res.json({ success: true, message: "Sent successfully 🎉" });

  } catch (err) {
    console.error("EMAIL ERROR:", err?.response?.data || err);
    res.status(500).json({ success: false, message: "Sending failed" });
  }
});

// health check
app.get("/", (req, res) => res.send("Backend running ✔"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
