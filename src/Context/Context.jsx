import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axiosInstance, { fileUploadInstance } from '../utils/axios';

export const chatContext = createContext(null);

const socket = io(
  process.env.NODE_ENV === "production"
    ? "https://chatzone-backend.onrender.com"
    : "http://localhost:3000"
);

const Context = (props) => {
  const [username, setUsername] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [users, setUsers] = useState([]);
  const [toUser, setToUser] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  const [isAiTyping, setIsAiTyping] = useState(false);
  const AI_BOT_NAME = "Elva Ai";
  const messagesEndRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);


  const sentMessagesRef = useRef(new Set());

  // Helper function to safely check if value is array
  const safeArrayCheck = (arr) => {
    return Array.isArray(arr) ? arr : [];
  };


  const isDuplicateMessage = (newMessage, existingMessages) => {
    // Check if message ID exists in sent messages (for immediate duplicates)
    if (newMessage._id && sentMessagesRef.current.has(newMessage._id)) {
      return true;
    }

    return existingMessages.some(existingMsg => {
      // Check by ID first (most reliable)
      if (newMessage._id && existingMsg._id && newMessage._id === existingMsg._id) {
        return true;
      }

      // Check by content and timing (for messages without ID)
      const isSameContent =
        existingMsg.fromUser === newMessage.fromUser &&
        existingMsg.toUser === newMessage.toUser &&
        existingMsg.message === newMessage.message;

      // Check if timestamps are within 1 second of each other
      const timeDiff = Math.abs(
        new Date(existingMsg.timestamp || 0).getTime() -
        new Date(newMessage.timestamp || 0).getTime()
      );

      return isSameContent && timeDiff < 1000; // 1 second tolerance
    });
  };

  // ✅ ENHANCED: Add message with better duplicate prevention
  const addMessageToState = useCallback((newMessage) => {
    setMessages(prev => {
      const currentMessages = safeArrayCheck(prev);

      // Check for duplicates
      if (isDuplicateMessage(newMessage, currentMessages)) {
        console.log('🚫 Duplicate message detected, skipping:', newMessage._id);
        return prev;
      }

      // Add message ID to sent messages tracking
      if (newMessage._id) {
        sentMessagesRef.current.add(newMessage._id);
      }

      console.log('✅ Adding new message to state:', newMessage._id);
      return [...currentMessages, newMessage];
    });
  }, []);

  // Get AI chat history for context
  const getAiChatHistory = () => {
    return messages
      .filter(msg =>
        (msg.fromUser === username && msg.toUser === AI_BOT_NAME) ||
        (msg.fromUser === AI_BOT_NAME && msg.toUser === username)
      )
      .slice(-10) // Keep last 10 messages for context
      .map(msg => ({
        role: msg.fromUser === AI_BOT_NAME ? 'assistant' : 'user',
        content: msg.message
      }));
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Function to save AI message to database
  const saveAiMessage = useCallback(async (messageData) => {
    try {
      const response = await axiosInstance.post('/user/save-ai-message', messageData);
      if (response.data.success) {
        console.log('AI message saved successfully');
        return response.data;
      }
    } catch (error) {
      console.error("Error saving AI message:", error);
    }
  }, []);

  // Enhanced function to fetch unread messages and last messages
  const fetchUnreadAndLastMessages = useCallback(async () => {
    if (!username) return;

    try {
      console.log('🔄 Fetching unread messages for:', username);

      const response = await axiosInstance.get('/user/unread-messages', {
        params: { username }
      });

      if (response.data.success) {
        const newUnreadMessages = response.data.unreadCounts || {};
        const newLastMessages = response.data.lastMessages || {};

        console.log('📊 Received unread counts from server:', newUnreadMessages);
        console.log('📨 Received last messages from server:', newLastMessages);

        setUnreadMessages(newUnreadMessages);
        setLastMessages(newLastMessages);

        return { unreadMessages: newUnreadMessages, lastMessages: newLastMessages };
      }
    } catch (error) {
      console.error("❌ Error fetching unread messages:", error);
    }
  }, [username]);

  // Enhanced function to mark messages as read
  const markMessagesAsRead = useCallback(async (selectedUser) => {
    if (!selectedUser || !username) return;

    try {
      console.log(`📖 Marking messages as read from: ${selectedUser}`);

      const response = await axiosInstance.post('/user/mark-read', {
        senderId: selectedUser,
        receiverId: username
      });

      if (response.data.success) {
        console.log(`✅ Successfully marked messages as read from: ${selectedUser}`);

        setUnreadMessages(prev => {
          const updated = { ...prev };
          delete updated[selectedUser];
          return updated;
        });

        setTimeout(() => {
          fetchUnreadAndLastMessages();
        }, 500);
      }
    } catch (error) {
      console.error("❌ Error marking messages as read:", error);
    }
  }, [username, fetchUnreadAndLastMessages]);

  // Function to load all registered users
  const loadAllUsers = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/user/all-users');
      if (response.data) {
        const allUsersWithStatus = response.data
          .filter(userName => userName !== username && userName.trim() !== '')
          .map(userName => ({
            username: userName,
            isOnline: false,
            lastSeen: null
          }));

        // Add AI Friend at the top of the list
        const usersWithAI = [
          { username: AI_BOT_NAME, isOnline: true, isAiBot: true },
          ...allUsersWithStatus
        ];
        setUsers(usersWithAI);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }, [username, AI_BOT_NAME]);

  // ✅ IMPROVED: Load chat history with better duplicate prevention
  const loadChatHistory = useCallback(async () => {
    if (!username || !toUser) {
      console.log('Cannot load chat history: missing username or toUser');
      return;
    }

    console.log(`🔄 Loading chat history between ${username} and ${toUser}`);

    try {
      let response;
      let apiUrl;

      if (toUser === AI_BOT_NAME) {
        apiUrl = `/user/ai-messages?userId=${username}`;
        response = await axiosInstance.get(apiUrl);
      } else {
        apiUrl = `/user/messages?senderId=${username}&receiverId=${toUser}`;
        response = await axiosInstance.get(apiUrl);
      }

      if (response.data) {
        let messagesData = [];
        if (Array.isArray(response.data)) messagesData = response.data;
        else if (response.data.success && Array.isArray(response.data.messages)) messagesData = response.data.messages;

        const validMessages = messagesData.filter(msg => {
          if (!msg || !msg.fromUser || !msg.toUser || !msg.message) return false;
          return true;
        }).map(msg => {
          const normalizedMsg = {
            _id: msg._id || `${Date.now()}-${Math.random()}`,
            fromUser: msg.fromUser,
            toUser: msg.toUser,
            message: msg.message,
            timestamp: msg.timestamp || new Date().toISOString(),
            messageType: msg.messageType || 'text',
            fileInfo: msg.fileInfo || null // Ensure fileInfo is included
          };
          if (msg.messageType === 'file' && msg.fileInfo) {
            normalizedMsg.fileInfo = {
              fileName: msg.fileInfo.fileName || 'Unknown File',
              fileSize: msg.fileInfo.fileSize || 0,
              mimeType: msg.fileInfo.mimeType || 'application/octet-stream',
              fileUrl: msg.fileInfo.fileUrl || msg.message // Fallback to message if fileUrl missing
            };
          }
          return normalizedMsg;
        });

        sentMessagesRef.current.clear();
        setMessages(validMessages.filter(msg => msg.messageType !== 'file' || msg.fileInfo?.fileUrl));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("❌ Error loading chat history:", error);
      setMessages([]);
    }
  }, [username, toUser, AI_BOT_NAME]);

  // Better timing for loading chat history
  useEffect(() => {
    if (username && toUser && isInitialized && isRegistered) {
      console.log('🎯 Loading chat history for:', { username, toUser });

      const timer = setTimeout(() => {
        loadChatHistory();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [username, toUser, isInitialized, isRegistered, loadChatHistory]);

  // Main initialization effect
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing app...');
      try {
        const response = await axiosInstance.get("/user/auth/me");
        if (response.data && response.data.name) {
          console.log('👤 User authenticated:', response.data.name);
          setUsername(response.data.name);
          setIsRegistered(true);
          socket.emit("register-user", response.data.name);

          await loadAllUsers();
          const unreadData = await fetchUnreadAndLastMessages();

          setIsInitialized(true);
          console.log('✅ App initialization completed');
        } else {
          setUsername("");
          setIsRegistered(false);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("❌ Error fetching current user:", error);
        setUsername("");
        setIsRegistered(false);
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [loadAllUsers, fetchUnreadAndLastMessages]);

  // Periodic sync for unread messages
  useEffect(() => {
    if (username && isInitialized && isRegistered) {
      const syncInterval = setInterval(() => {
        console.log('🔄 Periodic sync: Fetching unread messages...');
        fetchUnreadAndLastMessages();
      }, 30000); // 30 seconds

      return () => clearInterval(syncInterval);
    }
  }, [username, isInitialized, isRegistered, fetchUnreadAndLastMessages]);

  // Add AI bot to users list
  useEffect(() => {
    if (username) {
      setUsers(prev => {
        const hasAiBot = prev.some(user =>
          (typeof user === 'object' ? user.username : user) === AI_BOT_NAME
        );
        if (!hasAiBot) {
          return [
            { username: AI_BOT_NAME, isOnline: true, isAiBot: true },
            ...prev
          ];
        }
        return prev;
      });
    }
  }, [username, AI_BOT_NAME]);

  // Mark messages as read when user selects a chat
  useEffect(() => {
    if (toUser && username && isInitialized) {
      const timer = setTimeout(() => {
        console.log(`📖 Marking messages as read for: ${toUser}`);
        markMessagesAsRead(toUser);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [toUser, username, isInitialized, markMessagesAsRead]);

  // Helper functions
  const getUnreadCount = (fromUser) => {
    return unreadMessages[fromUser] || 0;
  };

  const getLastMessage = (fromUser) => {
    return lastMessages[fromUser] || null;
  };

  const getOnlineUsers = () => {
    return users.filter(user => {
      const userObj = typeof user === 'object' ? user : { username: user, isOnline: true };
      return userObj.isOnline;
    });
  };

  const getTotalUnreadCount = () => {
    return Object.values(unreadMessages).reduce((total, count) => total + count, 0);
  };

  // ✅ CRITICAL FIX: Enhanced socket event listeners
  useEffect(() => {
    const handlePrivateMessage = (messageData) => {
      console.log('📨 Received private message:', messageData);

      // Only process if it's for this user and not sent by self
      if (messageData.toUser === username && messageData.fromUser !== username) {
        // Normalize message structure for duplicate check
        const normalizedMsg = {
          ...messageData,
          _id: messageData._id || `received-${Date.now()}-${Math.random()}`,
          fromUser: messageData.fromUser,
          toUser: messageData.toUser,
          message: messageData.message,
          timestamp: messageData.timestamp || new Date().toISOString(),
          messageType: messageData.messageType || 'text'
        };

        // Ensure file messages have proper structure
        if (normalizedMsg.messageType === 'file' && !normalizedMsg.fileInfo) {
          normalizedMsg.fileInfo = {
            fileName: 'Unknown File',
            fileSize: 0,
            mimeType: 'application/octet-stream'
          };
        }

        // Check for duplicate before adding
        setMessages(prev => {
          const isDuplicate = prev.some(
            msg =>
              (msg._id && normalizedMsg._id && msg._id === normalizedMsg._id) ||
              (
                msg.fromUser === normalizedMsg.fromUser &&
                msg.toUser === normalizedMsg.toUser &&
                msg.message === normalizedMsg.message &&
                Math.abs(new Date(msg.timestamp).getTime() - new Date(normalizedMsg.timestamp).getTime()) < 1000
              )
          );
          if (isDuplicate) {
            console.log('🚫 Duplicate message detected from socket, skipping:', normalizedMsg._id);
            return prev;
          }
          // Add to sentMessagesRef for future duplicate prevention
          if (normalizedMsg._id) {
            sentMessagesRef.current.add(normalizedMsg._id);
          }
          return [...prev, normalizedMsg];
        });
      }
    };

    const handleUpdateUsers = (usersWithStatus) => {
      if (Array.isArray(usersWithStatus)) {
        const filteredUsers = usersWithStatus
          .filter(user => {
            const userName = typeof user === 'object' ? user.username : user;
            return userName !== username && userName && userName.trim() !== '';
          })
          .map(user => {
            if (typeof user === 'object') {
              return {
                ...user,
                isOnline: user.isOnline !== undefined ? user.isOnline : true
              };
            } else {
              return {
                username: user,
                isOnline: true,
                lastSeen: new Date()
              };
            }
          });

        const usersWithAI = [
          { username: AI_BOT_NAME, isOnline: true, isAiBot: true },
          ...filteredUsers
        ];
        setUsers(usersWithAI);
      }
    };

    const handleUserDisconnected = (disconnectedUser) => {
      setUsers(prev => prev.map(user => {
        const userName = typeof user === 'object' ? user.username : user;
        if (userName === disconnectedUser) {
          return typeof user === 'object' ?
            { ...user, isOnline: false, lastSeen: new Date() } :
            { username: user, isOnline: false, lastSeen: new Date() };
        }
        return user;
      }));
    };

    const handleUserConnected = (connectedUser) => {
      setUsers(prev => {
        const existingUserIndex = prev.findIndex(user => {
          const userName = typeof user === 'object' ? user.username : user;
          return userName === connectedUser;
        });

        if (existingUserIndex !== -1) {
          const updatedUsers = [...prev];
          updatedUsers[existingUserIndex] = typeof prev[existingUserIndex] === 'object' ?
            { ...prev[existingUserIndex], isOnline: true, lastSeen: new Date() } :
            { username: prev[existingUserIndex], isOnline: true, lastSeen: new Date() };
          return updatedUsers;
        } else {
          if (connectedUser !== username) {
            return [...prev, { username: connectedUser, isOnline: true, lastSeen: new Date() }];
          }
        }
        return prev;
      });
    };

    // Add socket listeners
    socket.on("private-message", handlePrivateMessage);
    socket.on("update-users", handleUpdateUsers);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("private-message", handlePrivateMessage);
      socket.off("update-users", handleUpdateUsers);
      socket.off("user-disconnected", handleUserDisconnected);
      socket.off("user-connected", handleUserConnected);
    };
  }, [username, toUser, isInitialized, AI_BOT_NAME]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Function to send message to AI
  const sendToAI = useCallback(async (userMessage) => {
    try {
      setIsAiTyping(true);

      const userMessageData = {
        _id: `user-ai-${Date.now()}-${Math.random()}`,
        fromUser: username,
        toUser: AI_BOT_NAME,
        message: userMessage,
        timestamp: new Date().toISOString(),
        isAiBot: false
      };

      // Add user message to state
      addMessageToState(userMessageData);

      // Save user message to database
      await saveAiMessage(userMessageData);

      // Send to AI endpoint
      const response = await axiosInstance.post('/user/askSomething', {
        message: userMessage,
        chatHistory: getAiChatHistory(),
        senderId: username,
      });

      if (response.data.success) {
        const aiMessage = {
          _id: `ai-response-${Date.now()}-${Math.random()}`,
          fromUser: AI_BOT_NAME,
          toUser: username,
          message: response.data.response,
          timestamp: new Date().toISOString(),
          isAiBot: true,
        };

        // Add AI response to state
        addMessageToState(aiMessage);

        // Save AI message to database
        await saveAiMessage(aiMessage);

        // Update last message
        setLastMessages(prev => ({
          ...prev,
          [AI_BOT_NAME]: {
            message: response.data.response,
            timestamp: new Date().toISOString(),
            isFile: false
          }
        }));
      }
    } catch (error) {
      console.error("Error sending message to AI:", error);
      const errorMessage = {
        _id: `error-ai-${Date.now()}-${Math.random()}`,
        fromUser: AI_BOT_NAME,
        toUser: username,
        message: "Sorry, I'm having trouble responding right now. Please try again.",
        timestamp: new Date().toISOString(),
        isAiBot: true,
        isError: true
      };
      addMessageToState(errorMessage);
      await saveAiMessage(errorMessage);
    } finally {
      setIsAiTyping(false);
    }
  }, [username, getAiChatHistory, AI_BOT_NAME, saveAiMessage, addMessageToState]);

  const saveRegularMessage = useCallback(async (messageData) => {
    try {
      const response = await axiosInstance.post('/user/save-message', messageData);
      if (response.data.success) {
        console.log('Regular message saved successfully');
        return response.data;
      }
    } catch (error) {
      console.error("Error saving regular message:", error);
    }
  }, []);

  // ✅ CRITICAL FIX: Enhanced handleSend function
  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !toUser) return;

    // ✅ IMPORTANT: Generate unique ID for sent message
    const messageId = `sent-${Date.now()}-${Math.random()}-${username}`;

    const messageData = {
      _id: messageId,
      fromUser: username,
      toUser: toUser,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      if (toUser === AI_BOT_NAME) {
        const messageToSend = message.trim();
        setMessage("");
        await sendToAI(messageToSend);
      } else {
        setMessage("");

        // ✅ CRITICAL: Add to state immediately for sender
        addMessageToState(messageData);

        // Save to database
        await saveRegularMessage(messageData);

        // ✅ IMPORTANT: Emit with unique ID
        socket.emit("private-message", messageData);

        // Update last message
        setLastMessages(prev => ({
          ...prev,
          [toUser]: {
            message: messageData.message,
            timestamp: messageData.timestamp,
            isFile: false
          }
        }));
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // File upload function
  const handleFileUpload = async (file, onProgress) => {
    if (!toUser) {
      throw new Error('No recipient selected');
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size must be less than 50MB');
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error('Only image and video files are allowed');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('senderId', username);
    formData.append('receiverId', toUser);

    try {
      const response = await fileUploadInstance.post('/user/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
        timeout: 30000,
      });

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error('Upload failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timeout: The file upload took too long. Please try with a smaller file.');
      } else if (error.response?.status === 413) {
        throw new Error('File too large: The file exceeds the maximum allowed size.');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else {
        throw new Error('Failed to upload file: ' + error.message);
      }
    }
  };
  // Add this function after handleFileUpload
  const handleFileSend = async (file, onProgress) => {
    if (!toUser) throw new Error('No recipient selected');

    // Create a local preview URL for instant feedback
    const localUrl = URL.createObjectURL(file);

    const fileMessageId = `file-${Date.now()}-${Math.random()}-${username}`;
    const fileMessageData = {
      _id: fileMessageId,
      fromUser: username,
      toUser: toUser,
      message: localUrl, // Show preview instantly
      messageType: 'file',
      timestamp: new Date().toISOString(),
      fileInfo: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: localUrl // Local preview
      },
      isUploading: true
    };

    addMessageToState(fileMessageData);

    try {
      const uploadResponse = await handleFileUpload(file, onProgress);

      if (uploadResponse.success) {
        // ✅ Instead of adding a new message, update the existing one
        setMessages(prev =>
          prev.map(msg =>
            msg._id === fileMessageId
              ? {
                ...msg,
                isUploading: false,
                fileUrl: uploadResponse.fileUrl,
                message: uploadResponse.fileUrl,
                fileInfo: {
                  ...msg.fileInfo,
                  fileUrl: uploadResponse.fileUrl
                }
              }
              : msg
          )
        );
        // Emit to socket for receiver
        const finalFileMessage = {
          ...fileMessageData,
          isUploading: false,
          fileUrl: uploadResponse.fileUrl,
          message: uploadResponse.fileUrl, // Sirf file ka URL
          fileInfo: {
            ...fileMessageData.fileInfo,
            fileUrl: uploadResponse.fileUrl
          }
        };

        if (toUser !== AI_BOT_NAME) {
          socket.emit("private-message", finalFileMessage);
        }

        // Update last message
        setLastMessages(prev => ({
          ...prev,
          [toUser]: {
            message: `📎 ${file.name}`,
            timestamp: fileMessageData.timestamp,
            isFile: true
          }
        }));

        return uploadResponse;
      }
    } catch (error) {
      // Remove the uploading message on error
      setMessages(prev => prev.filter(msg => msg._id !== fileMessageId));
      throw error;
    }
  };

  // Registration function
  const register = async (userData) => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.post('/user/register', userData);
      if (response.status === 201 && response.data.user) {
        setUsername(response.data.user.name);
        setIsRegistered(true);
        return {
          success: true,
          user: response.data.user
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (credentials) => {
    try {
      const response = await axiosInstance.post('/user/login', credentials);
      if (response.status === 200 && response.data.user) {
        setUsername(response.data.user.name);
        setIsRegistered(true);
        return {
          success: true,
          user: response.data.user
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    try {
      await axiosInstance.post('/user/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUsername('');
      setIsRegistered(false);
      setIsLoading(false);
      setUnreadMessages({});
      setLastMessages({});
      setIsInitialized(false);
      setMessages([]);
      setToUser("");
      // ✅ Clear sent messages tracking on logout
      sentMessagesRef.current.clear();
    }
  };
  // Session validation function
  const validateSession = async () => {
    try {
      const response = await axiosInstance.get('/user/me');
      if (response.status === 200 && response.data) {
        setUsername(response.data.name);
        setIsRegistered(true);
        return { success: true, user: response.data };
      } else {
        setUsername('');
        setIsRegistered(false);
        return { success: false, error: 'Session invalid' };
      }
    } catch (error) {
      console.error('Session validation failed:', error);
      setUsername('');
      setIsRegistered(false);
      return {
        success: false,
        error: error.response?.data?.error || 'Session expired'
      };
    }
  };

  const contextValue = {
    // User state
    username,
    setUsername,
    isRegistered,
    setIsRegistered,
    senderId,
    setSenderId,
    receiverId,
    setReceiverId,
    isInitialized,
    isLoading,

    // Message state
    message,
    setMessage,
    messages,
    setMessages,
    messagesEndRef,

    // Users and chat
    users,
    toUser,
    setToUser,
    getOnlineUsers,

    // Unread messages and notifications
    unreadMessages,
    lastMessages,
    markMessagesAsRead,
    fetchUnreadAndLastMessages,
    getUnreadCount,
    getLastMessage,
    getTotalUnreadCount,

    // Authentication functions
    register,
    login,
    logout,
    validateSession,

    // Message functions
    handleSend,
    handleFileUpload,
    loadChatHistory,
    handleFileSend,
    loadAllUsers,
    saveAiMessage,
    saveRegularMessage,
    // AI Bot features
    AI_BOT_NAME,
    isAiTyping,
    sendToAI,
    // Socket connection
    socket
  };

  return (
    <chatContext.Provider value={contextValue}>
      {props.children}
    </chatContext.Provider>
  );
};

export default Context;