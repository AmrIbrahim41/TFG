import axios from 'axios';

export const BASE_URL = 'https://TigerGym.pythonanywhere.com';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── REQUEST INTERCEPTOR ────────────────────────────────────────────────────
// إضافة التوكن تلقائياً لأي طلب طالع للسيرفر
api.interceptors.request.use(
  (config) => {
    // قراءة التوكن بنفس الاسم اللي في AuthContext
    const authData = localStorage.getItem('authTokens');
    if (authData) {
      const authTokens = JSON.parse(authData);
      if (authTokens && authTokens.access) {
        config.headers.Authorization = `Bearer ${authTokens.access}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR ───────────────────────────────────────────────────
// محاولة تجديد التوكن لو رجع 401، ولو فشل يطرد اليوزر لصفحة تسجيل الدخول
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const authData = localStorage.getItem('authTokens');

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (authData) {
        const authTokens = JSON.parse(authData);

        if (authTokens.refresh) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            // طلب تجديد التوكن
            const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, {
              refresh: authTokens.refresh,
            });

            // تحديث التوكنز الجديدة وتخزينها بنفس الاسم authTokens
            const updatedTokens = {
              ...authTokens,
              access: data.access,
              // في حال السيرفر أرسل refresh جديد نحدثه، وإلا نحتفظ بالقديم
              refresh: data.refresh || authTokens.refresh,
            };
            
            localStorage.setItem('authTokens', JSON.stringify(updatedTokens));
            
            api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
            originalRequest.headers.Authorization = `Bearer ${data.access}`;

            processQueue(null, data.access);
            return api(originalRequest);
            
          } catch (refreshError) {
            processQueue(refreshError, null);
            // فشل التجديد -> امسح التوكن الحقيقي واطرد اليوزر
            localStorage.removeItem('authTokens');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }
      }

      // لو مفيش توكن من الأساس أو مفيش Refresh Token
      localStorage.removeItem('authTokens');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;