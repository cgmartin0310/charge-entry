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
    
    // Extract the base64 data
    const base64Data = imageData.split('base64,')[1];
    
    // Extract the media type from the image data URL
    let mediaType = imageData.split(';')[0].split(':')[1];
    
    // Normalize media type - ensure jpg is handled correctly as jpeg
    if (mediaType === 'image/jpg') {
      mediaType = 'image/jpeg';
    }
    
    console.log('Server processing document with media type:', mediaType);
    
    // Get API key from environment variable
    const apiKey = process.env.GROK_API_KEY || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ message: 'API key not configured on server' });
    }
    
    console.log('Using Grok API key (first 5 chars):', apiKey.substring(0, 5));
    
    // Call Grok API
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting patient information from images of medical documents, IDs, and insurance cards."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all patient information from this image. Return ONLY a valid JSON object with these fields (leave empty if not found): firstName, lastName, dateOfBirth (YYYY-MM-DD format), gender, phone, email, address (with street, city, state, zipCode), insuranceId, insuranceProvider."
            },
            {
              type: "image",
              image_data: {
                data: base64Data,
                media_type: mediaType
              }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 1000
    };

    // Log request details for debugging
    console.log('Request details:', {
      endpoint: endpointUrl,
      model: requestBody.model,
      mediaType,
      contentLength: base64Data.length,
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
            data: extractedData
          });
        } catch (parseError) {
          console.error('Error parsing response content:', parseError);
          return res.status(500).json({ 
            message: 'Error parsing Grok API response', 
            rawContent: content
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
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Document Scanning Test</h1>
  <div class="container">
    <h2>Upload Image</h2>
    <input type="file" id="imageInput" accept="image/*">
    <div id="preview"></div>
    <button id="processBtn" disabled>Process Image</button>
    <div id="loading" class="loading">Processing... (this may take up to 30 seconds)</div>
    
    <div class="result">
      <h3>API Response:</h3>
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
        resultArea.textContent = JSON.stringify(data, null, 2);
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

export default router; 