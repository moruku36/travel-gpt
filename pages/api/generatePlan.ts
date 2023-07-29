import axios from 'axios';


async function generatePlan(prompt) {
  const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
    prompt: prompt,
    max_tokens: 500,
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.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}`
    }
  });

  return response.data.choices[0].text;
}
