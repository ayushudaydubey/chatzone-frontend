import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, FileText, Image, Video, Clock, CheckCircle, XCircle } from 'lucide-react';

const ChatMessages = ({ 
  messages, 
  username, 
  toUser, 
  formatTime, 
  formatDate, 
  messagesEndRef, 
  AI_BOT_NAME,
  pendingMessages = [], // New prop for pending messages
  failedMessages = []   // New prop for failed messages
}) => {
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState(new Map()); // Track upload progress

  console.log('ChatMessages props:', { 
    messagesCount: messages?.length || 0, 
    pendingCount: pendingMessages?.length || 0,
    failedCount: failedMessages?.length || 0,
    username, 
    toUser, 
    AI_BOT_NAME
  });

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle image load errors
  const handleImageError = (messageId) => {
    console.log('Image load error for message:', messageId);
    setBrokenImages(prev => new Set([...prev, messageId]));
  };

  // Validate image URLs
  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('blob:')) return true; // Allow blob URLs for pending files
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
  };

  // Detect file type from MIME type or file extension
  const getFileType = (mimeType, fileName) => {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
    }
    
    // Fallback: check file extension
    const extension = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) return 'audio';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) return 'document';
    
    return 'file';
  };

  // Enhanced message key generation
  const generateMessageKey = (message, index, type = 'sent') => {
    if (message._id) return `${type}-${message._id}`;
    if (message.id) return `${type}-${message.id}`;
    if (message.tempId) return `${type}-${message.tempId}`;
    
    const contentKey = `${message.fromUser}-${message.toUser}-${message.message}-${message.timestamp || message.timeStamp}`;
    const hash = contentKey.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return `${type}-${Math.abs(hash)}-${index}`;
  };

  // Render progress bar for uploading files
  const renderProgressBar = (progress) => {
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };

  // Render status indicator
  const renderStatusIndicator = (status, isPending = false, isFailed = false) => {
    if (isFailed) {
      return (
        <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
          <XCircle size={12} />
          <span>Failed to send</span>
        </div>
      );
    }
    
    if (isPending) {
      return (
        <div className="flex items-center gap-1 text-blue-300 text-xs mt-1">
          <Clock size={12} className="animate-spin" />
          <span>Sending...</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-green-400 text-xs mt-1">
        <CheckCircle size={12} />
        <span>Sent</span>
      </div>
    );
  };

  // Render different types of file messages with status
  const renderFileMessage = (message, isPending = false, isFailed = false, progress = 0) => {
    const { fileInfo } = message;
    const messageId = message._id || message.id || message.tempId;
    const isImageBroken = brokenImages.has(messageId);
const fileUrl = fileInfo?.fileUrl || fileInfo?.url || fileInfo?.blobUrl || message.message;
// If message contains imagekit URL but no fileInfo, treat as file
if (!fileInfo && message.message && message.message.includes('imagekit.io')) {
  message.fileInfo = {
    fileName: 'Uploaded Image',
    fileUrl: message.message,
    mimeType: 'image/jpeg'
  };
}
    const fileName = fileInfo?.fileName || fileInfo?.name || 'Unknown File';
    const fileSize = fileInfo?.fileSize || fileInfo?.size;
    const mimeType = fileInfo?.fileType || fileInfo?.mimeType;
    
    const fileType = getFileType(mimeType, fileName);
    const isOwnMessage = message.fromUser === username;

    console.log(`🎨 Rendering file:`, { fileType, fileName, fileUrl, mimeType, isPending, progress });

    const renderFileContent = () => {
      switch (fileType) {
        case 'image':
          if (!isValidImageUrl(fileUrl) || isImageBroken) {
            return (
              <div className="max-w-xs lg:max-w-sm">
                <div className={`${isOwnMessage ? 'bg-blue-600' : 'bg-gray-600'} rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] border-2 border-dashed ${isOwnMessage ? 'border-blue-400' : 'border-gray-500'}`}>
                  <Image size={32} className={`${isOwnMessage ? 'text-blue-200' : 'text-gray-300'} mb-2`} />
                  <span className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-300'} text-center`}>
                    {isPending ? 'Uploading image...' : 'Image unavailable'}
                    {!isPending && <><br />(File may have been moved or deleted)</>}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div className="max-w-xs lg:max-w-sm">
              <div className="relative">
                <img
                  src={fileUrl}
                  alt={fileName}
                  className={`rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity ${isPending ? 'opacity-70' : ''}`}
                  onClick={() => !isPending && window.open(fileUrl, '_blank')}
                  onError={() => handleImageError(messageId)}
                  loading="lazy"
                />
                {isPending && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="text-white text-sm text-center">
                      <Clock size={24} className="animate-spin mx-auto mb-2" />
                      Uploading... {progress}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

        case 'video':
          return (
            <div className="max-w-xs lg:max-w-sm">
              <div className="relative">
                <video
                  controls={!isPending}
                  className={`rounded-lg max-w-full h-auto ${isPending ? 'opacity-70' : ''}`}
                  preload="metadata"
                  onError={() => handleImageError(messageId)}
                >
                  <source src={fileUrl} type={mimeType} />
                  Your browser does not support the video tag.
                </video>
                {isPending && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="text-white text-sm text-center">
                      <Video size={24} className="animate-pulse mx-auto mb-2" />
                      Uploading... {progress}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

        case 'audio':
          return (
            <div className="max-w-xs lg:max-w-sm">
              <audio
                controls={!isPending}
                className={`w-full ${isPending ? 'opacity-70' : ''}`}
                preload="metadata"
              >
                <source src={fileUrl} type={mimeType} />
                Your browser does not support the audio element.
              </audio>
              {isPending && (
                <div className="text-center text-xs text-blue-200 mt-2">
                  Uploading audio... {progress}%
                </div>
              )}
            </div>
          );

        default:
          return (
            <div className={`flex items-center gap-2 p-3 ${isOwnMessage ? 'bg-blue-600' : 'bg-gray-600'} rounded-lg max-w-xs lg:max-w-sm ${isPending ? 'opacity-70' : ''}`}>
              <FileText size={20} className={`${isOwnMessage ? 'text-blue-100' : 'text-gray-300'} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isOwnMessage ? 'text-white' : 'text-gray-100'}`}>
                  {fileName}
                </div>
                {fileSize && (
                  <div className={`text-xs ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}>
                    {formatFileSize(fileSize)}
                  </div>
                )}
                {isPending && (
                  <div className={`text-xs ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}>
                    Uploading... {progress}%
                  </div>
                )}
              </div>
              {!isPending && isValidImageUrl(fileUrl) && (
                <a
                  href={fileUrl}
                  download={fileName}
                  className={`p-1 hover:${isOwnMessage ? 'bg-blue-500' : 'bg-gray-500'} rounded transition-colors flex-shrink-0`}
                  title="Download"
                >
                  <Download size={14} />
                </a>
              )}
            </div>
          );
      }
    };

    return (
      <div>
        {renderFileContent()}
        {fileName && (
          <div className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-300'} mt-2 flex items-center justify-between`}>
            <span className="truncate flex-1 mr-2">{fileName}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {fileSize && (
                <span className={`${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}>
                  ({formatFileSize(fileSize)})
                </span>
              )}
              {!isPending && isValidImageUrl(fileUrl) && (
                <a
                  href={fileUrl}
                  download={fileName}
                  className={`p-1 hover:${isOwnMessage ? 'bg-blue-600' : 'bg-gray-600'} rounded transition-colors`}
                  title="Download"
                >
                  <Download size={12} />
                </a>
              )}
            </div>
          </div>
        )}
        {isPending && renderProgressBar(progress)}
      </div>
    );
  };

  // Combine all messages (sent, pending, failed) with proper sorting
  const allMessages = useMemo(() => {
    // Remove console.log for production
    const safeMessages = Array.isArray(messages) ? messages : [];
    const safePendingMessages = Array.isArray(pendingMessages) ? pendingMessages : [];
    const safeFailedMessages = Array.isArray(failedMessages) ? failedMessages : [];

    const filterMessagesForConversation = (msgArray, type = 'sent') => {
      return msgArray.filter((m) => {
        if (!m || typeof m !== 'object') return false;
        if (!m.fromUser || !m.toUser) return false;
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
      }).map(m => ({ ...m, messageStatus: type }));
    };

    const filteredSentMessages = filterMessagesForConversation(safeMessages, 'sent');
    const filteredPendingMessages = filterMessagesForConversation(safePendingMessages, 'pending');
    const filteredFailedMessages = filterMessagesForConversation(safeFailedMessages, 'failed');

    // Combine all messages
    const combinedMessages = [
      ...filteredSentMessages,
      ...filteredPendingMessages,
      ...filteredFailedMessages
    ];

    // Remove duplicates and sort
    const seenMessages = new Map();
    const uniqueMessages = combinedMessages.filter((m) => {
      const messageId = m._id || m.id || m.tempId;
      const contentHash = `${m.fromUser}-${m.toUser}-${m.message}-${m.messageType || ''}-${m.timestamp || m.timeStamp}`;
      if (messageId && seenMessages.has(`id:${messageId}`)) return false;
      if (seenMessages.has(`content:${contentHash}`)) return false;
      if (messageId) seenMessages.set(`id:${messageId}`, true);
      seenMessages.set(`content:${contentHash}`, true);
      return true;
    });

    // Sort by timestamp
    const sortedMessages = uniqueMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.timeStamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.timeStamp || b.createdAt || 0);
      if (timeA.getTime() === timeB.getTime()) {
        const idA = a._id || a.id || a.tempId || '';
        const idB = b._id || b.id || b.tempId || '';
        return idA.localeCompare(idB);
      }
      return timeA - timeB;
    });

    return sortedMessages;
  }, [messages, pendingMessages, failedMessages, username, toUser, AI_BOT_NAME]);

  return (
    <div className="flex-1 px-3 lg:px-6 py-4 space-y-3 pb-32 lg:pb-28 overflow-y-auto">
      {!toUser && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="text-6xl lg:text-8xl mb-4 opacity-20">💬</div>
          <h3 className="text-xl lg:text-2xl font-semibold text-gray-300 mb-2">
            Select a chat to start messaging
          </h3>
          <p className="text-gray-500 text-sm lg:text-base">
            Choose from your contacts to begin a conversation
          </p>
        </div>
      )}
      
      {toUser && allMessages.map((message, index) => {
        const messageTime = message.timestamp || message.timeStamp || new Date().toISOString();
     const isFileMessage = message.messageType === 'file' || message.isFile || Boolean(message.fileInfo) || (message.message && message.message.includes('imagekit.io'));
        const isOwnMessage = message.fromUser === username;
        const isPending = message.messageStatus === 'pending';
        const isFailed = message.messageStatus === 'failed';
        const progress = uploadProgress.get(message.tempId) || 0;
        
        const prevMessageTime = index > 0 ? 
          (allMessages[index - 1]?.timestamp || allMessages[index - 1]?.timeStamp || new Date().toISOString()) : 
          null;

        const showDate = index === 0 || 
          (prevMessageTime && formatDate(messageTime) !== formatDate(prevMessageTime));

        const messageKey = generateMessageKey(message, index, message.messageStatus);

        return (
          <div key={messageKey}>
            {/* Date separator */}
            {showDate && (
              <div className="text-center text-xs text-gray-500 my-4 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative inline-block bg-white px-3">
                  {formatDate(messageTime)}
                </div>
              </div>
            )}

            {/* Message bubble */}
            <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                isOwnMessage 
                  ? `bg-blue-500 text-white ${isPending ? 'opacity-80' : ''} ${isFailed ? 'bg-red-500' : ''}` 
                  : 'bg-gray-200 text-gray-800'
              }`}>
                
                {/* Display username for received messages */}
                {!isOwnMessage && toUser !== AI_BOT_NAME && (
                  <div className="text-xs font-semibold text-blue-600 mb-1 capitalize">
                    {message.fromUser}
                  </div>
                )}
                
                {/* Message content */}
                {isFileMessage ? (
                  <div className="mt-1">
                    {renderFileMessage(message, isPending, isFailed, progress)}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.message || 'No message content'}
                  </p>
                )}
                
                {/* Timestamp and status */}
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(messageTime)}
                  </p>
                  
                  {isOwnMessage && (
                    <div className="ml-2">
                      {renderStatusIndicator(message.messageStatus, isPending, isFailed)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Empty state for selected conversation */}
      {toUser && allMessages.length === 0 && (
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