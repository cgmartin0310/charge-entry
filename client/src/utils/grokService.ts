/**
 * Document Processing Service
 * 
 * This service handles the integration with AI document processing APIs
 * (Grok and OpenAI) for document scanning and patient information extraction.
 */

/**
 * Interface for the extracted patient data from document processing
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
 * Process an image using OpenAI Vision API to extract patient information
 * 
 * @param imageData Base64 encoded image data
 * @returns Extracted patient data
 */
export const extractPatientDataWithOpenAI = async (imageData: string): Promise<ExtractedPatientData> => {
  try {
    console.debug('Starting OpenAI document processing');
    
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

    console.debug('OpenAI: Image data format check:', imageData.substring(0, 50) + '...');
    console.debug('OpenAI: Image data length:', imageData.length);

    // Check if the image data is in the expected format (base64)
    if (!imageData.startsWith('data:image')) {
      console.error('Image format appears to be invalid');
      throw new Error('Invalid image format. Expected a base64 data URL');
    }

    // Get the base URL for the API (handle different environments)
    const baseApiUrl = process.env.NODE_ENV === 'production' 
      ? '' // Empty for same-origin in production
      : 'http://localhost:5002'; // For local development
    
    // Build the full endpoint URL for OpenAI processing
    const endpointUrl = `${baseApiUrl}/api/document-processing/process-openai`;
    
    console.debug('Sending request to OpenAI document processing API at:', endpointUrl);
    
    // Implement retry logic
    const maxRetries = 2;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.debug(`OpenAI retry attempt ${retryCount} of ${maxRetries}...`);
          // Add a short delay before retrying
          await new Promise(resolve => setTimeout(resolve, 1500 * retryCount));
        }
        
        console.debug('Setting up fetch request to OpenAI endpoint');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        console.debug('Preparing to send request to:', endpointUrl);
        console.debug('Request body length:', JSON.stringify({ imageData }).length);
        
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageData }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Clear the timeout if response arrives
        
        console.debug('OpenAI response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI API error response text:', errorText);
          
          try {
            const errorData = JSON.parse(errorText);
            console.error('OpenAI API error details:', JSON.stringify(errorData));
            
            if (errorData.message) {
              throw new Error(`Error: ${errorData.message}`);
            }
          } catch (parseError) {
            // If we can't parse the error as JSON, just use the status code
            console.error('Could not parse error response as JSON:', parseError);
          }
          
          throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        console.debug('Received OK response from OpenAI endpoint');
        const data = await response.json();
        console.debug('Response data structure:', Object.keys(data));
        
        // For OpenAI, we need to extract and map the data ourselves
        if (data.success && data.content) {
          console.debug('Data has success and content properties');
          // Map the raw OpenAI response to our structured format
          const extractedData = mapOpenAIResponseToPatientData(data.content);
          console.debug('Successfully mapped OpenAI response to patient data:', extractedData);
          return extractedData;
        } else {
          console.error('Unexpected response format from OpenAI:', data);
          throw new Error('Invalid response format from OpenAI server');
        }
      } catch (fetchError: any) {
        console.error(`OpenAI attempt ${retryCount + 1} failed:`, fetchError.message);
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
          console.error('All OpenAI retry attempts failed');
          throw lastError;
        }
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw new Error('Unknown error occurred with OpenAI processing');
  } catch (error: any) {
    console.error('Error extracting patient data with OpenAI:', error.message);
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

/**
 * Map raw OpenAI response to structured patient data
 * 
 * @param rawContent The raw text response from OpenAI
 * @returns Structured patient data
 */
export const mapOpenAIResponseToPatientData = (rawContent: string): ExtractedPatientData => {
  console.log('Mapping OpenAI response to patient data');
  console.log('Raw OpenAI content:', rawContent.substring(0, 200) + '...');
  
  // Initialize empty result
  const result: ExtractedPatientData = {
    address: {}
  };
  
  try {
    // Try to extract data from JSON format if available
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed JSON from OpenAI response:', jsonData);
        
        // Map the JSON fields to our format
        if (jsonData.firstName) result.firstName = jsonData.firstName;
        if (jsonData.lastName) result.lastName = jsonData.lastName;
        if (jsonData.dateOfBirth) result.dateOfBirth = formatDateString(jsonData.dateOfBirth);
        if (jsonData.gender) result.gender = jsonData.gender.toLowerCase();
        if (jsonData.phone) result.phone = jsonData.phone;
        if (jsonData.email) result.email = jsonData.email;
        
        // Address fields
        if (jsonData.address) {
          if (jsonData.address.street) result.address!.street = jsonData.address.street;
          if (jsonData.address.city) result.address!.city = jsonData.address.city;
          if (jsonData.address.state) result.address!.state = jsonData.address.state;
          if (jsonData.address.zipCode) result.address!.zipCode = jsonData.address.zipCode;
        }
        
        // Insurance fields
        if (jsonData.insuranceId) result.insuranceId = jsonData.insuranceId;
        if (jsonData.insuranceProvider) result.insuranceProvider = jsonData.insuranceProvider;
        
        return result;
      } catch (jsonError) {
        console.error('Failed to parse JSON from OpenAI response:', jsonError);
        // Continue with text parsing if JSON parsing fails
      }
    }
    
    // Extract data using text parsing
    // Extract name
    const nameMatch = rawContent.match(/[Nn]ame:?\s*([^\n]+)/);
    if (nameMatch) {
      const fullName = nameMatch[1].trim();
      const nameParts = fullName.split(' ');
      if (nameParts.length >= 2) {
        result.firstName = nameParts[0];
        result.lastName = nameParts[nameParts.length - 1];
      }
    }
    
    // Extract first name specifically
    const firstNameMatch = rawContent.match(/[Ff]irst\s*[Nn]ame:?\s*([^\n,]+)/);
    if (firstNameMatch) {
      result.firstName = firstNameMatch[1].trim();
    }
    
    // Extract last name specifically
    const lastNameMatch = rawContent.match(/[Ll]ast\s*[Nn]ame:?\s*([^\n,]+)/);
    if (lastNameMatch) {
      result.lastName = lastNameMatch[1].trim();
    }
    
    // Extract date of birth
    const dobMatch = rawContent.match(/[Dd]ate\s*[Oo]f\s*[Bb]irth:?\s*([^\n,]+)/) || 
                    rawContent.match(/[Bb]irth\s*[Dd]ate:?\s*([^\n,]+)/) ||
                    rawContent.match(/DOB:?\s*([^\n,]+)/);
    if (dobMatch) {
      result.dateOfBirth = formatDateString(dobMatch[1].trim());
    }
    
    // Extract gender
    const genderMatch = rawContent.match(/[Gg]ender:?\s*([^\n,]+)/);
    if (genderMatch) {
      const gender = genderMatch[1].trim().toLowerCase();
      result.gender = gender.includes('male') ? (gender.includes('female') ? 'female' : 'male') : gender;
    }
    
    // Extract phone
    const phoneMatch = rawContent.match(/[Pp]hone:?\s*([^\n,]+)/) ||
                      rawContent.match(/[Tt]elephone:?\s*([^\n,]+)/) ||
                      rawContent.match(/[Pp]hone\s*[Nn]umber:?\s*([^\n,]+)/);
    if (phoneMatch) {
      result.phone = phoneMatch[1].trim();
    }
    
    // Extract email
    const emailMatch = rawContent.match(/[Ee]mail:?\s*([^\n,]+)/) ||
                      rawContent.match(/[Ee]mail\s*[Aa]ddress:?\s*([^\n,]+)/);
    if (emailMatch) {
      result.email = emailMatch[1].trim();
    }
    
    // Extract address - try to get the full address first
    const addressMatch = rawContent.match(/[Aa]ddress:?\s*([^\n]+)(?:\n[^\n:]+)*/);
    if (addressMatch) {
      const fullAddress = addressMatch[0].replace(/[Aa]ddress:?\s*/, '').trim();
      
      // Try to parse components from the full address
      const streetMatch = fullAddress.match(/^(.+?)(?:,|\n)/);
      if (streetMatch) {
        result.address!.street = streetMatch[1].trim();
      }
      
      const cityMatch = fullAddress.match(/,\s*([^,\n]+),\s*([A-Z]{2})\s*(\d{5})/);
      if (cityMatch) {
        result.address!.city = cityMatch[1].trim();
        result.address!.state = cityMatch[2].trim();
        result.address!.zipCode = cityMatch[3].trim();
      }
    }
    
    // Try to extract individual address components if full address parsing failed
    if (!result.address!.street) {
      const streetMatch = rawContent.match(/[Ss]treet:?\s*([^\n,]+)/) ||
                         rawContent.match(/[Ss]treet\s*[Aa]ddress:?\s*([^\n,]+)/);
      if (streetMatch) {
        result.address!.street = streetMatch[1].trim();
      }
    }
    
    if (!result.address!.city) {
      const cityMatch = rawContent.match(/[Cc]ity:?\s*([^\n,]+)/);
      if (cityMatch) {
        result.address!.city = cityMatch[1].trim();
      }
    }
    
    if (!result.address!.state) {
      const stateMatch = rawContent.match(/[Ss]tate:?\s*([^\n,]+)/);
      if (stateMatch) {
        result.address!.state = stateMatch[1].trim();
      }
    }
    
    if (!result.address!.zipCode) {
      const zipMatch = rawContent.match(/[Zz]ip:?\s*([^\n,]+)/) ||
                      rawContent.match(/[Zz]ip\s*[Cc]ode:?\s*([^\n,]+)/) ||
                      rawContent.match(/[Pp]ostal\s*[Cc]ode:?\s*([^\n,]+)/);
      if (zipMatch) {
        result.address!.zipCode = zipMatch[1].trim();
      }
    }
    
    // Extract insurance information
    const insuranceIdMatch = rawContent.match(/[Ii]nsurance\s*[Ii][Dd]:?\s*([^\n,]+)/) ||
                            rawContent.match(/[Mm]ember\s*[Ii][Dd]:?\s*([^\n,]+)/) ||
                            rawContent.match(/[Pp]olicy\s*[Nn]umber:?\s*([^\n,]+)/);
    if (insuranceIdMatch) {
      result.insuranceId = insuranceIdMatch[1].trim();
    }
    
    const insuranceProviderMatch = rawContent.match(/[Ii]nsurance\s*[Pp]rovider:?\s*([^\n,]+)/) ||
                                  rawContent.match(/[Ii]nsurance\s*[Cc]ompany:?\s*([^\n,]+)/) ||
                                  rawContent.match(/[Ii]nsurance:?\s*([^\n,]+)/);
    if (insuranceProviderMatch) {
      result.insuranceProvider = insuranceProviderMatch[1].trim();
    }
    
    console.log('Extracted patient data from text:', result);
    return result;
  } catch (error) {
    console.error('Error mapping OpenAI response to patient data:', error);
    return result; // Return whatever we could extract
  }
};

