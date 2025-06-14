import React, { useState } from 'react';
import { Download, FileText, ImageIcon } from 'lucide-react';

const ChatMessages = ({ messages, username, toUser, formatTime, formatDate, messagesEndRef, AI_BOT_NAME }) => {
  const [brokenImages, setBrokenImages] = useState(new Set());

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

  const handleImageError = (messageId) => {
    console.log('Image load error for message:', messageId);
    setBrokenImages(prev => new Set([...prev, messageId]));
  };

  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('blob:')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const renderFileMessage = (message) => {
    const { fileInfo } = message;
    const isImage = fileInfo?.fileType?.startsWith('image/') || fileInfo?.mimeType?.startsWith('image/');
    const isVideo = fileInfo?.fileType?.startsWith('video/') || fileInfo?.mimeType?.startsWith('video/');
    const messageId = message._id || message.id;
    const isImageBroken = brokenImages.has(messageId);
    const fileUrl = fileInfo?.fileUrl || message.message;

    if (isImage) {
      if (!isValidImageUrl(fileUrl) || isImageBroken) {
        console.log('Rendering placeholder for unavailable image:', { messageId, fileUrl });
        return (
          <div className="max-w-xs lg:max-w-sm">
            <div className="bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] border-2 border-dashed border-gray-600">
              <ImageIcon size={32} className="text-gray-400 mb-2" />
              <span className="text-xs text-gray-400 text-center">
                Image unavailable
                <br />
                (File may have been moved or deleted)
              </span>
            </div>
            {fileInfo?.fileName && (
              <div className="text-xs text-gray-300 mt-2 flex items-center justify-between">
                <span className="truncate flex-1 mr-2">{fileInfo.fileName}</span>
                {isValidImageUrl(fileUrl) && (
                  <a
                    href={fileUrl}
                    download
                    className="flex-shrink-0 p-1 hover:bg-gray-600 rounded transition-colors"
                    title="Download"
                  >
                    <Download size={12} />
                  </a>
                )}
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="max-w-xs lg:max-w-sm">
          <img
            src={fileUrl}
            alt={fileInfo?.fileName || 'Shared image'}
            className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, '_blank')}
            onError={() => handleImageError(messageId)}
            loading="lazy"
          />
          {fileInfo?.fileName && (
            <div className="text-xs text-gray-300 mt-2 flex items-center justify-between">
              <span className="truncate flex-1 mr-2">{fileInfo.fileName}</span>
              <a
                href={fileUrl}
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
            onError={() => handleImageError(messageId)}
          >
            <source src={fileUrl} type={fileInfo?.fileType || fileInfo?.mimeType} />
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
                  href={fileUrl}
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
        {isValidImageUrl(fileUrl) && (
          <a
            href={fileUrl}
            download
            className="p-1 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
            title="Download"
          >
            <Download size={14} />
          </a>
        )}
      </div>
    );
  };

  const safeMessages = Array.isArray(messages) ? messages : [];
  
  const filteredMessages = safeMessages.filter((m) => {
    if (!m || typeof m !== 'object') {
      console.warn('Invalid message object:', m);
      return false;
    }
    
    if (!m.fromUser || !m.toUser) {
      console.warn('Message missing fromUser or toUser:', m);
      return false;
    }
    
    if (toUser === AI_BOT_NAME) {
      return (
        (m.fromUser === username && m.toUser === AI_BOT_NAME) ||
        (m.fromUser === AI_BOT_NAME && m.toUser === username)
      );
    }
    
    return (
      (m.fromUser === username && m.toUser === toUser) ||
      (m.fromUser === toUser && m.toUser === username)
    );
  });

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
      {toUser && sortedMessages.map((m, i) => {
        const messageTime = m.timestamp || m.timeStamp || new Date().toISOString();
        const isFileMessage = m.messageType === 'file' || m.isFile || false;
        const isOwnMessage = m.fromUser === username;
        const prevMessageTime = i > 0 ? 
          (sortedMessages[i - 1]?.timestamp || sortedMessages[i - 1]?.timeStamp || new Date().toISOString()) : 
          null;

        return (
          <div key={m._id || m.id || `msg-${i}-${Date.now()}`} className="flex flex-col">
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
            <div className={`px-3 py-3 rounded-2xl mb-1 max-w-[85%] lg:max-w-sm break-words ${
              isOwnMessage
                ? 'bg-green-800 text-white self-end ml-auto rounded-br-md'
                : 'bg-green-700/70 text-white self-start mr-auto rounded-bl-md'
            }`}>
              <div className="flex flex-col gap-1">
                {!isOwnMessage && (
                  <span className="font-medium text-blue-300 capitalize text-xs lg:text-sm">
                    {m.fromUser}
                  </span>
                )}
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
              <div className={`text-xs mt-2 ${
                isOwnMessage ? 'text-blue-200' : 'text-gray-300'
              } text-right`}>
                {formatTime(messageTime)}
              </div>
            </div>
          </div>
        );
      })}
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
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;