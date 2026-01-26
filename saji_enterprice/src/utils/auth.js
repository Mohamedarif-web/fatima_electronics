// Authentication utilities for frontend
class AuthService {
    // Login user with username and password
    async login(username, password) {
        try {
            const user = await window.electronAPI.authenticateUser(username, password);
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                return user;
            }
            return null;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Get current user from localStorage
    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        const user = this.getCurrentUser();
        return user !== null;
    }

    // Logout user
    logout() {
        localStorage.removeItem('user');
    }

    // Get user role
    getUserRole() {
        const user = this.getCurrentUser();
        return user ? user.role : null;
    }

    // Check if user has admin role
    isAdmin() {
        return this.getUserRole() === 'admin';
    }
}

// Create singleton instance
const authService = new AuthService();
export default authService;