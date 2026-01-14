import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

/* 🔐 THIS IS WHERE IT GOES */
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

/* Auth APIs */
export const registerUser = (data) =>
  API.post("/auth/register", data);

export const loginUser = (data) =>
  API.post("/auth/login", data);

/* Example protected API */
export const getProfile = () =>
  API.get("/profile");

export default API;
