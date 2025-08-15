import React, { useState, useMemo, useEffect } from 'react';
import { Download, FileText, Image, Video, Clock, CheckCircle, XCircle, Play, Pause, VolumeX, Volume2, X, ZoomIn } from 'lucide-react';

const ChatMessages = ({ 
  messages = [], 
  username = "user", 
  toUser = "contact", 
  formatTime = (time) => new Date(time).toLocaleTimeString(), 
  formatDate = (date) => new Date(date).toLocaleDateString(), 
  messagesEndRef, 
  AI_BOT_NAME = "AI Assistant",
  pendingMessages = [],
  failedMessages = [],
  setMessages = () => {}
}) => {
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState(new Map());
  const [imageModal, setImageModal] = useState(null);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageError = (messageId) => {
    setBrokenImages(prev => new Set([...prev, messageId]));
  };

  const handleImageClick = (imageUrl, event) => {
    event.preventDefault();
    event.stopPropagation();
    setImageModal(imageUrl);
  };

  const closeImageModal = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setImageModal(null);
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && imageModal) {
        setImageModal(null);
      }
    };

    if (imageModal) {
      document.addEventListener('keydown', handleEscapeKey);
      // Store original overflow value
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = originalOverflow;
      };
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [imageModal]);

  const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('blob:')) return true;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
  };

  const getFileType = (mimeType, fileName) => {
    if (mimeType && typeof mimeType === 'string') {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
    }
    const extension = fileName?.split('.').pop()?.toLowerCase();
    if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) return 'image';
    if (extension && ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'].includes(extension)) return 'video';
    if (extension && ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) return 'audio';
    if (extension && ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(extension)) return 'document';
    return 'file';
  };

  const generateMessageKey = (message, index, type = 'sent') => {
    if (message._id) return `${type}-${message._id}`;
    if (message.id) return `${type}-${message.id}`;
    if (message.tempId) return `${type}-temp-${message.tempId}`;
    
    const timestamp = message.timestamp || message.timeStamp || message.createdAt || Date.now();
    const contentKey = `${message.fromUser || 'unknown'}-${message.toUser || 'unknown'}-${message.message || ''}-${timestamp}-${type}`;
    
    let hash = 0;
    for (let i = 0; i < contentKey.length; i++) {
      const char = contentKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `${type}-${Math.abs(hash)}-${index}-${timestamp}`;
  };

  const renderProgressBar = (progress) => (
    <div className="w-full bg-gray-800/60 rounded-full h-2 mt-3 overflow-hidden border border-green-500/20">
      <div 
        className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out shadow-lg shadow-green-500/30"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );

  const renderStatusIndicator = (status, isPending = false, isFailed = false) => {
    if (isFailed) {
      return (
        <div className="flex items-center gap-1.5 text-red-400 text-xs mt-2 opacity-90">
          <XCircle size={10} />
          <span className="font-medium">Failed to send</span>
        </div>
      );
    }
    if (isPending) {
      return (
        <div className="flex items-center gap-1.5 text-green-400 text-xs mt-2 opacity-90">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50" />
          <span className="font-medium">Sending...</span>
        </div>
      );
    }
    return null;
  };

  const getMessageType = (message) => {
    if (!message) return 'text';
    
    if (message.fileInfo) {
      const { fileInfo } = message;
      const fileName = fileInfo?.fileName || fileInfo?.name || '';
      const mimeType = fileInfo?.fileType || fileInfo?.mimeType || '';
      
      if (mimeType && mimeType.startsWith('image/')) {
        return 'image';
      }
      
      const fileType = getFileType(mimeType, fileName);
      return fileType;
    }
    
    if (message.message && typeof message.message === 'string') {
      const messageContent = message.message.trim();
      
      const imageUrlPatterns = [
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i,
        /^data:image\//i,
        /blob:.*image/i,
        /imagekit\.io.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i,
        /cloudinary\.com.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i,
        /amazonaws\.com.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i,
      ];
      
      const isImageUrl = imageUrlPatterns.some(pattern => pattern.test(messageContent));
      
      if (isImageUrl) {
        return 'image';
      }
      
      const videoPatterns = [
        /\.(mp4|avi|mov|wmv|flv|webm|mkv|3gp)(\?.*)?$/i
      ];
      
      if (videoPatterns.some(pattern => pattern.test(messageContent))) {
        return 'video';
      }
      
      const audioPatterns = [
        /\.(mp3|wav|ogg|aac|flac|m4a)(\?.*)?$/i
      ];
      
      if (audioPatterns.some(pattern => pattern.test(messageContent))) {
        return 'audio';
      }
      
      if (/^https?:\/\/[^\s]+$/.test(messageContent)) {
        return 'file';
      }
    }
    
    return 'text';
  };

  const renderFileMessage = (message, messageType, isPending = false, isFailed = false, progress = 0) => {
    const { fileInfo } = message;
    const messageId = message._id || message.id || message.tempId;
    const isImageBroken = brokenImages.has(messageId);
    
    let fileUrl, fileName, fileSize, mimeType;
    
    if (fileInfo) {
      fileUrl = fileInfo?.fileUrl || fileInfo?.url || fileInfo?.blobUrl;
      fileName = fileInfo?.fileName || fileInfo?.name || 'Unknown File';
      fileSize = fileInfo?.fileSize || fileInfo?.size;
      mimeType = fileInfo?.fileType || fileInfo?.mimeType;
    } else if (messageType === 'image' && message.message) {
      fileUrl = message.message;
      fileName = fileUrl?.split('/').pop()?.split('?')[0] || 'Image';
      fileSize = null;
      mimeType = 'image/jpeg';
    } else if (messageType !== 'text' && message.message) {
      fileUrl = message.message;
      fileName = fileUrl?.split('/').pop()?.split('?')[0] || 'File';
      fileSize = null;
      mimeType = null;
    }
    
    const isOwnMessage = message.fromUser === username;

    const renderFileContent = () => {
      switch (messageType) {
        case 'image':
          if (!isValidImageUrl(fileUrl) || isImageBroken) {
            return (
              <div className="max-w-xs lg:max-w-sm">
                <div className={`${isOwnMessage ? 'bg-gradient-to-br from-green-600 to-emerald-700 border-green-400/30' : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600/30'} rounded-xl p-6 flex flex-col items-center justify-center min-h-[120px] border border-dashed backdrop-blur-sm`}>
                  <div className={`p-3 rounded-full ${isOwnMessage ? 'bg-green-400/20' : 'bg-gray-600/20'} mb-3`}>
                    <Image size={28} className={`${isOwnMessage ? 'text-green-200' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-xs ${isOwnMessage ? 'text-green-100' : 'text-gray-400'} text-center font-medium`}>
                    {isPending ? 'Uploading image...' : 'Image unavailable'}
                  </span>
                  {fileName && (
                    <span className={`text-xs ${isOwnMessage ? 'text-green-200' : 'text-gray-500'} text-center mt-1 truncate max-w-full`}>
                      {fileName}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="max-w-xs lg:max-w-sm">
              <div className="relative group">
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className={`rounded-xl max-w-full h-auto cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-green-500/20 ${isPending ? 'opacity-70' : ''} shadow-lg border border-green-500/10`}
                    onClick={(e) => !isPending && handleImageClick(fileUrl, e)}
                    onError={() => handleImageError(messageId)}
                    loading="lazy"
                  />
                  
                  {/* Hover overlay with zoom icon */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-xl transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer"
                       onClick={(e) => !isPending && handleImageClick(fileUrl, e)}>
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 transform scale-75 hover:scale-100 transition-transform duration-200">
                      <ZoomIn size={20} className="text-white" />
                    </div>
                  </div>
                </div>
                
                {isPending && (
                  <div className="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <div className="text-green-400 text-sm text-center">
                      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <div className="font-medium">Uploading... {progress}%</div>
                    </div>
                  </div>
                )}
              </div>
              {fileName && fileName !== 'Image' && (
                <div className={`text-xs ${isOwnMessage ? 'text-green-200' : 'text-gray-400'} mt-2 text-center truncate`}>
                  {fileName}
                </div>
              )}
            </div>
          );

        case 'video':
          return (
            <div className="max-w-xs lg:max-w-sm">
              <div className="relative group">
                <video controls className={`rounded-xl max-w-full h-auto shadow-lg border border-green-500/20 ${isPending ? 'opacity-70' : ''}`}>
                  <source src={fileUrl} type={mimeType} />
                  Your browser does not support the video tag.
                </video>
                {isPending && (
                  <div className="absolute top-2 right-2 bg-black/80 text-green-400 text-xs px-3 py-1 rounded-full backdrop-blur-sm font-medium">
                    {progress}%
                  </div>
                )}
              </div>
              {fileName && (
                <div className={`text-xs ${isOwnMessage ? 'text-green-200' : 'text-gray-400'} mt-2 text-center truncate`}>
                  {fileName}
                </div>
              )}
            </div>
          );

        case 'audio':
          return (
            <div className="max-w-xs lg:max-w-sm">
              <div className={`p-4 rounded-xl ${isOwnMessage ? 'bg-gradient-to-r from-green-600 to-emerald-700 border border-green-500/30' : 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-600/30'}`}>
                <audio controls className={`w-full ${isPending ? 'opacity-70' : ''}`}>
                  <source src={fileUrl} type={mimeType} />
                  Your browser does not support the audio element.
                </audio>
                {isPending && (
                  <div className="text-center text-xs text-green-300 mt-2 font-medium">Uploading audio... {progress}%</div>
                )}
                {fileName && (
                  <div className={`text-xs ${isOwnMessage ? 'text-green-200' : 'text-gray-400'} mt-2 text-center truncate`}>
                    {fileName}
                  </div>
                )}
              </div>
            </div>
          );

        default:
          return (
            <div className={`flex items-center gap-3 p-4 ${isOwnMessage ? 'bg-gradient-to-r from-green-600 to-emerald-700 border-green-500/30' : 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-600/30'} rounded-xl max-w-xs lg:max-w-sm shadow-lg border backdrop-blur-sm ${isPending ? 'opacity-70' : ''} hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300`}>
              <div className={`p-2 rounded-lg ${isOwnMessage ? 'bg-green-400/20' : 'bg-gray-600/20'}`}>
                <FileText size={20} className={`${isOwnMessage ? 'text-green-200' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isOwnMessage ? 'text-white' : 'text-gray-200'}`}>{fileName}</div>
                <div className={`text-xs ${isOwnMessage ? 'text-green-200' : 'text-gray-500'} mt-0.5`}>{formatFileSize(fileSize)}</div>
              </div>
              {fileUrl && (
                <a
                  href={fileUrl}
                  download={fileName}
                  className={`p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 ${isOwnMessage ? 'text-green-200 hover:text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Download size={16} />
                </a>
              )}
            </div>
          );
      }
    };

    return (
      <div>
        {renderFileContent()}
        {isPending && renderProgressBar(progress)}
      </div>
    );
  };

  const allMessages = useMemo(() => {
    const safePendingMessages = Array.isArray(pendingMessages) ? pendingMessages : [];
    const safeFailedMessages = Array.isArray(failedMessages) ? failedMessages : [];

    const filterMessagesForConversation = (msgArray, type = 'sent') =>
      msgArray
        .filter((m) => {
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
        })
        .map(m => ({ ...m, messageStatus: type }));

    const combinedMessages = [
      ...filterMessagesForConversation(messages, 'sent'),
      ...filterMessagesForConversation(safePendingMessages, 'pending'),
      ...filterMessagesForConversation(safeFailedMessages, 'failed')
    ];

    const uniqueMessages = combinedMessages.reduce((acc, current) => {
      const isDuplicate = acc.some(msg => {
        if (current._id && msg._id && current._id === msg._id) {
          return true;
        }
        if (current.id && msg.id && current.id === msg.id) {
          return true;
        }
        if (current.tempId && msg.tempId && current.tempId === msg.tempId) {
          return true;
        }
        
        const sameContent = current.message === msg.message;
        const sameUsers = current.fromUser === msg.fromUser && current.toUser === msg.toUser;
        
        if (sameContent && sameUsers) {
          const currentTime = new Date(current.timestamp || current.timeStamp || current.createdAt || 0).getTime();
          const msgTime = new Date(msg.timestamp || msg.timeStamp || msg.createdAt || 0).getTime();
          const timeDiff = Math.abs(currentTime - msgTime);
          
          if (timeDiff < 2000) {
            return true;
          }
        }
        
        return false;
      });

      if (!isDuplicate) {
        acc.push(current);
      }
      
      return acc;
    }, []);

    return uniqueMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.timeStamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.timeStamp || b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }, [messages, pendingMessages, failedMessages, username, toUser, AI_BOT_NAME]);

  return (
    <>
      <div className="flex-1 px-4 lg:px-8 py-6 space-y-6 pb-32 lg:pb-28 overflow-y-auto bg-gradient-to-b from-black via-zinc-950 to-black">
        {!toUser ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="relative mb-8">
              <div className="text-8xl lg:text-9xl opacity-20 animate-pulse">💬</div>
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Select a chat to start messaging
            </h3>
            <p className="text-gray-400 text-lg max-w-md leading-relaxed">
              Choose from your contacts to begin a conversation and start sharing your thoughts
            </p>
          </div>
        ) : (
          allMessages.map((message, index) => {
            const isOwn = message.fromUser === username;
            const isPending = message.messageStatus === 'pending';
            const isFailed = message.messageStatus === 'failed';
            const messageType = getMessageType(message);
            const messageTime = message.timestamp || message.timeStamp || message.createdAt || new Date().toISOString();
            const messageKey = generateMessageKey(message, index, message.messageStatus);
            const progress = uploadProgress.get(message.tempId) || 0;

            return (
              <div key={messageKey} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                <div className={`max-w-xs lg:max-w-md transition-all duration-300  ${isOwn ? 'order-2' : 'order-1'}`}>
                  <div className={`px-4 py-4 rounded-xl text-xl shadow-xl  transition-all duration-300  ${
                    isOwn 
                      ? 'bg-gradient-to-br from-green-900 to-green-800 text-white    ' 
                      : 'bg-gradient-to-br from-green-800 to-green-900  text-white  '
                  } ${isPending ? 'opacity-80' : ''} ${isFailed ? 'border-2 border-red-500/50' : ''}`}>
                    
                    {messageType === 'text' ? (
                      <div className="leading-relaxed whitespace-pre-wrap break-words text-sm">
                        {message.message}
                      </div>
                    ) : (
                      renderFileMessage(message, messageType, isPending, isFailed, progress)
                    )}
                    
                    <div className="flex items-center gap-4 justify-between mt-3">
                      <div className={`text-xs opacity-70  ${isOwn ? 'text-gray-400' : 'text-gray-200'}`}>
                        {formatTime(messageTime)}
                      </div>
                      {isOwn && !isPending && !isFailed && (
                        <CheckCircle size={14} className="text-green-400 opacity-90" />
                      )}
                    </div>
                    
                    {renderStatusIndicator(message.messageStatus, isPending, isFailed)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Image Modal */}
      {imageModal && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 animate-in fade-in duration-300"
          onClick={closeImageModal}
        >
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={imageModal} 
                alt="Full size preview" 
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl border border-green-500/30 animate-in zoom-in-50 duration-300"
                onClick={(e) => e.stopPropagation()}
              />
              
              <button 
                onClick={closeImageModal}
                className="absolute top-4 right-4 text-white bg-black/70 hover:bg-black/90 rounded-full p-3 transition-all duration-200 border border-green-500/30 hover:border-green-400/50 hover:scale-110 group z-10"
                aria-label="Close image"
              >
                <X size={24} className="group-hover:rotate-90 transition-transform duration-200" />
              </button>
              
              <a
                href={imageModal}
                download="image"
                className="absolute bottom-4 right-4 text-white bg-black/70 hover:bg-black/90 rounded-full p-3 transition-all duration-200 border border-green-500/30 hover:border-green-400/50 hover:scale-110 group z-10"
                onClick={(e) => e.stopPropagation()}
                aria-label="Download image"
              >
                <Download size={20} className="group-hover:scale-110 transition-transform duration-200" />
              </a>
              
         
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatMessages;