"use client"

import { useState, useRef, useEffect } from "react"
import { pagePersonas } from "@/lib/page-personas"
import { checkApiKey, generateHTML, generateSampleHTML } from "./actions"

export default function Home() {
  const [selectedPersona, setSelectedPersona] = useState("")
  const [userPrompt, setUserPrompt] = useState("")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [generatedHTML, setGeneratedHTML] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [apiKeyConfigured, setApiKeyConfigured] = useState(true) // Default to true to avoid showing error initially
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Check if Gemini API key is configured
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const result = await checkApiKey()
        setApiKeyConfigured(result.apiKeyConfigured)
        setIsPreviewMode(result.isPreviewMode)

        if (result.isPreviewMode) {
          setStatus("Running in preview mode. Deploy the application to use the Gemini API.")
        } else if (!result.apiKeyConfigured) {
          setError("Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable.")
        }
      } catch (error) {
        console.error("Error checking API configuration:", error)
        setIsPreviewMode(true) // Assume preview mode if check fails
      }
    }

    checkApiKeyStatus()
  }, [])

  // Group personas by category
  const personasByCategory = pagePersonas.reduce(
    (acc, persona) => {
      if (!acc[persona.category]) {
        acc[persona.category] = []
      }
      acc[persona.category].push(persona)
      return acc
    },
    {} as Record<string, typeof pagePersonas>,
  )

  // Sort categories in a logical flow
  const categoryOrder = [
    "Core",
    "Authentication",
    "E-Commerce",
    "Finance",
    "Entertainment",
    "Transportation",
    "Marketing",
    "Communication",
    "Productivity",
    "Utility",
    "Media",
    "Social",
    "System",
    "Legal",
    "Content",
  ]

  const sortedCategories = Object.keys(personasByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b),
  )

  // Handle HTML generation
  const handleGenerateHTML = async () => {
    if (!selectedPersona) {
      setError("Please select a page persona")
      return
    }

    setIsGenerating(true)
    setStatus("Generating HTML...")
    setError("")
    setGeneratedHTML("")

    try {
      // Find the selected persona
      const persona = pagePersonas.find((p) => p.id === selectedPersona)

      if (!persona) {
        throw new Error("Selected persona not found")
      }

      // If in preview mode or API key is not configured, show a sample HTML
      if (isPreviewMode || !apiKeyConfigured) {
        const sampleHTML = await generateSampleHTML(persona.name)
        setGeneratedHTML(sampleHTML)
        setStatus(
          isPreviewMode ? "Generated sample HTML (preview mode)" : "Generated sample HTML (API key not configured)",
        )

        // Update iframe with sample HTML
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.document.open()
          iframeRef.current.contentWindow.document.write(sampleHTML)
          iframeRef.current.contentWindow.document.close()
        }

        setIsGenerating(false)
        return
      }

      // Generate HTML using server action
      const result = await generateHTML(selectedPersona, userPrompt, additionalInstructions)

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.html) {
        setGeneratedHTML(result.html)
        setStatus("Generation complete")

        // Update iframe with generated HTML
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.document.open()
          iframeRef.current.contentWindow.document.write(result.html)
          iframeRef.current.contentWindow.document.close()
        }
      } else {
        throw new Error("No HTML content received")
      }
    } catch (error) {
      console.error("Error in HTML generation:", error)
      setError(error instanceof Error ? error.message : "Failed to generate HTML")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-gray-900">Mobile Page Generator</h1>
          <p className="text-sm text-gray-500">Generate mobile-only HTML pages with Gemini API</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {isPreviewMode && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700">
            <p className="font-medium">Preview Mode</p>
            <p>You are currently in preview mode. Only sample HTML templates will be generated.</p>
            <p className="mt-2 text-sm">Deploy the application to use the Gemini API for generating actual content.</p>
          </div>
        )}

        {!isPreviewMode && !apiKeyConfigured && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
            <p className="font-medium">API Key Not Configured</p>
            <p>The Gemini API key is not set. Please add the GEMINI_API_KEY environment variable to your project.</p>
            <p className="mt-2 text-sm">You can still preview sample HTML templates.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar with page personas */}
          <div className="md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Page Personas</h2>
              <p className="text-sm text-gray-500">Select a page type to generate</p>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-20rem)]">
              {sortedCategories.map((category) => (
                <div key={category} className="border-b border-gray-200 last:border-b-0">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">{category}</div>
                  <ul className="divide-y divide-gray-200">
                    {personasByCategory[category].map((persona) => (
                      <li key={persona.id}>
                        <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name="persona"
                            className="h-4 w-4 mt-1 text-purple-600 border-gray-300 rounded"
                            checked={selectedPersona === persona.id}
                            onChange={() => setSelectedPersona(persona.id)}
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{persona.name}</p>
                            <p className="text-xs text-gray-500">{persona.description}</p>
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Generation Options</h2>
                <p className="text-sm text-gray-500">Customize your page generation</p>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label htmlFor="userPrompt" className="block text-sm font-medium text-gray-700">
                    Your Request (Optional)
                  </label>
                  <textarea
                    id="userPrompt"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Describe what you want in this page..."
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="additionalInstructions" className="block text-sm font-medium text-gray-700">
                    Additional Instructions (Optional)
                  </label>
                  <textarea
                    id="additionalInstructions"
                    rows={2}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Any specific styling, content, or behavior requirements..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleGenerateHTML}
                    disabled={isGenerating || !selectedPersona}
                  >
                    {isGenerating ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      `Generate ${isPreviewMode || !apiKeyConfigured ? "Sample" : ""} HTML`
                    )}
                  </button>
                </div>

                {status && (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">{status}</p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 rounded-md">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview area */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Preview</h2>
                  <p className="text-sm text-gray-500">Mobile-only view of generated HTML</p>
                </div>
                {generatedHTML && (
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedHTML)
                      alert("HTML copied to clipboard!")
                    }}
                  >
                    Copy HTML
                  </button>
                )}
              </div>

              <div className="p-4 flex justify-center bg-gray-100 min-h-[500px]">
                <div className="w-[375px] h-[667px] bg-white rounded-3xl shadow-lg overflow-hidden border-8 border-gray-800 relative">
                  <div className="absolute top-0 left-0 right-0 h-6 bg-gray-800 z-10"></div>
                  <iframe
                    ref={iframeRef}
                    className="w-full h-full"
                    title="Generated HTML Preview"
                    sandbox="allow-same-origin allow-scripts"
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
