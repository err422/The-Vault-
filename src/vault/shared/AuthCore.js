// AuthCore.js - Authentication state & logic (Lovable Cloud).
// Keeps the original window.AuthCore API and authProfileReady events.
import * as cloud from '../cloud.js';

(function() {
    let lastUid;

    window.AuthCore = {
        currentUser: null,
        currentUsername: null,
        currentAdmin: false,
        currentMembership: null,
        currentGuest: false,
        profileReady: false,

        init() {
            cloud.supabase.auth.onAuthStateChange((event, session) => {
                const uid = session?.user?.id || null;
                if (event !== 'INITIAL_SESSION' && uid === lastUid) {
                    if (event === 'USER_UPDATED' && session?.user) this.currentUser = cloud.toVaultUser(session.user);
                    return;
                }
                lastUid = uid;
                // Defer: never call the auth client from inside its own callback.
                setTimeout(() => this._handleUser(session?.user || null), 0);
            });
        },

        async _handleUser(rawUser) {
            const user = cloud.toVaultUser(rawUser);
            this.currentUser = user;
            this.currentGuest = !user && localStorage.getItem('vault_guest_session') === '1';
            if (user) localStorage.removeItem('vault_guest_session');

            this.profileReady = false;
            this.currentAdmin = false;
            this.currentMembership = null;

            if (!user) {
                this.currentUsername = null;
                this.profileReady = true;
                this.updateUI();
                window.dispatchEvent(new CustomEvent('authProfileReady', {
                    detail: { user: null, username: this.currentGuest ? 'Guest' : null, admin: false, membership: null, guest: this.currentGuest }
                }));
                return;
            }

            try {
                const [profile, admin, membership] = await Promise.all([
                    cloud.getProfile(user.uid),
                    cloud.getIsAdmin(user.uid).catch(() => false),
                    cloud.getMembership(user.uid).catch(() => null)
                ]);
                this.currentUsername = profile?.username || null;
                this.currentAdmin = admin === true;
                this.currentMembership = membership;
                this.profileReady = true;
                this.updateUI();
                window.dispatchEvent(new CustomEvent('authProfileReady', {
                    detail: { user, username: this.currentUsername, admin: this.currentAdmin, membership: this.currentMembership }
                }));
                setTimeout(() => this.loadUserData(), 500);
            } catch (error) {
                console.error('Could not load account profile:', error);
                this.currentUsername = null;
                this.currentAdmin = false;
                this.currentMembership = null;
                this.profileReady = true;
                this.updateUI();
                window.dispatchEvent(new CustomEvent('authProfileReady', {
                    detail: { user, username: null, admin: false, membership: null, error: true }
                }));
            }
        },

        updateUI() {
            this.updateAdminNavigation();
            const authButtons = document.querySelectorAll('.auth-button');
            authButtons.forEach(btn => {
                if (this.currentUser && this.currentUsername) {
                    btn.innerHTML = '👤';
                    btn.title = '@' + this.currentUsername;
                } else if (this.currentGuest) {
                    btn.innerHTML = '👤';
                    btn.title = 'Guest session — click to sign in';
                } else {
                    btn.innerHTML = '🔓';
                    btn.title = 'Sign In';
                }
            });
        },
        
        updateAdminNavigation() {
            const navBar = document.querySelector('.nav-bar');
            if (!navBar) return;

            const existing = document.getElementById('admin-nav-item');
            const currentPageAdminItem = document.getElementById('admin-nav-current');
            if (this.currentUser && this.currentAdmin === true) {
                if (currentPageAdminItem) currentPageAdminItem.hidden = false;
                if (existing || currentPageAdminItem) return;
                const item = document.createElement('div');
                item.id = 'admin-nav-item';
                item.className = 'nav-item admin-nav-item';
                item.setAttribute('role', 'link');
                item.setAttribute('tabindex', '0');
                item.title = 'Admin dashboard';
                item.innerHTML = `
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="8" height="8" rx="1.5"/>
                        <rect x="13" y="3" width="8" height="5" rx="1.5"/>
                        <rect x="13" y="10" width="8" height="11" rx="1.5"/>
                        <rect x="3" y="13" width="8" height="8" rx="1.5"/>
                    </svg>
                    <span class="nav-label">Admin</span>
                `;
                item.addEventListener('click', () => {
                    if (window.navigation?.navigateTo) window.navigation.navigateTo('admin.html');
                    else window.location.href = 'admin.html';
                });
                item.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        item.click();
                    }
                });
                const fullscreen = document.getElementById('fullscreen-btn');
                if (fullscreen && fullscreen.parentElement === navBar) navBar.insertBefore(item, fullscreen);
                else navBar.appendChild(item);
                if (window.navigation?.setup) window.navigation.setup();
            } else {
                if (existing) existing.remove();
                if (currentPageAdminItem) currentPageAdminItem.hidden = true;
            }
        },

        validateUsername(username) {
            if (!username) return 'Username is required';
            if (username.length < 3) return 'Username must be at least 3 characters';
            if (username.length > 16) return 'Username must be 16 characters or less';
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username can only contain letters, numbers, underscores, and hyphens';
            return null;
        },
        
        async isUsernameAvailable(username) {
            return cloud.isUsernameAvailable(username);
        },

        async signIn(usernameOrEmail, password) {
            if (!usernameOrEmail || !password) {
                throw new Error('Please enter username/email and password');
            }
            if (usernameOrEmail.includes('@')) {
                return cloud.signInWithEmail(usernameOrEmail, password);
            }
            return cloud.signInUsername(usernameOrEmail, password);
        },

        async signUp(username, email, password) {
            const usernameError = this.validateUsername(username);
            if (usernameError) throw new Error(usernameError);

            if (!email || !email.includes('@') || !email.includes('.')) {
                throw new Error('Please enter a valid email address');
            }

            if (!password || password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            const available = await this.isUsernameAvailable(username);
            if (!available) throw new Error('Username "' + username + '" is already taken');

            const { data, error } = await cloud.supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin, data: { username } }
            });
            if (error) throw new Error(error.message);
            return { username, needsConfirmation: !data.session };
        },

        async sendPasswordReset(identifier) {
            if (!identifier) throw new Error('Enter your username or email');
            return cloud.sendPasswordReset(identifier.trim());
        },

        async changeUsername(newUsername) {
            const error = this.validateUsername(newUsername);
            if (error) throw new Error(error);

            if (newUsername === this.currentUsername) {
                throw new Error('That\'s already your username');
            }

            const available = await this.isUsernameAvailable(newUsername);
            if (!available) throw new Error('Username already taken');

            await cloud.updateUsername(this.currentUser.uid, newUsername);
            this.currentUsername = newUsername;
            this.updateUI();
        },

        continueAsGuest() {
            localStorage.setItem('vault_guest_session', '1');
            this.currentGuest = true;
            this.currentUser = null;
            this.currentUsername = null;
            this.currentAdmin = false;
            this.profileReady = true;
            this.updateUI();
            window.dispatchEvent(new CustomEvent('authProfileReady', { detail: { user: null, username: 'Guest', admin: false, guest: true } }));
            if (window.AuthUI) window.AuthUI.hideModal();
        },

        async signOut() {
            localStorage.removeItem('vault_guest_session');
            this.currentGuest = false;
            if (window.AuthUI) window.AuthUI.showModal('signin');
            return cloud.supabase.auth.signOut();
        },

        loadUserData() {
            if (!this.currentUser) return;
            cloud.getProfile(this.currentUser.uid)
                .then((profile) => {
                    if (profile && Array.isArray(profile.favorites)) {
                        window.favorites = profile.favorites;
                        if (typeof window.updateFavoritesBadge === 'function') window.updateFavoritesBadge();
                        if (typeof window.updateCardStars === 'function') window.updateCardStars();
                        else if (typeof window.updateGameCardStars === 'function') window.updateGameCardStars();
                    }
                })
                .catch((error) => console.error('Error loading user data:', error));
        },

        async getUserStats() {
            if (!this.currentUser) return null;
            const profile = await cloud.getProfile(this.currentUser.uid);
            if (!profile) return null;
            return {
                username: profile.username,
                email: profile.email,
                createdAt: profile.created_at ? new Date(profile.created_at).getTime() : null,
                favorites: profile.favorites || [],
                playtime: profile.playtime || { daily: {}, weekly: {}, total: {} },
                admin: this.currentAdmin,
                membership: this.currentMembership,
                webos: profile.webos || {}
            };
        },

        calculateStats(userData) {
            let totalPlaytime = 0, gamesPlayed = 0;
            let favoriteGame = { name: 'None', time: 0 };
            
            if (userData.playtime && userData.playtime.total) {
                const games = userData.playtime.total;
                gamesPlayed = Object.keys(games).length;
                
                Object.entries(games).forEach(([game, seconds]) => {
                    const time = Number(seconds) || 0;
                    totalPlaytime += time;
                    if (time > favoriteGame.time) favoriteGame = { name: game, time: time };
                });
            }
            
            const level = Math.floor(totalPlaytime / 3600) + 1;
            let title = 'Newcomer';
            if (level >= 50) title = 'Legend';
            else if (level >= 30) title = 'Master';
            else if (level >= 20) title = 'Expert';
            else if (level >= 10) title = 'Veteran';
            else if (level >= 5) title = 'Regular';
            
            const hours = Math.floor(totalPlaytime / 3600);
            const minutes = Math.floor((totalPlaytime % 3600) / 60);
            const totalPlaytimeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            
            return { totalPlaytime, totalPlaytimeFormatted, gamesPlayed, favoriteGame, level, title };
        },
        
        calculateAchievements(userData, stats) {
            const achievements = [
                { id: 'first_game', name: 'First Steps', description: 'Play your first game', icon: '🎮', unlocked: stats.gamesPlayed >= 1 },
                { id: 'game_collector', name: 'Collector', description: 'Play 5 different games', icon: '🎯', unlocked: stats.gamesPlayed >= 5 },
                { id: 'hour_one', name: 'Getting Started', description: 'Play for 1 hour total', icon: '⏰', unlocked: stats.totalPlaytime >= 3600 },
                { id: 'hour_ten', name: 'Dedicated', description: 'Play for 10 hours total', icon: '🔥', unlocked: stats.totalPlaytime >= 36000 },
                { id: 'marathon', name: 'Marathon', description: 'Play for 24 hours total', icon: '⚡', unlocked: stats.totalPlaytime >= 86400 },
                { id: 'veteran', name: 'Veteran', description: 'Reach level 10', icon: '🏅', unlocked: stats.level >= 10 },
                { id: 'favorites', name: 'Curator', description: 'Add 5 favorites', icon: '⭐', unlocked: (userData.favorites?.length || 0) >= 5 },
                { id: 'explorer', name: 'Explorer', description: 'Play 10 different games', icon: '🗺️', unlocked: stats.gamesPlayed >= 10 }
            ];
            
            return {
                list: achievements,
                unlockedCount: achievements.filter(a => a.unlocked).length,
                total: achievements.length
            };
        },
        
        getRecentActivity(userData) {
            if (!userData.playtime || !userData.playtime.daily) return [];
            
            const days = [];
            for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                days.push(date.toISOString().split('T')[0]);
            }
            
            return days.map(date => {
                if (!userData.playtime.daily[date]) return null;
                
                const games = userData.playtime.daily[date];
                const totalSeconds = Object.values(games).reduce((sum, s) => sum + Number(s), 0);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                
                const dateObj = new Date(date);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return {
                    date: dateStr,
                    time: timeStr,
                    gamesCount: Object.keys(games).length
                };
            }).filter(Boolean);
        }
    };

    window.AuthCore.init();

    window.authSystem = {
        showModal: () => window.AuthUI && window.AuthUI.showModal(),
        getCurrentUser: () => window.AuthCore.currentUser,
        getCurrentUsername: () => window.AuthCore.currentUsername,
        isLoggedIn: () => !!window.AuthCore.currentUser || !!window.AuthCore.currentGuest
    };
})();
