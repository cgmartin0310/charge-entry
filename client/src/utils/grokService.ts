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

/**
 * Process an image using Grok API to extract patient information
 * 
 * @param imageData Base64 encoded image data
 * @returns Extracted patient data
 */
export const extractPatientDataFromImage = async (imageData: string): Promise<ExtractedPatientData> => {
  try {
    // Real Grok API integration using OpenAI's GPT-4 Vision API
    const apiKey = process.env.REACT_APP_GROK_API_KEY;
    
    if (!apiKey) {
      throw new Error('API key not found. Please check environment variables.');
    }
    
    console.log('Sending image to GPT-4 Vision API...');
    
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
                  url: imageData
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error details:', errorData);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response received from GPT-4 Vision API');
    return parseAPIResponse(data);
  } catch (error) {
    console.error('Error extracting patient data:', error);
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
    }
    
    // If no JSON found, return empty object
    console.error('Could not extract JSON from response');
    return {};
    
  } catch (error) {
    console.error('Error parsing response:', error);
    return {};
  }
}; 