import axios from 'axios';

declare var process: {
  env: {
    NODE_ENV: string;
  };
};

async function generatePlan(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
      prompt: prompt,
      max_tokens: 500,
    }, {
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
        'Authorization': `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`
      }
    });

    return response.data.choices[0].text;
  } catch (error) {
    console.error('Error during OpenAI API request:', error);
    throw error;  // Re-throw the error so it can be handled by the caller
  }
}