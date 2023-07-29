import { useState } from 'react';

function TravelForm() {
  const [input, setInput] = useState({
    startLocation: '',
    endLocation: '',
    duration: '',
    interests: '',
  });

  const handleChange = (e) => {
    setInput({
      ...input,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Call the ChatGPT API with the input data to generate a travel plan
    try {
      const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          prompt: `Generate a travel plan from ${input.startLocation} to ${input.endLocation} for ${input.duration} days with interests in ${input.interests}.`,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        console.error('API request failed with status', response.status);
        return;
      }
  
      const data = await response.json();
      // Log the entire response data
      console.log(data);
  
      // Check if choices exist in the response
      if (data.choices && data.choices.length > 0) {
        // Do something with the generated travel plan
        console.log(data.choices[0].text);
      } else {
        console.log('No choices returned from the API.');
      }
    } catch (error) {
      console.error('Error during OpenAI API request:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="startLocation" onChange={handleChange} placeholder="Start location" />
      <input type="text" name="endLocation" onChange={handleChange} placeholder="End location" />
      <input type="number" name="duration" onChange={handleChange} placeholder="Duration (days)" />
      <input type="text" name="interests" onChange={handleChange} placeholder="Interests" />
      <input type="submit" value="Generate Plan" />
    </form>
  );
}

export default TravelForm;
