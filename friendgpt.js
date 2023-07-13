import axios from 'axios'


    
const apiKey = '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';
// const prompt = 'Write me a song about Tanmoy.';
const maxTokens = 10;
const n = 1;
const temperature = 0.7;


async function getResponse(socket, data){


    await axios.post(
    'https://api.openai.com/v1/engines/text-davinci-003/completions',
    {
        prompt:data.message,
        max_tokens: maxTokens,
        n,
        temperature
    },
    {
        headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
        }
    }
    )
    .then(response => {
        const result = response.data.choices[0].text.trim();
        console.log('GPT API result:');
        data.message = result;
        socket.emit("sent_to_me_message", data);
        console.log(result);
        return result;
    })
    .catch(error => {
        console.error('Error:', error);
    });

}

export default getResponse