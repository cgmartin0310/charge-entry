import express from 'express';
import { Request, Response } from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Define the types for Grok API response
interface GrokApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      refusal: null | string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details: Record<string, number>;
    completion_tokens_details: Record<string, number>;
  };
  system_fingerprint: string;
}

/**
 * Process document image with Grok API
 * POST /api/document-processing/analyze
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    console.log('Document processing request received', {
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      bodyLength: req.body ? JSON.stringify(req.body).length : 0,
      hasImageData: !!req.body?.imageData
    });
    
    const { imageData } = req.body;
    
    if (!imageData) {
      console.error('No image data provided in request body');
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    console.log('Image data received, length:', imageData.length);
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    console.log('Using Grok API key (first 5 chars):', apiKey.substring(0, 5));
    
    // Call Grok API with simpler request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting patient information from healthcare documents."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all relevant patient information from this image and format it as a JSON object with these fields: firstName, lastName, dateOfBirth, gender, phone, email, address (with street, city, state, zipCode as sub-fields), insuranceId, insuranceProvider. Include any other relevant medical information you can see."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };

    // Log request details for debugging
    console.log('Request details:', {
      endpoint: endpointUrl,
      model: requestBody.model,
      contentLength: imageData.length,
      apiKeyLength: apiKey.length
    });
    
    // Set a timeout of 60 seconds
    const timeout = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log('Starting fetch request to Grok API...');
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Log response details
      console.log('Response status:', response.status);
      
      const headerLog: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerLog[key] = value;
      });
      console.log('Response headers:', JSON.stringify(headerLog));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text:', errorText);
        return res.status(response.status).json({ 
          message: 'Error from Grok API',
          error: errorText,
          status: response.status,
          statusText: response.statusText,
          headers: headerLog
        });
      }

      const data = await response.json() as GrokApiResponse;
      console.log('Grok API response received successfully');

      // Extract the content from the response
      if (data.choices && data.choices[0]?.message?.content) {
        const content = data.choices[0].message.content;
        
        // Try to parse as JSON
        try {
          let extractedData = {};
          let jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            extractedData = JSON.parse(jsonStr);
          } else if (content.includes(':')) {
            // If it's not JSON, try key-value pairs
            extractedData = parseTextContent(content);
          }
          
          return res.json({ 
            success: true, 
            data: extractedData,
            rawContent: content,
            rawResponse: data
          });
        } catch (parseError) {
          console.error('Error parsing response content:', parseError);
          return res.status(500).json({ 
            message: 'Error parsing Grok API response', 
            rawContent: content,
            rawResponse: data
          });
        }
      } else {
        console.error('Missing expected content in Grok API response');
        return res.status(500).json({ 
          message: 'Invalid response format from Grok API',
          response: data
        });
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after', timeout, 'ms');
        return res.status(408).json({ message: 'Request timed out' });
      }
      
      console.error('Fetch error:', fetchError);
      return res.status(500).json({ 
        message: 'Error communicating with Grok API',
        error: fetchError.message
      });
    }
  } catch (error: any) {
    console.error('Server error processing document:', error);
    return res.status(500).json({ 
      message: 'Server error processing document',
      error: error.message
    });
  }
});

/**
 * Test endpoint to verify the document processing API is accessible
 * GET /api/document-processing/test
 */
router.get('/test', (req: Request, res: Response) => {
  // Check if the API key is configured
  const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
  
  return res.json({
    message: 'Document processing API is accessible',
    apiKeyConfigured: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 5) + '...' : 'Not configured',
    time: new Date().toISOString()
  });
});

/**
 * HTML test page for direct document scanning testing 
 * GET /api/document-processing/test-page
 */
