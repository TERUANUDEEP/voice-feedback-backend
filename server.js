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
      resource_type: "video",
      folder: "voice_messages",
    });

    const audioUrl = cloudResult.secure_url;
    console.log("Cloudinary upload success:", audioUrl);

    // Delete local file
    fs.unlinkSync(filePath);

    // ------------------ EMAIL PAYLOAD (FIXED) ------------------
    const emailPayload = {
      sender: {
        name: "Voice Message",
        email: "teruanudeep789@gmail.com"
      },
      to: [
        { email: process.env.EMAIL_TO }
      ],
      subject: "New Voice Message 🎤💖",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; font-size:14px; color:#333;">
          <p>Hello 👋,</p>

          <p>You have received a new voice message from your birthday website 🎂💖.</p>

          <p>Please click the link below to listen:</p>

          <p>
            <a href="${audioUrl}" target="_blank">
              ${audioUrl}
            </a>
          </p>

          <p>If the link does not open directly, please copy and paste it into your browser.</p>

          <br/>

          <p>— Voice Message System 🎤</p>
        </div>
      `
    };

    // Send email via Brevo
    const brevoRes = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      emailPayload,
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": process.env.BREVO_API_KEY,
        },
      }
    );

    console.log("Brevo response:", brevoRes.data);

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