/**
 * Format date string to YYYY-MM-DD format
 * 
 * @param dateStr Date string in various formats
 * @returns Formatted date string or original if parsing fails
 */
const formatDateString = (dateStr: string): string => {
  try {
    // Handle common date formats
    
    // MM/DD/YYYY or MM-DD-YYYY
    const mdyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdyMatch) {
      const month = mdyMatch[1].padStart(2, '0');
      const day = mdyMatch[2].padStart(2, '0');
      let year = mdyMatch[3];
      
      // Handle 2-digit years
      if (year.length === 2) {
        const twoDigitYear = parseInt(year);
        year = twoDigitYear > 50 ? `19${year}` : `20${year}`;
      }
      
      return `${year}-${month}-${day}`;
    }
    
    // Month name format: January 1, 2000
    const monthNameMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (monthNameMatch) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.findIndex(m => 
        monthNameMatch[1].toLowerCase().includes(m)
      );
      
      if (monthIndex >= 0) {
        const month = (monthIndex + 1).toString().padStart(2, '0');
        const day = monthNameMatch[2].padStart(2, '0');
        const year = monthNameMatch[3];
        return `${year}-${month}-${day}`;
      }
    }
    
    // YYYY-MM-DD (already correct format)
    if (dateStr.match(/\d{4}-\d{2}-\d{2}/)) {
      return dateStr;
    }
    
    // Try standard Date parsing as fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Return original if all parsing fails
    return dateStr;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr; // Return original if parsing fails
  }
}; 