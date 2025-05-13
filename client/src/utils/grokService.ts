/**
 * Grok API Integration Service
 * 
 * This service handles the integration with Grok API for document scanning
 * and patient information extraction.
 */

/**
 * Interface for the extracted patient data from Grok API
 */
export interface ExtractedPatientData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  insuranceId?: string;
  insuranceProvider?: string;
}

// Flag to use mock data for testing purposes
const USE_MOCK_DATA = false; // Set to false to use the actual Grok API

/**
 * Process an image using Grok API to extract patient information
 * 
 * @param imageData Base64 encoded image data
 * @returns Extracted patient data
 */
export const extractPatientDataFromImage = async (imageData: string): Promise<ExtractedPatientData> => {
  try {
    // Use mock data if flag is set (for development/testing)
    if (USE_MOCK_DATA) {
      console.log('Using mock data instead of API call (for testing)');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
      return getMockPatientData();
    }

    // Validate image data format
    if (!imageData) {
      console.error('Image data is empty');
      throw new Error('No image data provided');
    }

    console.log('Image data format check:', imageData.substring(0, 50) + '...');

    // Check if the image data is in the expected format (base64)
    if (!imageData.startsWith('data:image')) {
      console.error('Image format appears to be invalid');
      throw new Error('Invalid image format. Expected a base64 data URL');
    }

    // Actual Grok API integration
    const apiKey = process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      throw new Error('API key not found. Please check environment variables.');
    }

    console.log('API Key found, preparing for Grok API call');
    
    // Extract the base64 data
    const base64Data = imageData.split('base64,')[1];
    
    console.log('Sending request to Grok API...');
    
    try {
      // Using xAI's Grok API for document analysis
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
                  media_type: "image/png"
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // Clear the timeout if response arrives
      
      console.log('Response status:', response.status);
      
      // Log headers without using spread operator
      const headerLog: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headerLog[key] = value;
      });
      console.log('Response headers:', JSON.stringify(headerLog));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('API error details:', JSON.stringify(errorData));
          
          if (errorData.error && errorData.error.message) {
            throw new Error(`API error: ${errorData.error.message}`);
          }
        } catch (parseError) {
          // If we can't parse the error as JSON, just use the status code
          console.error('Could not parse error response as JSON:', parseError);
        }
        
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Response received from Grok API');
      
      return parseGrokResponse(data);
    } catch (fetchError: any) {
      console.error('Fetch error details:', fetchError);
      
      // Try to provide more specific error messages
      if (fetchError.name === 'AbortError') {
        throw new Error('API request timed out. The server took too long to respond.');
      } else if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection or the API endpoint may be unavailable.');
      } else if (fetchError.message && fetchError.message.includes('NetworkError')) {
        throw new Error('Network error. There might be a CORS issue or the API server is not accessible.');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error extracting patient data:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Parses the Grok API response content
 * 
 * @param apiResponse Raw response from the Grok API
 * @returns Formatted patient data
 */
const parseGrokResponse = (apiResponse: any): ExtractedPatientData => {
  try {
    console.log('Parsing Grok response');
    
    // For the Groq/LLM API, the content will be in the message content
    if (apiResponse.choices && apiResponse.choices[0]?.message?.content) {
      const content = apiResponse.choices[0].message.content;
      console.log('Found content in API response:', content.substring(0, 200) + '...');
      
      // Try to extract JSON from the response text
      // The response might be a mix of text and JSON
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log('Extracted JSON:', jsonStr);
        
        try {
          const extractedData = JSON.parse(jsonStr);
          
          // Map to our expected format
          return {
            firstName: extractedData.firstName || extractedData.first_name,
            lastName: extractedData.lastName || extractedData.last_name,
            dateOfBirth: extractedData.dateOfBirth || extractedData.date_of_birth || extractedData.dob,
            gender: extractedData.gender,
            phone: extractedData.phone || extractedData.phoneNumber || extractedData.phone_number,
            email: extractedData.email,
            address: {
              street: extractedData.address?.street || extractedData.street,
              city: extractedData.address?.city || extractedData.city,
              state: extractedData.address?.state || extractedData.state,
              zipCode: extractedData.address?.zipCode || extractedData.address?.zip || extractedData.zipCode || extractedData.zip
            },
            insuranceId: extractedData.insuranceId || extractedData.insurance_id || extractedData.memberId || extractedData.member_id,
            insuranceProvider: extractedData.insuranceProvider || extractedData.insurance_provider || extractedData.insurance
          };
        } catch (parseError) {
          console.error('Error parsing JSON from response:', parseError);
        }
      }
      
      // If JSON extraction failed, try to parse as key-value pairs
      console.log('Attempting to parse as key-value pairs...');
      if (content.includes(':')) {
        const result: ExtractedPatientData = {
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
              result.address!.street = value;
            } else if (normalizedKey === 'city') {
              result.address!.city = value;
            } else if (normalizedKey === 'state') {
              result.address!.state = value;
            } else if (normalizedKey.includes('zip')) {
              result.address!.zipCode = value;
            } else if (normalizedKey.includes('insurance id') || normalizedKey.includes('member id')) {
              result.insuranceId = value;
            } else if (normalizedKey.includes('insurance provider') || normalizedKey === 'provider') {
              result.insuranceProvider = value;
            }
          }
        }
        
        if (result.firstName || result.lastName) {
          console.log('Extracted data from text format:', result);
          return result;
        }
      }
    }
    
    // If no structured data could be found
    console.error('Could not extract structured data from response');
    return {};
    
  } catch (error) {
    console.error('Error parsing response:', error);
    return {};
  }
};

/**
 * Returns mock patient data for testing purposes
 * @returns Sample patient data
 */
const getMockPatientData = (): ExtractedPatientData => {
  return {
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: "1985-05-15",
    gender: "male",
    phone: "555-123-4567",
    email: "john.doe@example.com",
    address: {
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zipCode: "90210"
    },
    insuranceId: "INS12345678",
    insuranceProvider: "Blue Cross Blue Shield"
  };
}; 