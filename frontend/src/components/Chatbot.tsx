import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { IoChatbubbleEllipsesOutline, IoCloseOutline } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import { getChatbotModels, sendChatMessage } from "../services/api";

const ChatbotUi = () => {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi! Ask me for anime suggestions." },
  ]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<
    { id: string; label: string }[]
  >([]);
  const [selectedModel, setSelectedModel] = useState(
    "mistralai/devstral-2512:free"
  );

  const mutation = useMutation({
    mutationFn: (msg: string) => sendChatMessage(msg, selectedModel),
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

  const handleGetModels = async () => {
    try {
      const res = await getChatbotModels();
      const modelsArray = res.data.models || [];
      setAvailableModels(modelsArray);

      if (modelsArray.length > 0) {
        setSelectedModel(modelsArray[0].id);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  useEffect(() => {
    handleGetModels();
  }, []);

  const handleSendMessage = () => {
    if (input.trim()) {
      mutation.mutate(input);
    }
  };

  return (
    <div className="fixed bottom-4 right-8 z-50">
      {isOpen && (
        <div
          className={`
        fixed z-50 flex flex-col transition-all duration-300 ease-in-out
        /* Mobile: Full screen with small margins */
        bottom-0 right-0 left-0 top-0 m-0 rounded-none w-full h-full 
        /* Desktop: Floating widget style */
        md:bottom-4 md:right-8 md:left-auto md:top-auto md:m-0
        md:w-[400px] md:max-h-[700px] md:rounded-lg md:shadow-2xl md:border
        bg-card dark:bg-card border-gray-200 dark:border-gray-700
      `}
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
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-card mt-auto shrink-0">
            <div className="flex gap-2 items-center w-full">
              <input
                type="text"
                className="flex-1 min-w-0 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background-light dark:bg-background-dark text-text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={mutation.isPending}
              />

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-[10px] md:text-xs p-1.5 max-w-[80px] md:max-w-[120px] rounded border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark text-text outline-none cursor-pointer"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSendMessage}
                  className="bg-blue-600 text-white p-2 md:px-4 md:py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={mutation.isPending}
                >
                  <span className="hidden md:inline">Send</span>
                  <span className="md:hidden">➔</span>
                </button>
              </div>
            </div>
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
