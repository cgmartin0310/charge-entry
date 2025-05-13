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
    console.log('Image data length:', imageData.length);

    // Check if the image data is in the expected format (base64)
    if (!imageData.startsWith('data:image')) {
      console.error('Image format appears to be invalid');
      throw new Error('Invalid image format. Expected a base64 data URL');
    }

    // Get the base URL for the API (handle different environments)
    const baseApiUrl = process.env.NODE_ENV === 'production' 
      ? '' // Empty for same-origin in production
      : 'http://localhost:5002'; // For local development
    
    // Build the full endpoint URL
    const endpointUrl = `${baseApiUrl}/api/document-processing/analyze`;
    
    console.log('Sending request to document processing API at:', endpointUrl);
    
    // Implement retry logic
    const maxRetries = 2;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`Retry attempt ${retryCount} of ${maxRetries}...`);
          // Add a short delay before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageData }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Clear the timeout if response arrives
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response text:', errorText);
          
          try {
            const errorData = JSON.parse(errorText);
            console.error('API error details:', JSON.stringify(errorData));
            
            if (errorData.message) {
              throw new Error(`Error: ${errorData.message}`);
            }
          } catch (parseError) {
            // If we can't parse the error as JSON, just use the status code
            console.error('Could not parse error response as JSON:', parseError);
          }
          
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Response received from document processing API');
        
        if (data.success && data.data) {
          return data.data;
        } else {
          console.error('Unexpected response format:', data);
          throw new Error('Invalid response format from server');
        }
      } catch (fetchError: any) {
        console.error(`Attempt ${retryCount + 1} failed:`, fetchError.message);
        lastError = fetchError;
        retryCount++;
        
        // Don't retry if it's a specific error that won't be fixed by retrying
        if (fetchError.message && (
            fetchError.message.includes('No image data provided') || 
            fetchError.message.includes('Invalid image format')
          )) {
          throw fetchError;
        }
        
        // If we've hit max retries, throw the last error
        if (retryCount > maxRetries) {
          console.error('All retry attempts failed');
          throw lastError;
        }
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw new Error('Unknown error occurred');
  } catch (error: any) {
    console.error('Error extracting patient data:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
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