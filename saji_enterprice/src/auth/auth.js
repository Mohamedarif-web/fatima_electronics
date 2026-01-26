// Simple localStorage-based auth for a serverless desktop app
const USERS_KEY = 'pos_users'
const SESSION_KEY = 'pos_session_user'

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getCurrentUser() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setCurrentUser(username) {
  localStorage.setItem(SESSION_KEY, username)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function listUsers() {
  return readUsers().map(u => ({ username: u.username }))
}

export function createUser(username, password) {
  const users = readUsers()
  if (!username || !password) throw new Error('Username and password are required')
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists')
  }
  users.push({ username, password })
  writeUsers(users)
  return { username }
}

export function authenticate(username, password) {
  const users = readUsers()
  const u = users.find(u => u.username.toLowerCase() === username.toLowerCase())
  if (!u) throw new Error('Invalid username or password')
  if (u.password !== password) throw new Error('Invalid username or password')
  setCurrentUser(u.username)
  return { username: u.username }
}
