import axios from 'axios';

declare var process: {
  env: {
    NODE_ENV: string;
  };
};

async function generatePlan(prompt) {
  const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
    prompt: prompt,
    max_tokens: 500,
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  return response.data.choices[0].text;
}
}
