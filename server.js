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

// ⭐ Convert WEBM → MP3 + send email
app.post("/upload-audio", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const webmPath = req.file.path;
    const mp3Path = webmPath.replace(".webm", ".mp3");

    // Convert to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(webmPath)
        .toFormat("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(mp3Path);
    });

    // Convert MP3 to Base64
    const base64File = fs.readFileSync(mp3Path).toString("base64");

    const emailPayload = {
      sender: { name: "Voice Message", email: "teruanudeep789@gmail.com" },
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
    fs.unlinkSync(webmPath);
    fs.unlinkSync(mp3Path);

    return res.json({ success: true, message: "Sent successfully 🎉" });

  } catch (error) {
    console.error("BREVO API ERROR:", error?.response?.data || error);
    return res.status(500).json({ success: false, message: "Email sending failed" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Voice message backend (Brevo API) running ✔");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