router.get('/test-page', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Scanning Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    .raw-output { margin-top: 20px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .note { background-color: #fffde7; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #ffd600; }
    .warning { background-color: #fff4e5; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #ff9800; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Document Scanning Test</h1>
  
  <div class="warning">
    <p>⚠️ IMPORTANT: This test will only extract text that is ACTUALLY VISIBLE in the image.</p>
    <p>Empty fields are EXPECTED and ACCEPTABLE! The AI will NOT generate fake data.</p>
  </div>
  
  <div class="note">
    <p>This document scanning tool is configured to prioritize accuracy over completeness. It will:</p>
    <ul>
      <li>Only extract information explicitly visible in the image</li>
      <li>Leave fields completely empty if information isn't clearly visible</li>
      <li>Never make up, hallucinate, or generate any information</li>
    </ul>
    <p>This is intentional to avoid incorrect data in healthcare records.</p>
  </div>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process Image</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>Extracted Data:</h3>
      <pre id="result">No results yet</pre>
      
      <h3>Raw API Response:</h3>
      <div id="rawOutput" class="raw-output">No raw output yet</div>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const rawOutput = document.getElementById('rawOutput');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request...';
        rawOutput.textContent = 'Waiting for response...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        
        // Display the extracted data
        if (data.success && data.data) {
          resultArea.textContent = JSON.stringify(data.data, null, 2);
        } else {
          resultArea.textContent = JSON.stringify(data, null, 2);
        }
        
        // Display raw API response if available
        if (data.rawResponse) {
          rawOutput.textContent = JSON.stringify(data.rawResponse, null, 2);
        } else if (data.rawContent) {
          rawOutput.textContent = data.rawContent;
        } else {
          rawOutput.textContent = "No raw API response available";
        }
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Test with a sample insurance card image
 * GET /api/document-processing/test-sample
 */
router.get('/test-sample', async (req: Request, res: Response) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Sample insurance card image (base64 encoded small test image)
    // This is just a minimal sample - in production, use a real sample image
    const sampleImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACoCAMAAABt9SM9AAAA1VBMVEUADXH////9uwD+vgD/wAD/wgAADHEAAGwAAGcAAGsAAGr/xQAAAGUABnD7+/y2t88ACXAAAGIAAFwAB2/c3ejl5u719fjKy9yGiLBRVJBhZJmMjrOoqsbFxtmXmbnQ0eBcX5dCRYfBwdRrdYgrMH+jpcRHSou6vNFYW5Wws8w9QIX4ealJTYtwcqL+56j+2Hr/+Of+34v/9Nf/01n+679tdJ81OoJ4ealJTYtwcqL+5aH+0U/+yzv+35D/78j/9dv+xif+7L9lQT9MADe5bxY3ACzSghHfeBCvpVE2AAAGLklEQVR4nO2c/0MaNxjAc+GuB4jCsAooBdG5zXU63dbaru1W98f//xdN8pK7BJKQg1vLvtf3DySSR+7z5vLcyzcDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgB+a7IvRUYqQ3ksxLR3mOjTpzLzpW2WrdnwYYZpPfKteQ2mR5Y6PlSuYbYH+kkw7FXHnEXcZXOUZjdEznxJeRdycdkUjTJpLjJpqGSqDZF+7Cae9xqqEK1XJlWRrGZFQqqN3zPOSrr7tBUbpnKXMRMQW5rUw6ZxQ5XPjw+H3q6GpBbIbYdLJp4nY6yFydbXpJJ/PKprPVTdnRJkuDYuZDJH+YGPRyh6PcDRB/2Ouf8LtQYVa0cC+bKKTQTbZX6wsvDlHp9vjNVeJ3kYBnbQbgZuNChrn4aE6OPrXsRPHBX11++Gjc0fXRSOvexfKlI6vr5+s1OtH1wUNxVdZE/0CKkY+pxltOklgbLSbJdYyGoxjnFrOfXUf1Wp1T3F9X8tH9K78RHjEYbzFYLKxcHgkwh8z7oXG4vFIYnV+IhA5cK9LPmE4BL5Yrjo+uXTx6nLvdnfAkLpnudavQ3d/T0i+S1LJXvLVUvOIiOPx0vQELGUyWclYh+r47LF/qXr+hbj6Wziqf1LH3v1OZuTcv9lJYLiVz3R8UcJV7lozLrZs9rQsO3F0uHw0VhfVvaPG7Z4QdWm46l+x09E4Y8/2Oj7+qGRl7jJ6tdJxgc3HsuNMDhMr9lCrwlQVb/lXqPwXnqHb85POe11UJ7X6xb3K/oHLyg/XJvpGLHe10nGBLcaSLuTTZp2VjbRaXnBt3alrPagL/VlfqoOz/tmNmOTOVKBR/6JO1MZnKsO5sXdYW+vVSsWF5tVGxipj3r8k4VjHXBbW3oDJqmtpXlbP5/O1/V+xrg94iX2zsFap7IzWEjEsslpWKTuOLMus+0Nc+sUVscfOvJtvdvPSLxmL52TE+v62ZkrD+jzVssbPvYz1o9BSsVfYIlmHImxp2bW9Y5a27RXK5XDpQdYyWUXmytJQdlRDZ1XPRIb6lRfqFh/MWbRBssizYd7f3uHSMhclPVHwO7LEgp3PZJVtFmYmGStTM5aoxPaOWcvGRHOv2aNsMjFDsJLH4qZYU5YeHEudlF6sOLyNrKwpy5S1+qDrGqtUKo6KDcmKLUtOuLLVe6KO9sUfZgxWNSLOZHbGqLkrK3+fsYpbVvahzFi1j7bkv9aNuEO92TuOLGuz0JXlsYYs3mB4slbJqtfrb3Niz3WT4b1o8i5EY1/fj6yCtY6xDnKyeIdRylx+WCGrlru7OdDTvL0HUcm1Rx0fj1fIymxX1rjwkLG2aOdYP0GbJZ9+FjQKn+U1dF/Bev5vIlfNj3uzYzmriK2aX7krK5sUHhpskZS1n7GMtYKsusJUw8W5m5Gq3LkzmbrSl1hDlvj/JhaytkfKchbphrF4+yxOO2aBYqxVsozqLy/2XFmPp4asXPGhUVjCWA20jLGccYY7WejISnS7oY110kBLyTJl+UcBrhfC7hVrJWtJYxV/ENWy7NVK2om2rC01x0qosYYNlJ/dOLI+9S73bm5qehFsyGpOZf6p1xbJUa3K68tyZBWXYGkZa3l0xjI2QO0kxrpLJMsxVkLTvLkbD1nWyMNxP2n9y5Ml25F8C/HB09hbDYyZ9RXPUU/vMOoXWCLdNMu/LDzFzrIdWfkNQSWLS1KfO6d7d6as34NnqMTSm1+6b1BTfL0+J7ePvJzr0WOprC2RJWYMeqnSQIGq/Ue1Qjisn9i3/zv2XW7RU+TtQSLFl1PpfN+WME1Hh0klSVnxpUMvZpGqYLp93JWxPTYVKpgX8nV+Ii7LDPsXsmjxPZTZLpsy4vsF5zTRO7nwFYX8fVIGgXeXG6MifvHQX/3igj9NNF5B8YvhfNFvEuznwRbfpgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4OfmP1I+9LCaPLK9AAAAAElFTkSuQmCC';
    
    console.log('Testing with sample insurance card image');
    
    // Call Grok API with fixed request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "IMPORTANT: You are strictly an information extractor. Your ONLY task is to read information directly visible in the image. DO NOT HALLUCINATE, DO NOT MAKE UP, DO NOT GENERATE ANY DATA. If something is not EXPLICITLY visible in the image, leave that field COMPLETELY EMPTY. Being accurate is critical - it's better to leave a field empty than to make anything up. False information could cause serious harm. ONLY extract what you can actually see in the image. Remember: empty fields are expected and acceptable."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I need you to extract ONLY information that is EXPLICITLY visible in this document image. This is for a medical/healthcare application where accuracy is critical.\n\n⚠️ CRITICAL INSTRUCTIONS ⚠️\n- DO NOT make up, generate, or hallucinate ANY information\n- If you cannot clearly see information for a field, the field MUST be empty (\"\")\n- DO NOT use placeholders or sample data\n- DO NOT guess or infer information that isn't explicitly visible\n- EMPTY values are EXPECTED and ACCEPTABLE\n\nReturn a JSON object with these fields, and ONLY include values you can directly read from the image:\n- firstName: \"\" (EMPTY if not clearly visible)\n- lastName: \"\" (EMPTY if not clearly visible)\n- dateOfBirth: \"\" (EMPTY if not clearly visible, otherwise in YYYY-MM-DD format)\n- gender: \"\" (EMPTY if not clearly visible)\n- phone: \"\" (EMPTY if not clearly visible)\n- email: \"\" (EMPTY if not clearly visible)\n- address: { street: \"\", city: \"\", state: \"\", zipCode: \"\" } (each EMPTY if not clearly visible)\n- insuranceId: \"\" (EMPTY if not clearly visible)\n- insuranceProvider: \"\" (EMPTY if not clearly visible)\n\nI need to emphasize again: ACCURACY is critical, leaving fields EMPTY is EXPECTED and ACCEPTABLE. Providing false information could result in healthcare billing errors."
            },
            {
              type: "image_url",
              image_url: {
                url: sampleImageBase64
              }
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 1500
    };

    // Log request details for debugging
    console.log('Request details for sample test:', {
      endpoint: endpointUrl,
      model: requestBody.model,
      contentLength: sampleImageBase64.length,
      apiKeyLength: apiKey.length
    });
    
    // Set a timeout of 60 seconds
    const timeout = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log('Starting fetch request to Grok API for sample test...');
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      console.log('Sample test response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text for sample test:', errorText);
        return res.status(response.status).json({ 
          message: 'Error from Grok API on sample test',
          error: errorText
        });
      }

      const data = await response.json() as GrokApiResponse;
      console.log('Sample test API response received successfully');
      
      // Return the full response for analysis
      return res.json({ 
        success: true,
        rawResponse: data,
        extractedContent: data.choices[0]?.message?.content || 'No content extracted'
      });
    } catch (error: any) {
      console.error('Error in sample test:', error);
      return res.status(500).json({
        message: 'Error processing sample image',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Server error in sample test:', error);
    return res.status(500).json({ 
      message: 'Server error processing sample image',
      error: error.message
    });
  }
});

/**
 * Test with a local test image file (Test_Patient)
 * GET /api/document-processing/test-local
 */
router.get('/test-local', async (req: Request, res: Response) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Import fs to read the file
    const fs = require('fs');
    const path = require('path');
    
    // Path to the test image (relative to project root)
    const imagePath = path.join(process.cwd(), 'Test_Patient');
    
    console.log('Reading test image from:', imagePath);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        message: 'Test image not found',
        searchPath: imagePath
      });
    }
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    // Properly format base64 with data:image prefix
    let mediaType = 'image/jpeg';
    if (imagePath.toLowerCase().endsWith('.png')) {
      mediaType = 'image/png';
    }
    const base64Data = `data:${mediaType};base64,${imageBuffer.toString('base64')}`;
    
    console.log('Testing with local image file - base64 prefix:', base64Data.substring(0, 50));
    
    // Call Grok API with fixed request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "IMPORTANT: You are strictly an information extractor. Your ONLY task is to read information directly visible in the image. DO NOT HALLUCINATE, DO NOT MAKE UP, DO NOT GENERATE ANY DATA. If something is not EXPLICITLY visible in the image, leave that field COMPLETELY EMPTY. Being accurate is critical - it's better to leave a field empty than to make anything up. False information could cause serious harm. ONLY extract what you can actually see in the image. Remember: empty fields are expected and acceptable."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I need you to extract ONLY information that is EXPLICITLY visible in this document image. This is for a medical/healthcare application where accuracy is critical.\n\n⚠️ CRITICAL INSTRUCTIONS ⚠️\n- DO NOT make up, generate, or hallucinate ANY information\n- If you cannot clearly see information for a field, the field MUST be empty (\"\")\n- DO NOT use placeholders or sample data\n- DO NOT guess or infer information that isn't explicitly visible\n- EMPTY values are EXPECTED and ACCEPTABLE\n\nReturn a JSON object with these fields, and ONLY include values you can directly read from the image:\n- firstName: \"\" (EMPTY if not clearly visible)\n- lastName: \"\" (EMPTY if not clearly visible)\n- dateOfBirth: \"\" (EMPTY if not clearly visible, otherwise in YYYY-MM-DD format)\n- gender: \"\" (EMPTY if not clearly visible)\n- phone: \"\" (EMPTY if not clearly visible)\n- email: \"\" (EMPTY if not clearly visible)\n- address: { street: \"\", city: \"\", state: \"\", zipCode: \"\" } (each EMPTY if not clearly visible)\n- insuranceId: \"\" (EMPTY if not clearly visible)\n- insuranceProvider: \"\" (EMPTY if not clearly visible)\n\nI need to emphasize again: ACCURACY is critical, leaving fields EMPTY is EXPECTED and ACCEPTABLE. Providing false information could result in healthcare billing errors."
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 1500
    };

    // Log request details for debugging
    console.log('Request details for local test:', {
      endpoint: endpointUrl,
      model: requestBody.model,
      contentLength: base64Data.length,
      apiKeyLength: apiKey.length
    });
    
    // Set a timeout of 60 seconds
    const timeout = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log('Starting fetch request to Grok API for local test...');
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      console.log('Local test response status:', response.status);
      console.log('Local test response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text for local test:', errorText);
        return res.status(response.status).json({ 
          message: 'Error from Grok API on local test',
          error: errorText
        });
      }

      const data = await response.json() as GrokApiResponse;
      console.log('Local test API response received successfully');
      
      // Extract the content and try to parse as JSON
      if (data.choices && data.choices[0]?.message?.content) {
        const content = data.choices[0].message.content;
        
        try {
          let extractedData = {};
          let jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            extractedData = JSON.parse(jsonStr);
          } else if (content.includes(':')) {
            // If it's not JSON, try key-value pairs
            extractedData = parseTextContent(content);
          }
          
          return res.json({ 
            success: true, 
            data: extractedData,
            rawResponse: data
          });
        } catch (parseError) {
          console.error('Error parsing response content:', parseError);
          return res.status(500).json({ 
            message: 'Error parsing Grok API response', 
            rawContent: content,
            rawResponse: data
          });
        }
      } else {
        return res.status(500).json({ 
          message: 'Invalid response format from Grok API',
          response: data
        });
      }
    } catch (error: any) {
      console.error('Server error in local test:', error);
      return res.status(500).json({ 
        message: 'Server error processing local image',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Server error in local test:', error);
    return res.status(500).json({ 
      message: 'Server error processing local image',
      error: error.message
    });
  }
});

