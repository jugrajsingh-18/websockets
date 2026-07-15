import { useEffect, useRef, useState } from "react";
import { connectWS } from "./ws";


const RESPONSE_TIMEOUT_MS = 8000;

let toastId = 0;

export default function App() {
  const socket = useRef(null);

  const [stage, setStage] = useState("name");
  const [userName, setUserName] = useState("");
  const [inputName, setInputName] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState([]);

  function pushToast(message) {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }

  useEffect(() => {
    socket.current = connectWS();

    socket.current.on("connect", () => {
      // RESPONSE TO OUR OWN createRoom EMIT
      socket.current.on("roomCreated", ({ roomCode: code }) => {
        setIsCreatingRoom(false);
        setRoomCode(code);
        setStage("chat");
      });

      // RESPONSE TO OUR OWN joinRoom EMIT
      socket.current.on("joinedRoom", ({ roomCode: code }) => {
        setIsJoiningRoom(false);
        setRoomCode(code);
        setStage("chat");
      });

      // BROADCAST TO EVERYONE ELSE IN THE ROOM WHEN SOMEONE JOINS
      socket.current.on("userJoined", (payload) => {
        pushToast(payload.message || `${payload.username} joined the room`);
      });

      // BROADCAST TO THE WHOLE ROOM (INCLUDING SELF) ON LEAVE/DISCONNECT
      socket.current.on("userLeft", (payload) => {
        if (payload.userId === socket.current.id) return; // don't toast ourselves
        pushToast(payload.message || `${payload.username} left the room`);
      });

      // BROADCAST TO THE WHOLE ROOM (INCLUDING SENDER) ON NEW MESSAGE
      socket.current.on("newMessage", (payload) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `${payload.userId}-${payload.timestamp}`,
            userId: payload.userId,
            sender: payload.username,
            text: payload.message,
            ts: payload.timestamp,
          },
        ]);
      });
    });

    return () => {
      socket.current.off("roomCreated");
      socket.current.off("joinedRoom");
      socket.current.off("userJoined");
      socket.current.off("userLeft");
      socket.current.off("newMessage");
    };
  }, []);

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    const trimmed = inputName.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setStage("lobby");
  }

  
  function handleCreateRoom() {
    setIsCreatingRoom(true);
    setJoinError("");

    setTimeout(() => {
      
      setIsCreatingRoom((stillCreating) => {
        if (stillCreating) {
          pushToast("Couldn't create a room. Please try again.");
        }
        return false;
      });
    }, RESPONSE_TIMEOUT_MS);

    socket.current.emit("createRoom", { username: userName });
  }

  function handleJoinRoom(e) {
    e.preventDefault();
    const code = joinCodeInput.trim();
    if (code.length !== 6) {
      setJoinError("Enter the 6-digit room code.");
      return;
    }
    setJoinError("");
    setIsJoiningRoom(true);

    setTimeout(() => {
      setIsJoiningRoom((stillJoining) => {
        if (stillJoining) {
          setJoinError("Server didn't respond. Please try again.");
        }
        return false;
      });
    }, RESPONSE_TIMEOUT_MS);

    socket.current.emit("joinRoom", { roomCode: code, username: userName });
  }

  function handleCodeInputChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
    setJoinCodeInput(digitsOnly);
    if (joinError) setJoinError("");
  }

  
  function sendMessage() {
    const t = text.trim();
    if (!t) return;
    socket.current.emit("sendMessage", { roomCode, message: t });
    setText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleLeaveRoom() {
    socket.current.emit("leaveRoom", { roomCode });
    setMessages([]);
    setRoomCode("");
    setJoinCodeInput("");
    setStage("lobby");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4 font-inter">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#303030] text-white text-xs px-4 py-2 rounded-full shadow-md"
          >
            {t.message}
          </div>
        ))}
      </div>

      {stage === "name" && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h1 className="text-xl font-semibold text-black">Enter your name</h1>
            <p className="text-sm text-gray-500 mt-1">
              This is how others in the room will see you.
            </p>
            <form onSubmit={handleNameSubmit} className="mt-4">
              <input
                autoFocus
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 outline-green-500 placeholder-gray-400"
                placeholder="Your name (e.g. John Doe)"
              />
              <button
                type="submit"
                className="block ml-auto mt-3 px-4 py-1.5 rounded-full bg-green-500 text-white font-medium cursor-pointer"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      )}

      {stage === "lobby" && (
        <div className="fixed inset-0 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h1 className="text-xl font-semibold text-black">
              Hey {userName} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create a new private room or join one with a code.
            </p>

            <button
              onClick={handleCreateRoom}
              disabled={isCreatingRoom}
              className="w-full mt-5 px-4 py-3 rounded-lg bg-green-500 text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {isCreatingRoom ? "Creating room..." : "Create a room"}
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <form onSubmit={handleJoinRoom}>
              <label className="text-sm text-gray-600 font-medium">
                Join with a room code
              </label>
              <input
                value={joinCodeInput}
                onChange={handleCodeInputChange}
                inputMode="numeric"
                placeholder="6-digit code"
                className="w-full mt-2 border border-gray-200 rounded-md px-3 py-2 tracking-[0.3em] text-center font-mono outline-green-500 placeholder-gray-400 placeholder:tracking-normal placeholder:font-sans"
              />
              {joinError && (
                <p className="text-xs text-red-500 mt-1">{joinError}</p>
              )}
              <button
                type="submit"
                disabled={isJoiningRoom}
                className="w-full mt-3 px-4 py-3 rounded-lg border border-green-500 text-green-600 font-medium cursor-pointer disabled:opacity-60"
              >
                {isJoiningRoom ? "Joining room..." : "Join room"}
              </button>
            </form>
          </div>
        </div>
      )}

      {stage === "chat" && (
        <div className="w-full max-w-2xl h-[90vh] bg-white rounded-xl shadow-md flex flex-col overflow-hidden">
          {/* CHAT HEADER */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <div className="h-10 w-10 rounded-full bg-[#075E54] flex items-center justify-center text-white font-semibold">
              R
            </div>
            <div className="flex-1">
              <button
                onClick={handleCopyCode}
                title="Click to copy room code"
                className="text-sm font-medium text-[#303030] flex items-center gap-2 cursor-pointer"
              >
                Room <span className="font-mono tracking-widest">{roomCode}</span>
                <span className="text-[11px] text-green-600">
                  {copied ? "Copied!" : "Copy"}
                </span>
              </button>

              <div className="text-xs text-gray-400">
                Signed in as {userName}
              </div>
            </div>
            <button
              onClick={handleLeaveRoom}
              className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5 cursor-pointer hover:bg-gray-50"
            >
              Leave room
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-100 flex flex-col">
            {messages.length === 0 && (
              <div className="m-auto text-sm text-gray-400 text-center">
                No messages yet. Share code{" "}
                <span className="font-mono font-medium text-gray-500">
                  {roomCode}
                </span>{" "}
                with others to invite them in.
              </div>
            )}
            {messages.map((m) => {
              const mine = m.userId === socket.current?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] p-3 my-2 rounded-[18px] text-sm leading-5 shadow-sm ${
                      mine
                        ? "bg-[#DCF8C6] text-[#303030] rounded-br-2xl"
                        : "bg-white text-[#303030] rounded-bl-2xl"
                    }`}
                  >
                    <div className="break-words whitespace-pre-wrap">{m.text}</div>
                    <div className="flex justify-between items-center mt-1 gap-16">
                      <div className="text-[11px] font-bold">{m.sender}</div>
                      <div className="text-[11px] text-gray-500 text-right">
                        {formatTime(m.ts)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-4 border border-gray-200 rounded-full">
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="w-full resize-none px-4 py-4 text-sm outline-none"
              />
              <button
                onClick={sendMessage}
                className="bg-green-500 text-white px-4 py-2 mr-2 rounded-full text-sm font-medium cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}