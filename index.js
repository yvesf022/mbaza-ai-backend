import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import translate from "@vitalets/google-translate-api";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// MAIN CHAT ROUTE
app.post("/api/chat", async (req, res) => {
  try {
    let userMessage = req.body.message;

    // STEP 1: Translate Kinyarwanda userMessage to English
    let translatedToEnglish = await translate(userMessage, { to: "en" });
    const englishText = translatedToEnglish.text;

    console.log("USER ORIGINAL:", userMessage);
    console.log("TRANSLATED → ENGLISH:", englishText);

    // STEP 2: Send English text to Groq model
    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a precise and professional medical advisor. ALWAYS respond in English. Never include Kinyarwanda."
        },
        {
          role: "user",
          content: englishText
        }
      ],
      temperature: 0.1 // Very low randomness → prevents hallucination
    });

    const englishResponse = completion.choices[0].message.content;
    console.log("GROQ EN RESPONSE:", englishResponse);

    // STEP 3: Translate Groq English response to Kinyarwanda
    const translatedToKinyarwanda = await translate(englishResponse, {
      to: "rw"
    });

    const finalKinyarwanda = translatedToKinyarwanda.text;
    console.log("AI RW FINAL:", finalKinyarwanda);

    res.json({
      success: true,
      answer: finalKinyarwanda
    });
  } catch (error) {
    console.error("TRANSLATION / LLM ERROR:", error);
    res.json({
      success: false,
      answer:
        "Habaye ikibazo mu gutunganya ibisubizo. Ongera ugerageze nyuma."
    });
  }
});

app.get("/", (req, res) => {
  res.send("Mbaza AI backend running.");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
