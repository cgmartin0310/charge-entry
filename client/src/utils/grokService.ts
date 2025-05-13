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
const USE_MOCK_DATA = true; // Temporarily set to true while we debug the API integration

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
    
    console.log('API Key found, length:', apiKey.length);
    console.log('API Key first 5 chars:', apiKey.substring(0, 5));
    console.log('Preparing to send image to Grok API...');
    
    // Extract the base64 data from the data URL
    let base64Data = imageData;
    const parts = imageData.split('base64,');
    if (parts.length > 1) {
      base64Data = parts[1];
      console.log('Extracted base64 data length:', base64Data.length);
    } else {
      console.warn('Could not find base64 data in the image URL');
    }
    
    console.log('Sending request to Grok API...');
    
    // The actual implementation may vary depending on Grok's API documentation
    // For now, let's try to log as much information as possible for debugging
    
    try {
      // For debugging purposes, let's try multiple possible Grok API endpoints
      
      // Option 1: The endpoint we tried before
      const endpointUrl = 'https://api.grok.ai/v1/vision/analyze';
      console.log('Using API endpoint:', endpointUrl);
      
      const requestBody = {
        image: base64Data,
        analysis_type: 'document',
        extraction_fields: [
          'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 
          'email', 'address', 'insuranceId', 'insuranceProvider'
        ],
        output_format: 'json'
      };
      
      console.log('Request body structure:', 
        JSON.stringify({
          ...requestBody,
          image: base64Data.substring(0, 20) + '...[truncated]'
        })
      );
      
      // Let's add a timeout to the fetch call
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
      console.log('Response headers:', JSON.stringify(Object.fromEntries([...response.headers])));
      
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

      const responseText = await response.text();
      console.log('Raw response text:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Response parsed as JSON:', JSON.stringify(data).substring(0, 200) + '...');
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error('Invalid JSON response from API');
      }
      
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
    console.log('Parsing Grok response structure:', Object.keys(apiResponse));
    
    // The parsing logic will depend on Grok's actual response format
    // This is a placeholder assuming a specific format - adjust as needed
    const result: ExtractedPatientData = {
      address: {}
    };
    
    if (apiResponse.extracted_data) {
      console.log('Found extracted_data in response');
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
    } else if (apiResponse.result && apiResponse.result.extracted_data) {
      // Alternative response structure
      console.log('Found result.extracted_data in response');
      const data = apiResponse.result.extracted_data;
      // Process similarly to above...
      result.firstName = data.first_name || data.firstName;
      result.lastName = data.last_name || data.lastName;
      // ... and so on
    } else if (apiResponse.data) {
      // Another possible structure
      console.log('Found data in response');
      const data = apiResponse.data;
      // Process similarly...
    }
    
    // Fallback for plain text/alternative formats
    if (apiResponse.text || apiResponse.result?.text) {
      console.log('Attempting to parse as key-value pairs from text...');
      const text = apiResponse.text || apiResponse.result?.text;
      const lines = text.split('\n');
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