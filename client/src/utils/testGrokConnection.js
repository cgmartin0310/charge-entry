/**
 * Test script to verify Grok API connection
 * 
 * This is a simple script that can be run with Node.js to test
 * if the Grok API connection is working correctly.
 * 
 * To run this script:
 * 1. Navigate to the client directory in a terminal
 * 2. Make sure your REACT_APP_GROK_API_KEY is set in the environment
 * 3. Run: node src/utils/testGrokConnection.js
 */

// A very small base64 encoded test image (1x1 pixel)
const TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testGrokConnection() {
  try {
    console.log('Starting Grok API connection test...');
    
    // Get API key from environment
    const apiKey = process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('Error: REACT_APP_GROK_API_KEY environment variable not found');
      console.log('Make sure to set the environment variable before running this test');
      console.log('Example: export REACT_APP_GROK_API_KEY=your-api-key-here');
      return;
    }
    
    console.log('API Key found, first 5 chars:', apiKey.substring(0, 5));
    
    // Testing both possible endpoints
    const endpoints = [
      'https://api.groq.com/openai/v1/chat/completions',
      'https://api.grok.ai/v1/vision/analyze'
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
          // For custom Grok API
          const base64Data = TEST_IMAGE.split('base64,')[1];
          requestBody = {
            image: base64Data,
            analysis_type: 'document',
            extraction_fields: ['text'],
            output_format: 'json'
          };
        }
        
        console.log('Sending request...');
        
        const response = await fetch(endpoint, {
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
        console.log('Response headers:', headers);
        
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