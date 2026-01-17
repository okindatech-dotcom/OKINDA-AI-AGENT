import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `
You are an AI assistant that behaves like ChatGPT and Gemini.

Rules:
1. If a question has multiple possible answers, respond with ONLY the correct answer, no explanation.
2. If a question requires explanation, respond in detailed paragraphs with relevant examples.
3. If the user provides an image or file, analyze it and describe its contents.
4. If the image or file contains a question, answer it accordingly.
5. Be accurate, concise when required, and detailed when necessary.
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI processing error." });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    if (mimeType.startsWith("image/")) {
      const base64Image = fs.readFileSync(filePath, "base64");

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` }
              }
            ]
          }
        ]
      });

      res.json({ reply: completion.choices[0].message.content });
    } else {
      const fileContent = fs.readFileSync(filePath, "utf8");

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this file:\n\n${fileContent}` }
        ]
      });

      res.json({ reply: completion.choices[0].message.content });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File processing error." });
  } finally {
    fs.unlinkSync(filePath);
  }
});

app.listen(3000, () => {
  console.log("🚀 AI Agent running at http://localhost:3000");
});
