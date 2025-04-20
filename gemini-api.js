// To run this code you need to install the following dependencies:
// npm install @google/genai
// You might optionally want type definitions for development:
// npm install -D @types/node

import {
  GoogleGenerativeAI,
  GenerateContentStreamResult // Optional: for better typing if using TypeScript
} from '@google/genai';

async function main() {
  // --- Re-added: Check for API key ---
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is not set.');
    console.error('Please set it, e.g.: export GEMINI_API_KEY="your_api_key"');
    process.exit(1);
  }

  // --- Corrected: Initialize the Google Generative AI client ---
  // Class name is GoogleGenerativeAI, not GoogleGenAI
  // Constructor takes the API key directly
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // --- Re-added: Get user input ---
  // Get user input from command line arguments or use a default prompt
  // This replaces the "INSERT_INPUT_HERE" placeholder
  const userInput = process.argv[2] || 'Tell me about generative AI in simple terms.';
  
  // --- Corrected: Configuration ---
  // Configuration for the generation process
  // Renamed 'config' to 'generationConfig' for clarity (though original name might work)
  const generationConfig = {
    responseMimeType: 'text/plain',
    // Add other generation options here if needed (e.g., temperature)
    // temperature: 0.7,
  };

  // --- Corrected: Model Access ---
  // Define the model name
  // Note: Ensure your API key has access to this specific preview model.
  // Consider using 'gemini-1.5-flash-latest' for broader access.
  const modelName = 'gemini-2.5-flash-preview-04-17';

  // Get the generative model instance with the specified configuration
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig, // Pass generationConfig here
  });

  // Prepare the content for the API request (structure is correct)
  const contents = [
    {
      role: 'user',
      parts: [
        {
          // --- Corrected: Use dynamic input instead of placeholder ---
          text: userInput,
        },
      ],
    },
  ];

  console.log(`Sending request to Gemini API (${modelName})...`);
  console.log(`Prompt: "${userInput}"\n`);

  // --- Re-added: Error Handling ---
  try {
    // --- Corrected: API Call ---
    // Generate content stream directly from the model instance
    const result: GenerateContentStreamResult = await model.generateContentStream({ contents });

    console.log("Response from Gemini:\n");

    // --- Corrected: Streaming Loop ---
    // Stream the response chunks and access text with chunk.text()
    for await (const chunk of result.stream) {
        // Check if chunk and text() exist before processing
        if (chunk && typeof chunk.text === 'function') {
            process.stdout.write(chunk.text()); // Use chunk.text()
        }
    }
    console.log("\n"); // Add a final newline

  } catch (error: any) { // Using 'any' for broader error catching in JS
    console.error("\nError calling Gemini API:", error.message);
    // Add more detailed error logging if needed, similar to the previous fix
    if (error.message?.includes("API key") || error.message?.includes("permission")) {
      console.error("Please check your API key is valid, enabled, and has access to the specified model ('"+ modelName +"').");
      console.error("Ensure billing is enabled if required by the model/API.");
    }
     if (error.message?.includes("429")) {
       console.error("Rate limit exceeded. Please wait and try again later.");
     }
  }
}

// Execute the main function
// --- Re-added: Catch potential unhandled promise rejections ---
main().catch(console.error);