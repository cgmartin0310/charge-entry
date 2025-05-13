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
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: 'No image data provided' });
    }
    
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
          error: errorText
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