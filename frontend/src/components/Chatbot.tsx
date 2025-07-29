import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { IoChatbubbleEllipsesOutline, IoCloseOutline } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import { sendChatMessage } from "../services/api";

const ChatbotUi = () => {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi! Ask me for anime suggestions." },
  ]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: sendChatMessage,
    onMutate: (message) => {
      setMessages((prev) => [...prev, { from: "user", text: message }]);
      setInput("");
    },
    onSuccess: (data) => {
      const botMsg = { from: "bot", text: data.data.results || "No reply." };
      setMessages((prev) => [...prev, botMsg]);
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error sending message:",
          error.response?.data || error.message
        );
      } else {
        console.error("Error sending message:", error.message);
      }
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Sorry, I couldn't get a response." },
      ]);
    },
  });

  const handleSendMessage = () => {
    if (input.trim()) {
      mutation.mutate(input);
    }
  };

  return (
    <div className="fixed bottom-4 right-8 z-50">
      {isOpen && (
        <div
          className="resize-y overflow-auto bg-card dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-80 md:w-96 max-h-[80vh] min-h-[200px] flex flex-col"
          style={{ resize: "both", minWidth: "320px" }}
        >
          <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700 bg-primary rounded-t-lg">
            <h3 className="text-lg font-semibold text-text">NekoRec Chatbot</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setMessages([
                    { from: "bot", text: "Hi! Ask me for anime suggestions." },
                  ])
                }
                className="text-text-light hover:text-primary transition-colors text-sm"
              >
                Clear Chat
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-light hover:text-primary transition-colors duration-300"
              >
                <IoCloseOutline size={24} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`my-2 flex ${
                  msg.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <span
                  className={`px-4 py-2 rounded-lg max-w-[75%] ${
                    msg.from === "user"
                      ? "bg-accent text-white"
                      : "bg-card text-text dark:text-textLight"
                  }`}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </span>
              </div>
            ))}
            {mutation.isPending && (
              <div className="my-2 flex justify-start">
                <span className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 animate-pulse">
                  Typing...
                </span>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              disabled={mutation.isPending}
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={mutation.isPending}
            >
              Send
            </button>
          </div>
        </div>
      )}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-text-light p-4 rounded-full shadow-lg hover:bg-accent hover:text-text transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75"
          aria-label="Open Chatbot"
        >
          <IoChatbubbleEllipsesOutline size={28} />
        </button>
      )}
    </div>
  );
};

export default ChatbotUi;