/**
 * Test endpoint for the Test_Patient.jpg image in project root
 * GET /api/document-processing/test-patient
 */
router.get('/test-patient', async (req: Request, res: Response) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Import fs to read the file
    const fs = require('fs');
    const path = require('path');
    
    // Path to the test image (relative to project root)
    const imagePath = path.join(process.cwd(), 'Test_Patient.jpg');
    
    console.log('Reading Test_Patient.jpg from:', imagePath);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        message: 'Test_Patient.jpg not found',
        searchPath: imagePath
      });
    }
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    // Properly format base64 with data:image prefix
    const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    console.log('Testing with Test_Patient.jpg - base64 prefix:', base64Data.substring(0, 50));
    
    // Call Grok API with simpler request format (similar to web interface)
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting patient information from healthcare documents."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all relevant patient information from this image and format it as a JSON object with these fields: firstName, lastName, dateOfBirth, gender, phone, email, address (with street, city, state, zipCode as sub-fields), insuranceId, insuranceProvider. Include any other relevant medical information you can see."
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };

    console.log('Using simpler prompt for Test_Patient.jpg');
    
    try {
      console.log('Starting fetch request to Grok API with Test_Patient.jpg...');
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Test_Patient.jpg response status:', response.status);
      
      const headerLog: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerLog[key] = value;
      });
      console.log('Response headers:', JSON.stringify(headerLog));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text for Test_Patient.jpg:', errorText);
        return res.status(response.status).json({ 
          message: 'Error from Grok API on Test_Patient.jpg',
          error: errorText,
          status: response.status,
          statusText: response.statusText,
          headers: headerLog
        });
      }

      const data = await response.json() as GrokApiResponse;
      console.log('Test_Patient.jpg API response received successfully');
      
      // Extract the content and try to parse as JSON
      if (data.choices && data.choices[0]?.message?.content) {
        const content = data.choices[0].message.content;
        console.log('Raw content from Grok API:', content);
        
        try {
          let extractedData = {};
          let jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            extractedData = JSON.parse(jsonStr);
          } else if (content.includes(':')) {
            // If it's not JSON, try key-value pairs
            extractedData = parseTextContent(content);
          }
          
          return res.json({ 
            success: true, 
            data: extractedData,
            rawContent: content,
            rawResponse: data
          });
        } catch (parseError) {
          console.error('Error parsing response content:', parseError);
          return res.status(500).json({ 
            message: 'Error parsing Grok API response', 
            rawContent: content,
            rawResponse: data
          });
        }
      } else {
        return res.status(500).json({ 
          message: 'Invalid response format from Grok API',
          response: data
        });
      }
    } catch (error: any) {
      console.error('Server error in Test_Patient.jpg test:', error);
      return res.status(500).json({ 
        message: 'Server error processing Test_Patient.jpg',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Server error in Test_Patient.jpg test:', error);
    return res.status(500).json({ 
      message: 'Server error processing Test_Patient.jpg',
      error: error.message
    });
  }
});

