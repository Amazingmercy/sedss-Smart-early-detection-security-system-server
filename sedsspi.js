const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

const app = express();

// ---------------- CONFIG ----------------
const UPLOAD_DIR = path.join(__dirname, "uploads");
const ALERT_LOG = path.join(__dirname, "alerts.json");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GENAI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

// Ensure dirs exist
fs.ensureDirSync(UPLOAD_DIR);
if (!fs.existsSync(ALERT_LOG)) fs.writeFileSync(ALERT_LOG, "[]");

// multer upload config
const upload = multer({ dest: "temp/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


async function callGenAI(base64img) {
    const payload = {
        contents: [
            {
                parts: [
                    {
                        text:
                            `You are a strict security vision classifier.

Analyze this security camera image and determine ONLY if it represents a dangerous situation.

You MUST classify the image based on the presence of:
- A human intruder
- A large animal that could cause harm (e.g., cow, goat, dog over 25kg)
- Any unauthorized vehicle (car, bike, tricycle) inside a restricted area
- Any suspicious human behavior suggesting break-in or trespassing

Ignore:
- Shadows
- Insects
- Small harmless animals (cats, chickens, small dogs)
- Sky, trees, rain, reflections
Ignore:
- Shadows
- Insects
- Small harmless animals (cats, chickens, small dogs)
- Sky, trees, rain, reflections 

Return ONLY:
DANGER1  → if ANY threat is detected  
DANGER0  → if the scene is safe  

No explanations. No extra text. Only output the exact keyword.`
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64img
                        }
                    }
                ]
            }
        ]
    };

    const res = await axios.post(GENAI_URL, payload, {
        headers: { "Content-Type": "application/json" }
    });

    return res.data;
}


let lastScan = {
    status: "SAFE",
    image: null,
    timestamp: 0
};

// ---------------- MAIN ROUTE ----------------
app.post("/upload", upload.single("photo"), async (req, res) => {
    if (!req.file) return res.sendStatus(400);

    const imgData = fs.readFileSync(req.file.path);
    const base64 = imgData.toString("base64");
    const response = await callGenAI(base64);
    const aiResult = response.candidates[0].content.parts[0].text.trim();
    
    // Save image if Danger
    let publicPath = null;
    if (aiResult.includes("DANGER1")) {
        const filename = `alert_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), imgData);
        publicPath = `uploads/${filename}`;
        console.log("🚨 DANGER DETECTED!");
    } else {
        console.log("✅ Area Safe");
    }

    // UPDATE ROBOT MEMORY
    lastScan = {
        status: aiResult.includes("DANGER1") ? "DANGER" : "SAFE",
        image: publicPath,
        timestamp: Date.now()
    };

    res.send("Received");
});

app.get("/status", (req, res) => {
    // If the last alert was more than 10 seconds ago, assume it's safe now
    if (Date.now() - lastScan.timestamp > 60000) {
        lastScan.status = "SAFE";
    }
    res.json(lastScan);
});


// Static serving of uploaded images
app.use("/uploads", express.static(UPLOAD_DIR));

// ---------------- START SERVER ----------------
app.listen(3000, () => console.log("Server running on port 3000"));
