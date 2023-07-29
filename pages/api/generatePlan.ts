import axios from 'axios';

export async function generatePlan(prompt: string) {
  const response = await axios.post(
    'https://api.openai.com/v1/engines/text-davinci-003/completions',
    {
      prompt,
      max_tokens: 500,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      },
    }
  );

  const data = await response.data;
  return data.choices[0].text;
}