/**
 * Extract raw patient information without specific formatting
 * GET /api/document-processing/raw-extract
 */
router.post('/raw-extract', async (req: Request, res: Response) => {
  try {
    console.log('Raw extract request received', {
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      bodyLength: req.body ? JSON.stringify(req.body).length : 0,
      hasImageData: !!req.body?.imageData
    });
    
    const { imageData } = req.body;
    
    if (!imageData) {
      console.error('No image data provided in request body');
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    console.log('Image data received, length:', imageData.length);
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    console.log('Using Grok API key (first 5 chars):', apiKey.substring(0, 5));
    
    // Call Grok API with very simple prompt - just like the web interface
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I want you to pull the relevant patient info from this pic. Pay special attention to extracting the EXACT address, phone numbers, and all contact information precisely as shown in the image."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    console.log('Using simple raw extraction prompt');
    
    try {
      console.log('Starting fetch request to Grok API for raw extraction...');
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Raw extraction response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text for raw extraction:', errorText);
        return res.status(response.status).json({ 
          message: 'Error from Grok API on raw extraction',
          error: errorText
        });
      }

      const data = await response.json() as GrokApiResponse;
      console.log('Raw extraction API response received successfully');
      
      // Just return the raw content from the API
      if (data.choices && data.choices[0]?.message?.content) {
        const content = data.choices[0].message.content;
        console.log('Raw content from Grok API (first 100 chars):', content.substring(0, 100));
        
        return res.json({ 
          success: true,
          rawContent: content,
          rawResponse: data
        });
      } else {
        return res.status(500).json({ 
          message: 'Invalid response format from Grok API',
          response: data
        });
      }
    } catch (error: any) {
      console.error('Error in raw extraction:', error);
      return res.status(500).json({
        message: 'Error processing image',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Server error in raw extraction:', error);
    return res.status(500).json({ 
      message: 'Server error processing image',
      error: error.message
    });
  }
});

/**
 * HTML test page for raw document info extraction 
 * GET /api/document-processing/raw-test
 */
router.get('/raw-test', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raw Patient Info Extraction</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Raw Patient Info Extraction</h1>
  
  <p>This page uses the exact same prompt that worked in the Grok web interface: "I want you to pull the relevant patient info from this pic"</p>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Extract Raw Info</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>Extracted Raw Information:</h3>
      <pre id="result">No results yet</pre>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/raw-extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.rawContent) {
          resultArea.textContent = data.rawContent;
        } else {
          resultArea.textContent = JSON.stringify(data, null, 2);
        }
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Helper function to parse key-value text content
 */
function parseTextContent(content: string) {
  const result: any = {
    address: {}
  };
  
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':', 2).map((s: string) => s.trim());
      const normalizedKey = key.toLowerCase();
      
      if (normalizedKey.includes('first name') || normalizedKey === 'firstname') {
        result.firstName = value;
      } else if (normalizedKey.includes('last name') || normalizedKey === 'lastname') {
        result.lastName = value;
      } else if (normalizedKey.includes('birth') || normalizedKey === 'dob') {
        result.dateOfBirth = value;
      } else if (normalizedKey === 'gender') {
        result.gender = value;
      } else if (normalizedKey.includes('phone')) {
        result.phone = value;
      } else if (normalizedKey === 'email') {
        result.email = value;
      } else if (normalizedKey.includes('street') || normalizedKey === 'address') {
        result.address.street = value;
      } else if (normalizedKey === 'city') {
        result.address.city = value;
      } else if (normalizedKey === 'state') {
        result.address.state = value;
      } else if (normalizedKey.includes('zip')) {
        result.address.zipCode = value;
      } else if (normalizedKey.includes('insurance id') || normalizedKey.includes('member id')) {
        result.insuranceId = value;
      } else if (normalizedKey.includes('insurance provider') || normalizedKey === 'provider') {
        result.insuranceProvider = value;
      }
    }
  }
  
  return result;
}

