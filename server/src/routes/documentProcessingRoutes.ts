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
    
    // Call Grok API with fixed request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting information from images. Your task is to extract ONLY information that is explicitly visible in the image. NEVER make up or generate information that is not visibly present. Leave fields empty if the information is not clearly visible in the image. Do not hallucinate data. Do not assume or generate placeholder data."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ONLY the information that is explicitly visible in this patient ID/insurance card image. Do not generate, assume, or make up ANY information that is not clearly visible in the image.\n\nReturn a JSON object with these fields, leaving fields EMPTY if the information is not present:\n- firstName: (leave empty if not visible)\n- lastName: (leave empty if not visible)\n- dateOfBirth: in YYYY-MM-DD format (leave empty if not visible)\n- gender: (leave empty if not visible)\n- phone: (leave empty if not visible)\n- email: (leave empty if not visible)\n- address: with street, city, state, zipCode (leave any/all empty if not visible)\n- insuranceId: (leave empty if not visible)\n- insuranceProvider: (leave empty if not visible)\n\nDo NOT fabricate data. If you cannot read something clearly, leave that field empty. Never generate example/mock data."
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
    .container { border: 1px solid #ccc; padding: 20px; border-radius: 5px; }
    .image-preview { max-width: 100%; max-height: 300px; margin-top: 10px; }
    .result { margin-top: 20px; white-space: pre-wrap; word-break: break-all; }
    .raw-output { margin-top: 20px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
    button { margin-top: 10px; padding: 8px 16px; }
    .loading { display: none; margin-top: 10px; }
    .note { background-color: #fffde7; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffd600; }
  </style>
</head>
<body>
  <h1>Document Scanning Test</h1>
  
  <div class="note">
    <p><strong>Important:</strong> The AI model will only extract information that is clearly visible in the image. Fields without visible information will be left empty.</p>
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
    const sampleImageBase64 = 'data:image/png;base64,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';
    
    console.log('Testing with sample insurance card image');
    
    // Call Grok API with fixed request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting information from images. Your task is to extract ONLY information that is explicitly visible in the image. NEVER make up or generate information that is not visibly present. Leave fields empty if the information is not clearly visible in the image. Do not hallucinate data. Do not assume or generate placeholder data."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ONLY the information that is explicitly visible in this insurance card image. Do not generate, assume, or make up ANY information that is not clearly visible in the image.\n\nReturn a JSON object with these fields, leaving fields EMPTY if the information is not present:\n- firstName: (leave empty if not visible)\n- lastName: (leave empty if not visible)\n- dateOfBirth: in YYYY-MM-DD format (leave empty if not visible)\n- gender: (leave empty if not visible)\n- phone: (leave empty if not visible)\n- email: (leave empty if not visible)\n- address: with street, city, state, zipCode (leave any/all empty if not visible)\n- insuranceId: (leave empty if not visible)\n- insuranceProvider: (leave empty if not visible)\n\nDo NOT fabricate data. If you cannot read something clearly, leave that field empty. Never generate example/mock data."
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
      temperature: 0.1,
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
    const base64Data = imageBuffer.toString('base64');
    
    // Determine media type from file extension or default to jpeg
    let mediaType = 'image/jpeg';
    if (imagePath.toLowerCase().endsWith('.png')) {
      mediaType = 'image/png';
    }
    
    console.log('Testing with local image file');
    
    // Call Grok API
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting patient information from images of medical documents, IDs, and insurance cards. You are extremely thorough and will extract every possible piece of information from the image, even if it's partially visible or unclear. Never leave fields blank if there's any text visible that might be relevant."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a patient identification or insurance card image. Extract ALL visible patient and insurance information from this image. Look very carefully for text that represents: name, date of birth, gender, ID numbers, phone numbers, email addresses, street addresses, cities, states, postal codes, insurance details, member IDs, group numbers, etc. Return a JSON object with these fields (even partial matches should be included): firstName, lastName, dateOfBirth (YYYY-MM-DD format), gender, phone, email, address (with street, city, state, zipCode), insuranceId, insuranceProvider. Be very thorough and don't leave any text unidentified."
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
      temperature: 0.1,
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
    
    // Call Grok API with fixed request format
    const endpointUrl = 'https://api.x.ai/v1/chat/completions';
    
    const requestBody = {
      model: "grok-2-vision",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting information from images. Your task is to extract ONLY information that is explicitly visible in the image. NEVER make up or generate information that is not visibly present. Leave fields empty if the information is not clearly visible in the image. Do not hallucinate data. Do not assume or generate placeholder data."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ONLY the information that is explicitly visible in this patient ID/insurance card image. Do not generate, assume, or make up ANY information that is not clearly visible in the image.\n\nReturn a JSON object with these fields, leaving fields EMPTY if the information is not present:\n- firstName: (leave empty if not visible)\n- lastName: (leave empty if not visible)\n- dateOfBirth: in YYYY-MM-DD format (leave empty if not visible)\n- gender: (leave empty if not visible)\n- phone: (leave empty if not visible)\n- email: (leave empty if not visible)\n- address: with street, city, state, zipCode (leave any/all empty if not visible)\n- insuranceId: (leave empty if not visible)\n- insuranceProvider: (leave empty if not visible)\n\nDo NOT fabricate data. If you cannot read something clearly, leave that field empty. Never generate example/mock data."
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

    console.log('Request details for Test_Patient.jpg - request format:', JSON.stringify(requestBody.messages[1].content));
    
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