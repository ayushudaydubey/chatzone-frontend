import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// ✅ General axios instance (for JSON APIs)
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // For cookies/session
  timeout: 10000, // 10 sec timeout for normal API
  headers: {
    'Content-Type': 'application/json',
  }
});

// ✅ File upload instance (NO headers set manually)
const fileUploadInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // For session/cookies
  timeout: 120000, // 2 min timeout for large files
  // ❌ Do NOT manually set Content-Type: multipart/form-data
  // Let browser handle it automatically when using FormData
});

// ✅ Request interceptor for axiosInstance
axiosInstance.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// ✅ Response interceptor for axiosInstance
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED') {
      console.error('Cannot connect to server. Check if backend is running.');
    }

    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out.');
    }

    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      if (!['/login', '/register', '/'].includes(currentPath)) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ✅ File upload request interceptor
fileUploadInstance.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// ✅ File upload response interceptor
fileUploadInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('File upload timed out.');
    }

    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      if (!['/login', '/register', '/'].includes(currentPath)) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
export { fileUploadInstance };