/**
 * Extract and map patient information using two-step approach
 * POST /api/document-processing/two-step
 */
router.post('/two-step', async (req: Request, res: Response) => {
  try {
    console.log('Two-step extraction request received');
    
    const { imageData } = req.body;
    
    if (!imageData) {
      console.error('No image data provided in request body');
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // STEP 1: Raw extraction
    console.log('Step 1: Performing raw extraction...');
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const rawExtractionBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I want you to pull the relevant patient info from this pic. Pay special attention to extracting the EXACT address, phone numbers, and all contact information precisely as shown in the image."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    const rawResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(rawExtractionBody)
    });
    
    if (!rawResponse.ok) {
      const errorText = await rawResponse.text();
      console.error('API error in raw extraction step:', errorText);
      return res.status(rawResponse.status).json({ 
        message: 'Error in raw extraction step',
        error: errorText
      });
    }
    
    const rawData = await rawResponse.json() as GrokApiResponse;
    const rawContent = rawData.choices[0]?.message?.content || '';
    console.log('Raw extraction completed');
    
    // STEP 2: Map the raw text to our structured fields
    console.log('Step 2: Mapping raw data to structured fields...');
    
    const mappedData = mapRawDataToFields(rawContent);
    
    return res.json({
      success: true,
      data: mappedData,
      rawContent: rawContent
    });
    
  } catch (error: any) {
    console.error('Error in two-step extraction:', error);
    return res.status(500).json({
      message: 'Error in two-step extraction',
      error: error.message
    });
  }
});

/**
 * HTML test page for two-step document processing
 * GET /api/document-processing/two-step-test
 */
router.get('/two-step-test', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Two-Step Patient Info Extraction</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .results-container { display: flex; flex-wrap: wrap; gap: 20px; }
    .result { margin-top: 20px; flex: 1; min-width: 300px; }
    .raw-result { white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .structured-result { background: #e6f7ff; padding: 15px; border-radius: 5px; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Two-Step Patient Info Extraction</h1>
  
  <p>This page uses a two-step approach: 1) Extract raw patient info, 2) Map it to structured fields</p>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process Image</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="results-container">
      <div class="result">
        <h3>Structured Data:</h3>
        <div id="structuredResult" class="structured-result">No results yet</div>
      </div>
      
      <div class="result">
        <h3>Raw Extracted Information:</h3>
        <div id="rawResult" class="raw-result">No results yet</div>
      </div>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const structuredResult = document.getElementById('structuredResult');
    const rawResult = document.getElementById('rawResult');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        structuredResult.textContent = 'Sending request...';
        rawResult.textContent = 'Waiting for response...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/two-step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          structuredResult.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Format the structured data
          structuredResult.innerHTML = formatStructuredData(data.data);
          rawResult.textContent = data.rawContent;
        } else {
          structuredResult.textContent = JSON.stringify(data, null, 2);
          rawResult.textContent = 'No raw data available';
        }
      } catch (error) {
        loading.style.display = 'none';
        structuredResult.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
    
    function formatStructuredData(data) {
      let html = '';
      
      // Personal info
      html += '<h4>Personal Information</h4>';
      html += \`<p><strong>Name:</strong> \${data.firstName} \${data.lastName}</p>\`;
      html += \`<p><strong>Date of Birth:</strong> \${data.dateOfBirth}</p>\`;
      html += \`<p><strong>Gender:</strong> \${data.gender}</p>\`;
      html += \`<p><strong>Phone:</strong> \${data.phone}</p>\`;
      html += \`<p><strong>Email:</strong> \${data.email}</p>\`;
      
      // Address
      html += '<h4>Address</h4>';
      html += \`<p><strong>Street:</strong> \${data.address.street}</p>\`;
      html += \`<p><strong>City:</strong> \${data.address.city}</p>\`;
      html += \`<p><strong>State:</strong> \${data.address.state}</p>\`;
      html += \`<p><strong>Zip Code:</strong> \${data.address.zipCode}</p>\`;
      
      // Insurance
      html += '<h4>Insurance</h4>';
      html += \`<p><strong>Provider:</strong> \${data.insuranceProvider}</p>\`;
      html += \`<p><strong>ID:</strong> \${data.insuranceId}</p>\`;
      
      return html;
    }
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Test endpoint to verify model isn't using mock responses
 * GET /api/document-processing/random-test
 */
router.get('/random-test', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Random Prompt Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .note { background-color: #f8d7da; padding: 15px; margin: 15px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Random Prompt Test</h1>
  
  <div class="note">
    <p>This test uses an extremely unusual prompt that would never trigger canned/mock responses.</p>
    <p>If the API returns information specific to the image, then it's definitely not using mock data.</p>
  </div>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process with Random Prompt</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>Random Prompt Test Results:</h3>
      <pre id="result">No results yet</pre>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/random-prompt-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.rawContent) {
          resultArea.textContent = data.rawContent;
        } else {
          resultArea.textContent = JSON.stringify(data, null, 2);
        }
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Process image with a random/bizarre prompt
 * POST /api/document-processing/random-prompt-test
 */
router.post('/random-prompt-test', async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Using an extremely unusual/random prompt that would never match any canned response templates
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    // Generate a random string to make the prompt unique
    const randomString = Math.random().toString(36).substring(2, 15);
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `ZWPX_TEST_${randomString}: Imagine you're a purple elephant detective from Mars investigating a document case. Describe what's in this image as if you're filing a bizarre alien report, but be extremely specific about any addresses, phone numbers, names, and dates you can see. This is test prompt ID: ${randomString}.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0.7, // Higher temperature for more creative response
      max_tokens: 1500
    };
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        message: 'Error from Grok API on random prompt test',
        error: errorText
      });
    }

    const data = await response.json() as GrokApiResponse;
    
    return res.json({ 
      success: true,
      rawContent: data.choices[0]?.message?.content || 'No content returned',
      testPrompt: requestBody.messages[0].content[0].text,
      rawResponse: data
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error processing with random prompt',
      error: error.message
    });
  }
});

