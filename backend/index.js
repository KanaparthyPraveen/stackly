
require("dotenv").config();

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: "Explain system design in simple terms."
        }
      ]
    });

    console.log("\nClaude says:\n");
    console.log(
      response.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n")
    );

  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
