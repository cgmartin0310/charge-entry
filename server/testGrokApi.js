/**
 * Test script to verify Grok API connection
 * 
 * Run this script with:
 * node testGrokApi.js YOUR_API_KEY
 */

// Import the fetch API for Node.js environments that don't have it globally
let fetchModule;
try {
  // Check if fetch is available globally (Node.js 18+ or browser)
  if (typeof fetch === 'undefined') {
    // If not available globally, try to import it
    fetchModule = require('node-fetch');
  }
} catch (error) {
  console.error('Error importing node-fetch:', error.message);
  console.error('Please make sure you have installed node-fetch:');
  console.error('npm install --save node-fetch');
  process.exit(1);
}

// Use the appropriate fetch function
const fetchFn = typeof fetch !== 'undefined' ? fetch : fetchModule.default;

// A very small base64 encoded test image (1x1 pixel)
const TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testGrokConnection() {
  try {
    console.log('Starting Grok API connection test...');
    
    // Get API key from command line argument or environment
    const apiKey = process.argv[2] || process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('Error: API key not provided');
      console.log('Usage: node testGrokApi.js YOUR_API_KEY');
      console.log('Or set REACT_APP_GROK_API_KEY in your environment');
      return;
    }
    
    console.log('API Key found, first 5 chars:', apiKey.substring(0, 5));
    
    // Testing both possible endpoints
    const endpoints = [
      'https://api.groq.com/openai/v1/chat/completions',
      'https://api.x.ai/v1/chat/completions'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTesting endpoint: ${endpoint}`);
      
      try {
        let requestBody;
        
        if (endpoint.includes('groq.com')) {
          // For Groq API
          requestBody = {
            model: "llama3-70b-8192",
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant."
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What's in this image? Just reply with a single word."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: TEST_IMAGE
                    }
                  }
                ]
              }
            ],
            temperature: 0.2,
            max_tokens: 100
          };
        } else {
          // For xAI API - use the same chat completions format
          const base64Data = TEST_IMAGE.split('base64,')[1];
          requestBody = {
            model: "grok-2-vision",
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant."
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What's in this image? Just reply with a single word."
                  },
                  {
                    type: "image",
                    image_data: {
                      data: base64Data,
                      media_type: "image/png"
                    }
                  }
                ]
              }
            ],
            temperature: 0.2,
            max_tokens: 100
          };
        }
        
        console.log('Sending request...');
        
        const response = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        console.log('Response headers:', JSON.stringify(headers, null, 2));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          console.log('This endpoint failed.');
        } else {
          const data = await response.json();
          console.log('Success! Response:', JSON.stringify(data, null, 2));
          console.log('This endpoint is working correctly!');
        }
      } catch (error) {
        console.error(`Error testing ${endpoint}:`, error.message);
      }
    }
    
    console.log('\nTest completed. Check the logs above to see which endpoint worked.');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testGrokConnection(); 