/**
 * Process Test_Patient.jpg with the direct web prompt
 * GET /api/document-processing/web-match-test
 */
router.get('/web-match-test', async (req: Request, res: Response) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Import fs to read the file
    const fs = require('fs');
    const path = require('path');
    
    // Path to the test image (relative to project root)
    const imagePath = path.join(process.cwd(), 'Test_Patient.jpg');
    
    console.log('Reading Test_Patient.jpg for web match test from:', imagePath);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        message: 'Test_Patient.jpg not found',
        searchPath: imagePath
      });
    }
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    // Log the first part of the base64 data to verify format
    console.log('Base64 data (first 50 chars):', base64Data.substring(0, 50));
    
    // Using the exact same prompt as the web interface
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    // 8 different tests with variations on the request format:
    
    // 1. Direct basic prompt (identical to web interface)
    const directBasicPrompt = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I want you to pull the relevant patient info from this pic"
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    // 2. Add system message
    const systemMessagePrompt = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting information from images."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I want you to pull the relevant patient info from this pic"
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    // Run tests and collect results
    const results = {};
    
    console.log('Starting direct basic prompt test...');
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(directBasicPrompt)
      });
      
      if (response.ok) {
        const data = await response.json() as GrokApiResponse;
        results['directBasicPrompt'] = data.choices[0]?.message?.content || 'No content';
      } else {
        const errorText = await response.text();
        results['directBasicPrompt'] = `Error: ${response.status} - ${errorText}`;
      }
    } catch (error: any) {
      results['directBasicPrompt'] = `Exception: ${error.message}`;
    }
    
    console.log('Starting system message prompt test...');
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(systemMessagePrompt)
      });
      
      if (response.ok) {
        const data = await response.json() as GrokApiResponse;
        results['systemMessagePrompt'] = data.choices[0]?.message?.content || 'No content';
      } else {
        const errorText = await response.text();
        results['systemMessagePrompt'] = `Error: ${response.status} - ${errorText}`;
      }
    } catch (error: any) {
      results['systemMessagePrompt'] = `Exception: ${error.message}`;
    }
    
    return res.json({
      success: true,
      results: results,
      imageSize: base64Data.length,
      testInfo: "This test runs multiple variations of the API request to compare with the web interface"
    });
  } catch (error: any) {
    console.error('Error in web match test:', error);
    return res.status(500).json({
      message: 'Error in web match test',
      error: error.message
    });
  }
});

/**
 * Map raw text data to structured fields
 */
