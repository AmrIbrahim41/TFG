import axios from 'axios';

// This points to your running Django server
export const BASE_URL = 'http://127.0.0.1:8000';

// export const BASE_URL = 'https://TigerGym.pythonanywhere.com';
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;