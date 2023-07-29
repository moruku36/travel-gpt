import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import styles from './Chat.module.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const textareaRef = useRef();

  const sendMessage = async () => {
    const response = await axios.post(
      'https://api.openai.com/v1/engines/davinci-codex/completions',
      {
        prompt: newMessage,
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
    setMessages([...messages, { text: data.choices[0].text, sender: 'ChatGPT' }]);
    setNewMessage('');
  };

  const onKeyDown = useCallback(
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (event.currentTarget.value.length > 0) {
          sendMessage();
        }
      }
    },
    [sendMessage]
  );

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chat}>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="start place, end place, duration, interests..."
          className={styles.chatTextarea}
        />
        <button onClick={sendMessage} disabled={newMessage.length === 0} className={styles.chatButton}>
          {/* Replace with your own icon */}
          Send
        </button>
      </div>
      {messages.map((message, index) => (
        <p key={index}>
          {message.sender}: {message.text}
        </p>
      ))}
    </div>
  );
};

export default Chat;
