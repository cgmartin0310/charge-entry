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

    // Actual Grok API integration
    const apiKey = process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found in environment variables');
      throw new Error('API key not found. Please check environment variables.');
    }
    
    console.log('Preparing to send image to Grok API...');
    
    // Extract the base64 data from the data URL
    let base64Data = imageData;
    if (imageData.includes('base64,')) {
      base64Data = imageData.split('base64,')[1];
    }
    
    console.log('Sending request to Grok API...');
    
    try {
      // The actual Grok API endpoint and request format may be different
      // You'll need to adjust this based on Grok's actual API documentation
      const response = await fetch('https://api.grok.ai/v1/vision/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          image: base64Data,
          analysis_type: 'document',
          extraction_fields: [
            'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 
            'email', 'address', 'insuranceId', 'insuranceProvider'
          ],
          output_format: 'json'
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
      console.log('Response received from Grok API:', data);
      
      return parseGrokResponse(data);
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
 * Parses the Grok API response content
 * 
 * @param apiResponse Raw response from the Grok API
 * @returns Formatted patient data
 */
const parseGrokResponse = (apiResponse: any): ExtractedPatientData => {
  try {
    console.log('Parsing Grok response:', apiResponse);
    
    // The parsing logic will depend on Grok's actual response format
    // This is a placeholder assuming a specific format - adjust as needed
    const result: ExtractedPatientData = {
      address: {}
    };
    
    if (apiResponse.extracted_data) {
      const data = apiResponse.extracted_data;
      
      result.firstName = data.first_name || data.firstName;
      result.lastName = data.last_name || data.lastName;
      result.dateOfBirth = data.date_of_birth || data.dateOfBirth || data.dob;
      result.gender = data.gender;
      result.phone = data.phone || data.phone_number;
      result.email = data.email;
      
      if (data.address) {
        result.address = {
          street: data.address.street || data.address.line1,
          city: data.address.city,
          state: data.address.state,
          zipCode: data.address.zip_code || data.address.zipCode || data.address.zip
        };
      }
      
      result.insuranceId = data.insurance_id || data.insuranceId || data.member_id;
      result.insuranceProvider = data.insurance_provider || data.insuranceProvider;
      
      return result;
    }
    
    // Fallback for plain text/alternative formats
    if (apiResponse.text) {
      console.log('Attempting to parse as key-value pairs from text...');
      const lines = apiResponse.text.split('\n');
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
    }
    
    if (result.firstName || result.lastName) {
      console.log('Extracted data:', result);
      return result;
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