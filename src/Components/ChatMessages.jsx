import React from 'react';
import { Download, FileText } from 'lucide-react';

const ChatMessages = ({ messages, username, toUser, formatTime, formatDate, messagesEndRef, AI_BOT_NAME }) => {
  console.log('ChatMessages props:', { 
    messagesCount: messages?.length || 0, 
    username, 
    toUser, 
    AI_BOT_NAME,
    sampleMessages: messages?.slice(0, 2) 
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFileMessage = (message) => {
    const { fileInfo } = message;
    const isImage = fileInfo?.mimeType?.startsWith('image/');
    const isVideo = fileInfo?.mimeType?.startsWith('video/');

    if (isImage) {
      return (
        <div className="max-w-xs lg:max-w-sm">
          <img
            src={message.message}
            alt={fileInfo?.fileName || 'Shared image'}
            className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(message.message, '_blank')}
            loading="lazy"
          />
          {fileInfo?.fileName && (
            <div className="text-xs text-gray-300 mt-2 flex items-center justify-between">
              <span className="truncate flex-1 mr-2">{fileInfo.fileName}</span>
              <a
                href={message.message}
                download
                className="flex-shrink-0 p-1 hover:bg-gray-600 rounded transition-colors"
                title="Download"
              >
                <Download size={12} />
              </a>
            </div>
          )}
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="max-w-xs lg:max-w-sm">
          <video
            controls
            className="rounded-lg max-w-full h-auto"
            preload="metadata"
          >
            <source src={message.message} type={fileInfo?.mimeType} />
            Your browser does not support the video tag.
          </video>
          {fileInfo?.fileName && (
            <div className="text-xs text-gray-300 mt-2 flex items-center justify-between gap-2">
              <span className="truncate flex-1">{fileInfo.fileName}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {fileInfo.fileSize && (
                  <span className="text-gray-400">({formatFileSize(fileInfo.fileSize)})</span>
                )}
                <a
                  href={message.message}
                  download
                  className="p-1 hover:bg-gray-600 rounded transition-colors"
                  title="Download"
                >
                  <Download size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg max-w-xs lg:max-w-sm">
        <FileText size={20} className="text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {fileInfo?.fileName || 'Unknown file'}
          </div>
          {fileInfo?.fileSize && (
            <div className="text-xs text-gray-400">
              {formatFileSize(fileInfo.fileSize)}
            </div>
          )}
        </div>
        <a
          href={message.message}
          download
          className="p-1 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
          title="Download"
        >
          <Download size={14} />
        </a>
      </div>
    );
  };

  // Ensure messages is always an array and handle null/undefined cases
  const safeMessages = Array.isArray(messages) ? messages : [];
  
  // Filter messages for the current conversation
  const filteredMessages = safeMessages.filter((m) => {
    // Add comprehensive null checks
    if (!m || typeof m !== 'object') {
      console.warn('Invalid message object:', m);
      return false;
    }
    
    // Check for required message properties
    if (!m.fromUser || !m.toUser) {
      console.warn('Message missing fromUser or toUser:', m);
      return false;
    }
    
    // For AI chat conversations
    if (toUser === AI_BOT_NAME) {
      const isValidAiMessage = (
        (m.fromUser === username && m.toUser === AI_BOT_NAME) ||
        (m.fromUser === AI_BOT_NAME && m.toUser === username)
      );
      return isValidAiMessage;
    }
    
    // For regular user-to-user conversations
    const isValidRegularMessage = (
      (m.fromUser === username && m.toUser === toUser) ||
      (m.fromUser === toUser && m.toUser === username)
    );
    
    return isValidRegularMessage;
  });

  // Sort messages by timestamp to ensure proper chronological order
  const sortedMessages = filteredMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.timeStamp || 0);
    const timeB = new Date(b.timestamp || b.timeStamp || 0);
    return timeA - timeB;
  });

  console.log('Filtered and sorted messages:', {
    total: safeMessages.length,
    filtered: filteredMessages.length,
    sorted: sortedMessages.length,
    forUser: toUser,
    currentUser: username
  });

  return (
    <div className="flex-1 px-3 lg:px-6 py-4 space-y-3 pb-32 lg:pb-28 overflow-y-auto bg-zinc-950">
      {/* Show placeholder when no user is selected */}
      {!toUser && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="text-6xl lg:text-8xl mb-4 opacity-20">💬</div>
          <h3 className="text-xl lg:text-2xl font-semibold text-gray-300 mb-2">
            Select a chat to start messaging
          </h3>
          <p className="text-gray-500 text-sm lg:text-base">
            Choose from your contacts on the {window.innerWidth >= 1024 ? 'left' : 'user list'} to begin a conversation
          </p>
        </div>
      )}

      {/* Show messages when user is selected */}
      {toUser && sortedMessages.map((m, i) => {
        // Get timestamp with fallback options
        const messageTime = m.timestamp || m.timeStamp || new Date().toISOString();
        const isFileMessage = m.messageType === 'file' || m.isFile || false;
        const isOwnMessage = m.fromUser === username;
        
        // Get previous message timestamp for date comparison
        const prevMessageTime = i > 0 ? 
          (sortedMessages[i - 1]?.timestamp || sortedMessages[i - 1]?.timeStamp || new Date().toISOString()) : 
          null;

        return (
          <div key={m._id || m.id || `msg-${i}-${Date.now()}`} className="flex flex-col">
            {/* Show date separator when date changes */}
            {(i === 0 || (prevMessageTime && formatDate(messageTime) !== formatDate(prevMessageTime))) && (
              <div className="text-center text-xs text-gray-500 my-3 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative inline-block bg-zinc-950 px-3">
                  {formatDate(messageTime)}
                </div>
              </div>
            )}

            {/* Message bubble */}
            <div className={`px-3 py-3 rounded-2xl mb-1 max-w-[85%] lg:max-w-sm break-words ${
              isOwnMessage
                ? 'bg-green-800 text-white self-end ml-auto rounded-br-md'
                : 'bg-green-700/70 text-white self-start mr-auto rounded-bl-md'
            }`}>
              <div className="flex flex-col gap-1">
                {/* Show sender name for incoming messages */}
                {!isOwnMessage && (
                  <span className="font-medium text-blue-300 capitalize text-xs lg:text-sm">
                    {m.fromUser}
                  </span>
                )}
                
                {/* Message content */}
                <div className="flex-1">
                  {isFileMessage ? (
                    <div className="mt-1">
                      {renderFileMessage(m)}
                    </div>
                  ) : (
                    <span className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap">
                      {m.message || 'No message content'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Message timestamp */}
              <div className={`text-xs mt-2 ${
                isOwnMessage ? 'text-blue-200' : 'text-gray-300'
              } text-right`}>
                {formatTime(messageTime)}
              </div>
            </div>
          </div>
        );
      })}

      {/* Show empty state when no messages exist for selected user */}
      {toUser && sortedMessages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="text-4xl lg:text-6xl mb-4 opacity-30">👋</div>
          <h3 className="text-lg lg:text-xl font-semibold text-gray-300 mb-2">
            Start your conversation with {toUser}
          </h3>
          <p className="text-gray-500 text-sm lg:text-base">
            Send a message to begin chatting
          </p>
        </div>
      )}

      {/* Scroll anchor for auto-scroll to bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;