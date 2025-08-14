import axios from 'axios';

const BASE_URL =
  import.meta?.env?.VITE_API_URL || // for Vite

  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://chatzone-backend.onrender.com');

// ✅ General axios instance (for JSON APIs)
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // For cookies/session
  timeout: 10000, // 10 sec timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// ✅ File upload instance (no manual headers for FormData)
const fileUploadInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 120000, // 2 min timeout for large files
});

// ✅ Add retry logic to file uploads (optional)
// axiosRetry(fileUploadInstance, {
//   retries: 2,
//   retryDelay: axiosRetry.exponentialDelay,
// });

// ✅ Interceptors for JSON requests
axiosInstance.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Is backend running?');
    }

    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timed out.');
    }

    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (!['/login', '/register', '/'].includes(currentPath)) {
        window.location.href = '/login';
      }
    }

    console.error('Axios Error:', error.message);
    return Promise.reject(error);
  }
);

// ✅ Interceptors for file upload requests
fileUploadInstance.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
);

fileUploadInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ File upload timed out.');
    }

    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (!['/login', '/register', '/'].includes(currentPath)) {
        window.location.href = '/login';
      }
    }

    console.error('File Upload Error:', error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
export { fileUploadInstance };
