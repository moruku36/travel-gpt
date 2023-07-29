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

  const handleSubmit = (e) => {
    e.preventDefault();
    // Call ChatGPT API to generate travel plan
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
