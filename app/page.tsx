// src/app/page.tsx (or your component file path)
"use client"

import { useState, useRef, useEffect } from "react"
import { pagePersonas } from "@/lib/page-personas" // Assuming this path is correct
import { checkApiKey, generateHTML, generateSampleHTML } from "./actions" // Assuming this path is correct

// Define a type for the persona objects if you don't have one
interface PagePersona {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt?: string; // Optional base prompt for the persona
}

export default function Home() {
  const [selectedPersona, setSelectedPersona] = useState<string>("") // Use specific type if possible, e.g., persona ID
  const [userPrompt, setUserPrompt] = useState<string>("")
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("")
  const [generatedHTML, setGeneratedHTML] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(true) // Default true to avoid initial flash
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check API key status on initial mount
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        // Explicitly await the promise
        const result = await checkApiKey();
        setApiKeyConfigured(result.apiKeyConfigured);
        setIsPreviewMode(result.isPreviewMode);

        if (result.isPreviewMode) {
          // Set initial status, don't treat it as an error yet
          setStatus("Running in preview mode. Only sample templates available.");
        } else if (!result.apiKeyConfigured) {
          // Set error state if API key is missing and not in preview mode
          setError("Gemini API key not configured. Please set GEMINI_API_KEY environment variable.");
          setStatus(""); // Clear status if error is shown
        } else {
          // Clear status if everything is configured okay
          setStatus("");
        }
      } catch (err: any) { // Catch potential errors during the check
        console.error("Error checking API configuration:", err);
        // Fallback to preview mode if check fails
        setIsPreviewMode(true);
        setStatus("Could not verify API configuration. Falling back to preview mode.");
        setError(""); // Clear potential previous errors
        setApiKeyConfigured(false); // Assume not configured if check fails
      }
    };

    checkApiKeyStatus();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Group personas by category (Memoize potentially if pagePersonas is large and changes, but likely fine)
  const personasByCategory = pagePersonas.reduce(
    (acc, persona) => {
      const category = persona.category || "Uncategorized"; // Handle potential missing category
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(persona);
      return acc;
    },
    {} as Record<string, PagePersona[]>, // Use the interface type
  );

  // Sort categories
  const categoryOrder = [
    "Core", "Authentication", "E-Commerce", "Finance", "Entertainment",
    "Transportation", "Marketing", "Communication", "Productivity", "Utility",
    "Media", "Social", "System", "Legal", "Content", "Uncategorized" // Add fallback
  ];

  const sortedCategories = Object.keys(personasByCategory).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    // Handle categories not in the predefined order (place them at the end)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // --- Improved HTML Generation Handler ---
  // This function now expects generateHTML action to return { html?, error? }
  const handleGenerateHTML = async () => {
    if (!selectedPersona) {
      setError("Please select a page persona");
      setStatus(""); // Clear status
      return;
    }

    // --- Reset states for new generation ---
    setIsGenerating(true);
    setStatus("Starting generation..."); // Initial status
    setError("");
    setGeneratedHTML("");
    // Clear previous iframe content safely
    if (iframeRef.current) {
      try {
        // Using srcdoc is generally safer and cleaner for setting initial/blank content
        iframeRef.current.srcdoc = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body></body></html>';
      } catch (iframeClearError) {
        console.error("Error clearing iframe:", iframeClearError);
        // Non-critical, proceed with generation
      }
    }

    try {
      // Find the selected persona details (needed for sample generation name)
      const persona = pagePersonas.find((p) => p.id === selectedPersona);
      if (!persona) {
        // This should ideally not happen if state management is correct
        throw new Error("Internal error: Selected persona details could not be found.");
      }

      let htmlToDisplay: string | null = null;
      let finalStatus: string = "";
      let generationError: string | null = null; // To hold potential errors before updating state

      // --- Handle Preview/Sample Mode ---
      if (isPreviewMode || !apiKeyConfigured) {
        setStatus("Generating sample HTML...");
        try {
          htmlToDisplay = await generateSampleHTML(persona.name); // Ensure generateSampleHTML is async
          finalStatus = isPreviewMode
            ? "Generated sample HTML (preview mode)"
            : "Generated sample HTML (API key not configured)";
          if (!htmlToDisplay) {
             // Handle case where sample generation returns empty but no error
             generationError = "Failed to generate sample HTML (empty result)."
          }
        } catch (sampleError: any) {
          console.error("Error generating sample HTML:", sampleError);
          generationError = `Failed to generate sample HTML: ${sampleError.message || 'Unknown error'}`;
        }
      }
      // --- Handle Actual Generation Mode ---
      else {
        setStatus("Calling Gemini API to generate HTML...");
        // The server action `generateHTML` SHOULD handle its own internal errors
        // and always return { html: string | null, error: string | null }
        const result = await generateHTML(selectedPersona, userPrompt, additionalInstructions);

        // Check the result from the server action
        if (result?.error) {
          // Error message came from the server action
          generationError = result.error; // Use the specific error from the action
        } else if (result?.html) {
          // Success case
          htmlToDisplay = result.html;
          finalStatus = "Generation complete";
        } else {
          // No error reported, but no HTML received - action might have failed silently or returned unexpected format
          console.warn("generateHTML action returned unexpected result:", result);
          generationError = "Generation process finished but returned no HTML content or specific error.";
        }
      }

      // --- Update State and Iframe based on outcome ---
      if (generationError) {
         // If any error occurred during sample or actual generation
         setError(generationError);
         setStatus("Generation failed");
         setGeneratedHTML(""); // Ensure no stale HTML is shown
      } else if (htmlToDisplay !== null) {
         // If HTML was successfully generated (sample or actual)
         setGeneratedHTML(htmlToDisplay);
         setStatus(finalStatus);
         setError(""); // Clear any previous errors

         // Update iframe safely
         if (iframeRef.current?.contentWindow) {
            try {
               const doc = iframeRef.current.contentWindow.document;
               doc.open();
               doc.write(htmlToDisplay); // Write the valid HTML
               doc.close();
            } catch (iframeWriteError: any) {
               console.error("Error writing generated content to iframe:", iframeWriteError);
               // HTML was generated, but preview failed. Inform the user.
               setError(`Preview Error: Could not display the generated HTML. ${iframeWriteError.message || ''}. You can still copy the HTML.`);
               setStatus(finalStatus + " (Preview failed)");
               // Keep generatedHTML state so it can be copied
            }
         } else {
            console.warn("Iframe ref or contentWindow not available when trying to update preview.");
            // HTML generated but preview unavailable
             setStatus(finalStatus + " (Preview unavailable)");
             setError(""); // No error in generation itself
         }
      } else {
         // Fallback: Should not happen if logic above is correct
         setError("An unexpected issue occurred: No HTML was generated and no error was reported.");
         setStatus("Generation failed");
      }

    } catch (err: any) { // Catch errors from finding persona OR unhandled exceptions thrown by await generateHTML(...) itself
      console.error("Unhandled error in handleGenerateHTML during action call or persona lookup:", err);
      // Use the error message if available, otherwise a generic fallback
      // This is where "Failed to generate HTML content" likely originates if the server action throws raw exceptions
      setError(err?.message || "An unexpected error occurred during the generation process.");
      setStatus("Generation failed");
      setGeneratedHTML(""); // Clear HTML state on failure
    } finally {
      // Ensure loading state is always turned off
      setIsGenerating(false);
    }
  };


  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-gray-900">Mobile Page Generator</h1>
          <p className="text-sm text-gray-500">Generate mobile-only HTML pages with Gemini API</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Status/Error Banners */}
        {/* Show Preview Mode banner only if relevant and no other specific error is present */}
        {isPreviewMode && !error && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700" role="status">
            <p className="font-medium">Preview Mode Active</p>
            <p>{status || "Only sample HTML templates will be generated."}</p>
            <p className="mt-1 text-sm">Deploy the application with a valid GEMINI_API_KEY to generate live content.</p>
          </div>
        )}

        {/* Show API Key Warning only if relevant */}
        {!isPreviewMode && !apiKeyConfigured && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700" role="alert">
            <p className="font-medium">API Key Not Configured</p>
            <p>{error || "The Gemini API key is not set. Please add the GEMINI_API_KEY environment variable."}</p>
            <p className="mt-1 text-sm">Generation will use sample templates until the key is configured.</p>
          </div>
        )}

        {/* General Error Display (for actual generation errors etc.) */}
        {/* Show general errors only if NOT in preview mode AND the API key IS configured (or error isn't the config one) */}
        {error && (!isPreviewMode || apiKeyConfigured) && error !== "Gemini API key not configured. Please set GEMINI_API_KEY environment variable." && (
           <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700" role="alert">
             <p className="font-medium">Error Occurred</p>
             <p>{error}</p> {/* Display the specific error message state */}
           </div>
         )}


        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar */}
          <div className="md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Page Personas</h2>
              <p className="text-sm text-gray-500">Select a page type</p>
            </div>
            {/* Added explicit height and scroll handling */}
            <div className="overflow-y-auto max-h-[calc(100vh-18rem)] h-[calc(100vh-18rem)]">
              {sortedCategories.map((category) => (
                <div key={category} className="border-b border-gray-200 last:border-b-0">
                  <h3 className="sticky top-0 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 z-10" id={`category-heading-${category}`}>{category}</h3>
                  <ul role="radiogroup" aria-labelledby={`category-heading-${category}`} className="divide-y divide-gray-200">
                     {personasByCategory[category].map((persona) => (
                      <li key={persona.id}>
                        <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                          <input
                            type="radio"
                            name="persona"
                            value={persona.id} // Good practice to include value
                            className="h-4 w-4 mt-1 text-purple-600 border-gray-300 focus:ring-purple-500"
                            checked={selectedPersona === persona.id}
                            onChange={() => {
                              setSelectedPersona(persona.id);
                              setError(""); // Clear error when selection changes
                              setStatus(""); // Clear status when selection changes
                            }}
                            aria-describedby={`persona-desc-${persona.id}`}
                          />
                          <div className="ml-3 text-sm">
                            <span className="font-medium text-gray-900">{persona.name}</span>
                            <p id={`persona-desc-${persona.id}`} className="text-xs text-gray-500">{persona.description}</p>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className="md:col-span-8 lg:col-span-9 space-y-6">
            {/* Input form */}
            <form onSubmit={(e) => { e.preventDefault(); handleGenerateHTML(); }} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Generation Options</h2>
                <p className="text-sm text-gray-500">Customize the generated page</p>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label htmlFor="userPrompt" className="block text-sm font-medium text-gray-700">
                    Specific Request (Optional)
                  </label>
                  <textarea
                    id="userPrompt"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                    placeholder="e.g., 'Create a login page for a music streaming app called SparkleTune'"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Describe the main purpose or key elements you want.</p>
                </div>

                <div>
                  <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">
                    Additional Instructions (Optional)
                  </label>
                  <textarea
                    id="additionalInstructions"
                    rows={2}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                    placeholder="e.g., 'Use a dark theme', 'Include fields for email and password only', 'Add a forgot password link'"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                  />
                   <p className="mt-1 text-xs text-gray-500">Specify styling, content constraints, or specific features.</p>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-y-2">
                   <button
                    type="submit" // Use type="submit" for form
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    disabled={isGenerating || !selectedPersona}
                  >
                    {isGenerating ? (
                      <>
                        {/* Improved Spinner SVG */}
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                        Generating...
                      </>
                    ) : (
                      `Generate ${isPreviewMode || !apiKeyConfigured ? "Sample" : ""} HTML`
                    )}
                  </button>
                  {/* Display current status during/after generation */}
                  {status && !error && ( // Show status only if there's no overriding error
                    <div className="ml-4 p-2 bg-blue-50 rounded-md text-sm text-blue-700 flex-shrink-0" role="status">
                      {status}
                    </div>
                  )}
                </div>
              </div>
            </form> {/* End Form */}

            {/* Preview area */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Preview</h2>
                  <p className="text-sm text-gray-500">Mobile viewport simulation</p>
                </div>
                {/* Enable copy button only if HTML exists and generation wasn't a failure */}
                {generatedHTML && (!error || error.startsWith("Preview Error:")) && ( // Allow copy even if preview fails
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedHTML)
                        .then(() => alert("HTML copied to clipboard!"))
                        .catch(err => {
                          console.error("Failed to copy HTML:", err);
                          alert("Failed to copy HTML. See console for details.");
                        });
                    }}
                  >
                    Copy HTML
                  </button>
                )}
              </div>

              {/* Using bg-gray-200 for better contrast */}
              <div className="p-4 flex justify-center bg-gray-200 min-h-[500px]">
                 {/* Mobile device frame */}
                <div className="w-[375px] h-[667px] bg-white rounded-[2.5rem] shadow-xl overflow-hidden border-[10px] border-gray-800 ring-1 ring-gray-900/5 relative">
                  {/* Notch simulation */}
                   <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-36 h-5 bg-gray-800 rounded-b-lg z-20"></div>
                  <iframe
                    ref={iframeRef}
                    className="w-full h-full border-0" // Remove default iframe border
                    title="Generated HTML Preview"
                    // Security sandbox - adjust as needed, allow-scripts is often necessary for previews
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    // Use srcDoc for initial blank state
                    srcDoc={'<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="display: flex; justify-content: center; align-items: center; height: 100%; color: #9ca3af; font-family: sans-serif; text-align: center; padding: 20px;"><div>Select a persona and click Generate to see a preview here.</div></body></html>'}
                  ></iframe>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
