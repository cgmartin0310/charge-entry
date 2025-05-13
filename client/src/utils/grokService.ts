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
const USE_MOCK_DATA = false; // Set to true for testing without API calls

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

    // Check if the image data is in the expected format (base64)
    if (!imageData.startsWith('data:image')) {
      console.error('Image format appears to be invalid');
      throw new Error('Invalid image format. Expected a base64 data URL');
    }

    // Real Grok API integration using OpenAI's GPT-4 Vision API
    const apiKey = process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      throw new Error('API key not found. Please check environment variables.');
    }
    
    console.log('Preparing to send image to GPT-4 Vision API...');
    
    // Convert data URL to a format suitable for the API
    let processedImageData = imageData;
    
    // Check if we need to handle the data URL format
    if (imageData.includes('base64,')) {
      // Keep the full data URL for direct use
      processedImageData = imageData;
    }
    
    console.log('Sending request to GPT-4 Vision API...');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract patient information from this image. Include as many details as possible such as full name, date of birth, gender, address, phone, email, insurance ID, and insurance provider name. Return ONLY a valid JSON object with these fields: firstName, lastName, dateOfBirth (YYYY-MM-DD format), gender, phone, email, address (with street, city, state, zipCode), insuranceId, insuranceProvider."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: processedImageData
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('API error details:', errorData);
          
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
      console.log('Response received from GPT-4 Vision API:', data);
      
      if (!data || !data.choices || !data.choices[0]) {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid response format from API');
      }
      
      return parseAPIResponse(data);
    } catch (fetchError: any) {
      console.error('Fetch error details:', fetchError);
      
      // Provide helpful error messages for common issues
      if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error extracting patient data:', error.message, error.stack);
    throw error;
  }
};

/**
 * Parses the API response content
 * This extracts the JSON data from the text response
 * 
 * @param apiResponse Raw response from the Vision API
 * @returns Formatted patient data
 */
const parseAPIResponse = (apiResponse: any): ExtractedPatientData => {
  try {
    // Get the content from the response
    const content = apiResponse.choices[0].message.content;
    console.log('Parsing response content:', content);
    
    // Try to extract JSON from the response text
    // The response might be a mix of text and JSON
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      console.log('Extracted JSON:', jsonStr);
      
      try {
        const extractedData = JSON.parse(jsonStr);
        console.log('Parsed data:', extractedData);
        
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
        console.error('Failed JSON string:', jsonStr);
        throw new Error('Failed to parse JSON from API response');
      }
    }
    
    // If no JSON found, try to handle plain text response
    console.error('Could not extract JSON from response. Checking for fallback text format...');
    
    // If we can't find JSON, try to parse the content as plaintext
    if (content.includes(':')) {
      console.log('Attempting to parse as key-value pairs...');
      const result: ExtractedPatientData = {
        address: {}
      };
      
      // Try to extract key-value pairs from the text
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':', 2).map(s => s.trim());
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