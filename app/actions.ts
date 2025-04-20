"use server"

import { pagePersonas } from "@/lib/page-personas"

// Check if we're running in a browser environment
const isBrowser = typeof window !== "undefined"

// Check if API key is configured
export async function checkApiKey() {
  return {
    apiKeyConfigured: !isBrowser && !!process.env.GEMINI_API_KEY,
    isPreviewMode: isBrowser,
  }
}

// Generate HTML content
export async function generateHTML(personaId: string, userPrompt = "", additionalInstructions = "") {
  try {
    // If we're in a browser environment, return a mock response
    if (isBrowser) {
      return {
        error: "Cannot generate content in preview mode. Deploy the application to use the Gemini API.",
      }
    }

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      return {
        error: "Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable.",
      }
    }

    if (!personaId) {
      return { error: "No persona ID provided" }
    }

    // Find the persona
    const persona = pagePersonas.find((p) => p.id === personaId)
    if (!persona) {
      return { error: "Invalid persona ID" }
    }

    // In a real server environment, import and use the GoogleGenAI client
    // We use dynamic import to ensure this only runs on the server
    try {
      // Dynamic import to avoid bundling with client code
      const { GoogleGenAI } = await import("@google/genai")

      // Safety settings
      const safetySettings = [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ]

      // Get model parameters or use defaults
      const modelName = "gemini-1.5-flash" // Use a simpler model for better reliability
      const temperature = 0.4 // Lower temperature for HTML

      // Combine the system prompt with user prompt and additional instructions
      const combinedPrompt = `
${persona.systemPrompt}

${userPrompt ? `User's specific request: ${userPrompt}` : ""}

${additionalInstructions ? `Additional instructions: ${additionalInstructions}` : ""}

IMPORTANT GLOBAL REQUIREMENTS FOR ALL PAGES:
- The page MUST be designed for mobile devices ONLY
- The page should NOT be responsive for desktop or tablet
- Include viewport meta tag with user-scalable=no to prevent zooming
- Allow vertical scrolling only
- Use embedded CSS only (no external files)
- Return ONLY the complete, valid HTML code, nothing else
`

      // Initialize Google Generative AI client
      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY)

      // Initialize the model
      const model = genAI.models.getModel(modelName)

      // Generate content (non-streaming)
      const generationConfig = {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }

      // Prepare content for the API request
      const contents = [
        {
          role: "user",
          parts: [{ text: combinedPrompt }],
        },
      ]

      // Generate content
      const result = await model.generateContent({
        contents,
        generationConfig,
        safetySettings,
      })

      const response = result.response
      const text = response.text()

      return { html: text }
    } catch (error: any) {
      console.error("Error generating content:", error)
      return {
        error: "Failed to generate HTML content",
        details: error.message || "Unknown error",
      }
    }
  } catch (error: any) {
    console.error("Error in generateHTML:", error)
    return {
      error: "Failed to generate HTML",
      details: error.message || "Unknown error",
    }
  }
}

// Generate a sample HTML for preview mode or when API key is not available
export async function generateSampleHTML(personaName: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${personaName} - Sample</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      padding: 20px;
      max-width: 100%;
    }
    .header {
      background-color: #6200ee;
      color: white;
      padding: 16px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .content {
      padding: 20px;
      background-color: white;
      border-radius: 8px;
      margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .sample-text {
      color: #666;
      line-height: 1.5;
    }
    .api-notice {
      margin-top: 20px;
      padding: 15px;
      background-color: #ffe8e8;
      border-left: 4px solid #ff5252;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${personaName}</h1>
  </div>
  <div class="container">
    <div class="content">
      <h2>Sample Preview</h2>
      <p class="sample-text">
        This is a sample preview of the ${personaName} template. 
        When the Gemini API is properly configured, this will be replaced with 
        generated content based on the selected persona.
      </p>
      <div class="api-notice">
        <p><strong>Preview Mode</strong></p>
        <p>You are currently in preview mode. Deploy the application to use the Gemini API.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}