function mapRawDataToFields(rawText: string) {
  // Create a default empty structure
  const result: any = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    },
    insuranceId: '',
    insuranceProvider: ''
  };
  
  console.log('Starting to map raw text to fields');
  
  // Helper function to extract a value based on label
  function extractValue(text: string, label: string, multiline = false): string {
    let regex;
    if (multiline) {
      // For multiline values, match until the next header line (starts with - or **)
      regex = new RegExp(`${label}:?\\s*([^\\n]+(?:\\n(?!\\s*(?:-|\\*\\*)).+)*)`, 'i');
    } else {
      regex = new RegExp(`${label}:?\\s*([^\\n]+)`, 'i');
    }
    
    const match = text.match(regex);
    const value = match ? match[1].trim() : '';
    console.log(`Extracted ${label}: "${value}"`);
    return value;
  }
  
  // Extract patient name and split into first/last name
  const fullName = extractValue(rawText, 'Patient Name') || 
                  extractValue(rawText, 'Name');
  
  if (fullName) {
    const nameParts = fullName.split(' ');
    if (nameParts.length >= 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts[nameParts.length - 1];
      // If there are more than 2 parts, the middle could be a middle name or part of last name
      if (nameParts.length > 2) {
        // For simplicity, assume the middle is part of first name
        result.firstName = nameParts.slice(0, -1).join(' ');
      }
    }
  }
  
  // Extract date of birth with multiple patterns
  const dob = extractValue(rawText, 'Date of Birth') || 
             extractValue(rawText, 'DOB') ||
             extractValue(rawText, 'Birth Date');
  
  if (dob) {
    // Try to parse various date formats
    let dateParts = dob.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateParts) {
      let month = dateParts[1].padStart(2, '0');
      let day = dateParts[2].padStart(2, '0');
      let year = dateParts[3];
      
      // Handle 2-digit years
      if (year.length === 2) {
        const twoDigitYear = parseInt(year);
        year = twoDigitYear > 50 ? `19${year}` : `20${year}`;
      }
      
      // Format in YYYY-MM-DD
      result.dateOfBirth = `${year}-${month}-${day}`;
    } else {
      // Try another format: Month Day, Year
      dateParts = dob.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
      if (dateParts) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const month = (monthNames.indexOf(dateParts[1].toLowerCase()) + 1).toString().padStart(2, '0');
        const day = dateParts[2].padStart(2, '0');
        const year = dateParts[3];
        result.dateOfBirth = `${year}-${month}-${day}`;
      }
    }
  }
  
  // Extract gender
  result.gender = extractValue(rawText, 'Gender') || 
                 (rawText.match(/\bmale\b/i) ? 'Male' : '') || 
                 (rawText.match(/\bfemale\b/i) ? 'Female' : '');
  
  // Extract phone with multiple patterns
  // First look for primary patient phone
  let phonePatterns = [
    extractValue(rawText, 'Phone Number'),
    extractValue(rawText, 'Phone'),
    extractValue(rawText, 'Tel'),
    extractValue(rawText, 'Telephone'),
    extractValue(rawText, 'Cell'),
    extractValue(rawText, 'Mobile')
  ];
  
  // Filter out empty values and use the first one
  const phones = phonePatterns.filter(p => p);
  if (phones.length > 0) {
    // Extract just the digits if possible
    const phoneDigits = phones[0].match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    result.phone = phoneDigits ? phoneDigits[0] : phones[0];
  } else {
    // Try to find any phone-like pattern in the text not associated with Emergency Contact or Physician
    const generalPhoneMatch = rawText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (generalPhoneMatch && !rawText.includes('Emergency Contact') && !rawText.includes('Physician')) {
      result.phone = generalPhoneMatch[0];
    }
  }
  
  // Extract email
  result.email = extractValue(rawText, 'Email') ||
                extractValue(rawText, 'E-mail') ||
                extractValue(rawText, 'Email Address');
  
  // Enhanced address extraction
  let fullAddress = extractValue(rawText, 'Address', true);
  if (fullAddress) {
    // Clean up address (remove line breaks and multiple spaces)
    fullAddress = fullAddress.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Try multiple regex patterns to extract address components
    
    // Pattern 1: street, city, state zipCode
    let addressMatch = fullAddress.match(/(.+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
    if (addressMatch) {
      result.address.street = addressMatch[1].trim();
      result.address.city = addressMatch[2].trim();
      result.address.state = addressMatch[3].trim();
      result.address.zipCode = addressMatch[4].trim();
    } else {
      // Pattern 2: Less structured - try to find state and zip
      const stateZipMatch = fullAddress.match(/([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/);
      if (stateZipMatch) {
        result.address.state = stateZipMatch[1];
        result.address.zipCode = stateZipMatch[2];
        
        // Try to extract city
        const beforeStateZip = fullAddress.substring(0, fullAddress.indexOf(stateZipMatch[0])).trim();
        const cityMatch = beforeStateZip.match(/,\s*([^,]+)$/);
        if (cityMatch) {
          result.address.city = cityMatch[1].trim();
          result.address.street = beforeStateZip.substring(0, beforeStateZip.lastIndexOf(',')).trim();
        } else {
          // If no clear city delimiter, just use everything before state/zip as street
          result.address.street = beforeStateZip;
        }
      } else {
        // If structured parsing fails, just store the whole address as street
        result.address.street = fullAddress;
      }
    }
  }
  
  // If we couldn't parse the address fully, look for city, state, zip separately
  if (!result.address.city) {
    result.address.city = extractValue(rawText, 'City');
  }
  if (!result.address.state) {
    result.address.state = extractValue(rawText, 'State');
  }
  if (!result.address.zipCode) {
    result.address.zipCode = extractValue(rawText, 'Zip') || 
                            extractValue(rawText, 'Zip Code') || 
                            extractValue(rawText, 'Postal Code');
  }
  
  // Extract insurance info with multiple patterns
  result.insuranceProvider = extractValue(rawText, 'Insurance Provider') ||
                           extractValue(rawText, 'Provider') ||
                           extractValue(rawText, 'Insurance Carrier') ||
                           extractValue(rawText, 'Insurance');
                           
  result.insuranceId = extractValue(rawText, 'Policy Number') ||
                     extractValue(rawText, 'Insurance ID') ||
                     extractValue(rawText, 'Member ID') ||
                     extractValue(rawText, 'Policy #') ||
                     extractValue(rawText, 'ID Number');
  
  console.log('Completed mapping, result:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * Direct pipe to Grok with absolute minimal processing
 * GET /api/document-processing/direct-pipe-test
 */
router.get('/direct-pipe-test', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direct Pipe Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .warning { background-color: #ffe0e0; padding: 15px; margin: 15px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Direct Pipe Test</h1>
  
  <div class="warning">
    <p>This test uses the exact prompt: <strong>"I want you to pull the relevant patient info from this pic"</strong></p>
    <p>It directly returns the raw API response without any processing, exactly as received from Grok.</p>
  </div>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process with Direct Pipe</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>Raw API Response:</h3>
      <pre id="result">No results yet</pre>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/process-direct-pipe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        resultArea.textContent = data.rawContent || JSON.stringify(data, null, 2);
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Process image with direct pipe (exact prompt, no processing)
 * POST /api/document-processing/process-direct-pipe
 */
router.post('/process-direct-pipe', async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Use the exact prompt requested by the user
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "I want you to pull the relevant patient info from this pic"
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    console.log('Sending direct pipe request...');
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        message: 'Error from Grok API',
        error: errorText
      });
    }

    // Get the raw response
    const data = await response.json() as GrokApiResponse;
    const content = data.choices[0]?.message?.content || '';
    
    console.log('Received direct pipe response, length:', content.length);
    if (content.length > 100) {
      console.log('First 100 chars:', content.substring(0, 100));
    }
    
    // Return the raw content directly
    return res.json({ 
      success: true,
      rawContent: content,
      // Include these fields for debugging only
      model: data.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens
    });
  } catch (error: any) {
    console.error('Error in direct pipe:', error);
    return res.status(500).json({
      message: 'Error processing with direct pipe',
      error: error.message
    });
  }
});

/**
 * Direct pipe endpoint that uses the exact prompt and returns the raw response
 * GET /api/document-processing/direct-pipe
 */
router.get('/direct-pipe', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direct Pipe Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .note { background-color: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Direct Pipe Test</h1>
  
  <div class="note">
    <p>This test uses the exact prompt: <strong>"I want you to pull the relevant patient info from this pic"</strong></p>
    <p>It directly returns the raw API response without any processing, exactly as received from Grok.</p>
  </div>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process with Direct Pipe</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>Raw API Response:</h3>
      <pre id="result">No results yet</pre>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/process-direct-pipe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        resultArea.textContent = data.rawContent || JSON.stringify(data, null, 2);
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * OpenAI Vision API test 
 * GET /api/document-processing/openai-test
 */
router.get('/openai-test', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenAI Vision API Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .note { background-color: #f8eafa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #9c27b0; }
  </style>
</head>
<body>
  <h1>OpenAI Vision API Test</h1>
  
  <div class="note">
    <p>This test uses OpenAI's Vision API instead of Grok.</p>
    <p>It uses the prompt: <strong>"Extract all patient information from this image including name, date of birth, address, phone, email, insurance details."</strong></p>
    <p>Note: You must set OPENAI_API_KEY in your environment variables.</p>
  </div>
  
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process with OpenAI</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>OpenAI Response:</h3>
      <pre id="result">No results yet</pre>
    </div>
  </div>

  <script>
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const processBtn = document.getElementById('processBtn');
    const resultArea = document.getElementById('result');
    const loading = document.getElementById('loading');
    let imageData = null;

    imageInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (!file) {
        preview.innerHTML = '';
        processBtn.disabled = true;
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        imageData = e.target.result;
        preview.innerHTML = \`<img src="\${imageData}" class="image-preview">\`;
        processBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    processBtn.addEventListener('click', async function() {
      if (!imageData) return;
      
      try {
        resultArea.textContent = 'Sending request to OpenAI...';
        loading.style.display = 'block';
        processBtn.disabled = true;
        
        const response = await fetch('/api/document-processing/process-openai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageData })
        });
        
        loading.style.display = 'none';
        
        if (!response.ok) {
          const errorText = await response.text();
          resultArea.textContent = \`Error: \${response.status} \${response.statusText}\\n\${errorText}\`;
          return;
        }
        
        const data = await response.json();
        resultArea.textContent = data.content || JSON.stringify(data, null, 2);
      } catch (error) {
        loading.style.display = 'none';
        resultArea.textContent = \`Error: \${error.message}\`;
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Process image with OpenAI Vision API
 * POST /api/document-processing/process-openai
 */
router.post('/process-openai', async (req: Request, res: Response) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'OpenAI API key not configured (OPENAI_API_KEY environment variable)' });
    }
    
    // Use OpenAI API
    const endpointUrl = 'https://api.openai.com/v1/chat/completions';
    
    const requestBody = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all patient information from this image including name, date of birth, address, phone, email, insurance details."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    };
    
    console.log('Sending OpenAI Vision API request...');
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        message: 'Error from OpenAI API',
        error: errorText
      });
    }

    // Get the response
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('Received OpenAI response, length:', content.length);
    if (content.length > 100) {
      console.log('First 100 chars:', content.substring(0, 100));
    }
    
    // Return the content
    return res.json({ 
      success: true,
      content: content,
      model: data.model,
      usage: data.usage
    });
  } catch (error: any) {
    console.error('Error in OpenAI Vision API:', error);
    return res.status(500).json({
      message: 'Error processing with OpenAI',
      error: error.message
    });
  }
});

/**
 * Test with Test_Patient.jpg with extensive debug info
 * GET /api/document-processing/debug-test
 */
router.get('/debug-test', async (req: Request, res: Response) => {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    // Import fs to read the file
    const fs = require('fs');
    const path = require('path');
    
    // Path to the test image (relative to project root)
    const imagePath = path.join(process.cwd(), 'Test_Patient.jpg');
    
    console.log('Reading Test_Patient.jpg for debug test from:', imagePath);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ 
        message: 'Test_Patient.jpg not found',
        searchPath: imagePath
      });
    }
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const fileSize = imageBuffer.length;
    const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    // Basic file info
    const fileInfo = {
      path: imagePath,
      size: fileSize,
      base64Length: base64Data.length,
      base64Prefix: base64Data.substring(0, 50) + '...'
    };
    
    // Call Grok API with the most basic prompt
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const promptText = "I want you to pull the relevant patient info from this pic";
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            {
              type: "image_url",
              image_url: {
                url: base64Data
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1500
    };
    
    console.log('Sending API request for debug test...');
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseStatus = response.status;
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    let responseData;
    let responseContent = '';
    
    if (response.ok) {
      const data = await response.json();
      responseData = data;
      responseContent = data.choices?.[0]?.message?.content || '';
    } else {
      const errorText = await response.text();
      responseContent = `Error: ${errorText}`;
    }
    
    const imageTokens = responseData?.usage?.prompt_tokens_details?.image_tokens || 0;
    
    // Return extensive debug information
    return res.json({
      fileInfo: fileInfo,
      requestDetails: {
        url: endpointUrl,
        prompt: promptText,
        model: requestBody.model,
        requestBodySize: JSON.stringify(requestBody).length
      },
      responseDetails: {
        status: responseStatus,
        headers: responseHeaders,
        imageTokens: imageTokens,
        totalTokens: responseData?.usage?.total_tokens || 0,
        model: responseData?.model || ''
      },
      rawContent: responseContent,
      addressExtract: extractAddress(responseContent)
    });
  } catch (error: any) {
    console.error('Error in debug test:', error);
    return res.status(500).json({
      message: 'Error in debug test',
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Extract address from text content for debugging
 */
function extractAddress(text: string) {
  const addressRegex = /address:?\s*([^.\n]+)/i;
  const addressMatch = text.match(addressRegex);
  return addressMatch ? addressMatch[1].trim() : 'Not found';
}

export default router; 