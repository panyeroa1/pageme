// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
  GoogleGenAI,
} from '@google/genai';

async function main() {
  // Check for API key in environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is not set');
    console.error('Please set it using: export GEMINI_API_KEY=your_api_key');
    process.exit(1);
  }

  // Initialize the Google Generative AI client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Configuration for the response
  const config = {
    responseMimeType: 'text/plain',
  };

  // Using the latest Gemini model
  const model = 'gemini-2.5-pro-preview-03-25';

  // Get user input from command line arguments or use a default prompt
  const userInput = process.argv[2] || 'Tell me about generative AI';
  
  // Prepare the content for the API request
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: userInput,
        },
      ],
    },
  ];

  console.log(`Sending request to Gemini API (${model})...`);
  console.log(`Prompt: "${userInput}"\n`);

  try {
    // Generate content stream from the API
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    console.log("Response from Gemini:\n");
    
    // Stream the response chunks
    for await (const chunk of response) {
      process.stdout.write(chunk.text);
    }
    console.log("\n");
  } catch (error) {
    console.error("Error calling Gemini API:", error.message);
    if (error.message.includes("API key")) {
      console.error("Please check your API key is valid and has access to the specified model.");
    }
  }
}

// Execute the main function
main();
