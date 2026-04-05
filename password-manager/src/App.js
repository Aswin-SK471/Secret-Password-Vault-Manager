import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const API = 'http://localhost:5000';
const AES_SECRET = 'secretKey';

function App() {
  const [screen, setScreen] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState('');
  const [msg, setMsg] = useState('');

  // Vault state
  const [vaultEntries, setVaultEntries] = useState([]);
  const [site, setSite] = useState('');
  const [siteUsername, setSiteUsername] = useState('');
  const [sitePassword, setSitePassword] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [editId, setEditId] = useState(null);

  // Password generator state
  const [genLength, setGenLength] = useState(16);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);

  // Vault lock + master password states
  const [masterPassword, setMasterPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [masterConfirm, setMasterConfirm] = useState('');
  const [pinEnabled, setPinEnabled] = useState(localStorage.getItem('pinEnabled') === 'true');
  const [pinHash, setPinHash] = useState(localStorage.getItem('pinHash') || '');
  const [pinInput, setPinInput] = useState('');
  const [unlockPinInput, setUnlockPinInput] = useState('');

  const [exportFormat, setExportFormat] = useState('json');
  const [entryTimestamps, setEntryTimestamps] = useState(JSON.parse(localStorage.getItem('entryTimestamps') || '{}'));

  const categories = ['Work', 'Personal', 'Social', 'Banking', 'Other'];

  // Search + filter state
  const [searchSite, setSearchSite] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');

  // Collapsible sections state
  const [favCollapsed, setFavCollapsed] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [weakCollapsed, setWeakCollapsed] = useState(false);

  // New UI states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [compactMode, setCompactMode] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [hoveredEntryId, setHoveredEntryId] = useState(null);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [quickAddSite, setQuickAddSite] = useState('');
  const [quickAddUsername, setQuickAddUsername] = useState('');
  const [quickAddPassword, setQuickAddPassword] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddNotes, setQuickAddNotes] = useState('');
  const [quickAddMessage, setQuickAddMessage] = useState('');
  const [currentView, setCurrentView] = useState('vault');
  const [addEntryCollapsed, setAddEntryCollapsed] = useState(false);
  const [genCollapsed, setGenCollapsed] = useState(true);
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Security features states
  const [autoLockTimer, setAutoLockTimer] = useState(null);
  const [passwordHistory, setPasswordHistory] = useState(JSON.parse(localStorage.getItem('passwordHistory') || '{}'));
  const [usedPasswords, setUsedPasswords] = useState(new Set());
  const [breachCache, setBreachCache] = useState({});
  const [showHistory, setShowHistory] = useState(null); // entry id to show history for

  const clearForm = useCallback(() => {
    setSite('');
    setSiteUsername('');
    setSitePassword('');
    setNotes('');
    setCategory('');
    setEditId(null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setUserId(null);
    setLoggedInUser('');
    setVaultEntries([]);
    setScreen('login');
    setUsername('');
    setPassword('');
    setMsg('');
    setMasterInput('');
    setUnlockPinInput('');
    clearForm();
  }, [clearForm]);

  // Auto-login from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');
    if (storedUserId && storedUsername) {
      setUserId(parseInt(storedUserId));
      setLoggedInUser(storedUsername);
      setScreen('master-password');
    }
  }, []);

  useEffect(() => {
    const globalKeyHandler = (e) => {
      if (e.key === 'Escape') {
        setShowQuickAdd(false);
        if (focusMode) setFocusMode(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowQuickAdd(true);
      }
      if (e.key === 'ArrowDown') {
        setSelectedEntryIndex(prev => Math.min(prev + 1, vaultEntries.length - 1));
      }
      if (e.key === 'ArrowUp') {
        setSelectedEntryIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && !showQuickAdd && vaultEntries[selectedEntryIndex]) {
        copyToClipboard(decryptPassword(vaultEntries[selectedEntryIndex].encrypted_password), 'Password');
      }
    };

    window.addEventListener('keydown', globalKeyHandler);
    return () => window.removeEventListener('keydown', globalKeyHandler);
  }, [vaultEntries, showQuickAdd, focusMode, selectedEntryIndex]);

  // Theme effect
  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-lock effect - Fixed to prevent input erase bug
  useEffect(() => {
    if (screen !== 'dashboard') return;
    
    let timeoutId = null;
    
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Clear localStorage and state on logout
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        setUserId(null);
        setLoggedInUser('');
        setVaultEntries([]);
        setScreen('login');
        setUsername('');
        setPassword('');
        setMsg('Session locked due to inactivity');
        setMasterInput('');
        setUnlockPinInput('');
        setSite('');
        setSiteUsername('');
        setSitePassword('');
        setNotes('');
        setCategory('');
        setEditId(null);
      }, 5 * 60 * 1000); // 5 minutes
    };
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer(); // Start the timer immediately
    
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [screen]);

  // Used passwords effect
  useEffect(() => {
    const allPasswords = new Set();
    vaultEntries.forEach(entry => {
      allPasswords.add(decryptPassword(entry.encrypted_password));
    });
    setUsedPasswords(allPasswords);
  }, [vaultEntries]);

  // Password history effect
  useEffect(() => {
    localStorage.setItem('passwordHistory', JSON.stringify(passwordHistory));
  }, [passwordHistory]);

  // Entry timestamps effect
  useEffect(() => {
    localStorage.setItem('entryTimestamps', JSON.stringify(entryTimestamps));
  }, [entryTimestamps]);

  const ensureTimestamps = useCallback((entries) => {
    setEntryTimestamps(prev => {
      const updated = { ...prev };
      entries.forEach(e => {
        if (!updated[e.id]) {
          updated[e.id] = Date.now();
        }
      });
      return updated;
    });
  }, []);

  // Fetch vault entries
  const fetchVault = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API}/vault/${userId}`);
      if (res.data.success) {
        setVaultEntries(res.data.data);
        ensureTimestamps(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching vault:', err);
    }
  }, [userId, ensureTimestamps]);

  useEffect(() => {
    if (screen === 'dashboard' && userId) {
      fetchVault();
    }
  }, [screen, userId, fetchVault]);

  // ---------- AUTH ----------

  const login = async () => {
    try {
      const res = await axios.post(`${API}/login`, { username, password });
      if (res.data.success) {
        setUserId(res.data.userId);
        setLoggedInUser(username);
        localStorage.setItem('userId', res.data.userId);
        localStorage.setItem('username', username);
        setMsg('');
        setPassword('');
        setScreen('master-password');
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'Login failed');
    }
  };

  const verifyMaster = async () => {
    if (!masterPassword) {
      setMsg('Enter master password to unlock');
      return;
    }
    try {
      await axios.post(`${API}/verify-master`, {
        username: loggedInUser,
        masterPassword
      });
      setMsg('Vault unlocked');
      setIsUnlocked(true);
      setMasterPassword('');
      setScreen('dashboard');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Invalid master password');
    }
  };

  const register = async () => {
    if (!username || !password || !masterPassword) {
      setMsg('Username, password, and master password are required');
      return;
    }
    if (masterPassword.length < 8) {
      setMsg('Master password must be at least 8 characters');
      return;
    }
    try {
      const res = await axios.post(`${API}/register`, { username, password, masterPassword });
      if (res.data.success) {
        setMsg('Registered! You can now login.');
        setIsRegistering(false);
        setScreen('login');
        setPassword('');
        setMasterPassword('');
        setUsername('');
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'Registration failed');
    }
  };

  // ---------- VAULT CRUD ----------

  const addOrUpdateEntry = async () => {
    if (!site || !sitePassword) {
      setMsg('Site and password are required');
      return;
    }

    // Security checks
    let warnings = [];
    const strength = getPasswordStrength(sitePassword);
    if (strength === 'Weak') warnings.push('Weak password!');
    if (isReused(sitePassword)) warnings.push('Password reused!');
    const breached = await checkBreach(sitePassword);
    if (breached) warnings.push('Password has been breached!');
    if (warnings.length > 0) {
      setMsg('Warnings: ' + warnings.join(' '));
    } else {
      setMsg('');
    }

    // Duplicate username warning
    if (hasDuplicateUsername(site, siteUsername, editId)) {
      setMsg('Duplicate username detected for this site. Consider using unique credentials.');
    }

    // Password history
    if (editId) {
      const oldEntry = vaultEntries.find(e => e.id === editId);
      if (oldEntry) {
        const oldPwd = decryptPassword(oldEntry.encrypted_password);
        setPasswordHistory(prev => ({
          ...prev,
          [editId]: [...(prev[editId] || []), oldPwd]
        }));
      }
    }

    const encryptedPassword = CryptoJS.AES.encrypt(sitePassword, AES_SECRET).toString();

    try {
      if (editId) {
        const oldEntry = vaultEntries.find(e => e.id === editId);
        await axios.put(`${API}/vault/update/${editId}`, {
          site,
          site_username: siteUsername,
          encrypted_password: encryptedPassword,
          notes,
          category,
          is_favorite: oldEntry?.is_favorite || false
        });
        setMsg('Entry updated');
        setEntryTimestamps(prev => ({ ...prev, [editId]: Date.now() }));
      } else {
        await axios.post(`${API}/vault/add`, {
          userId,
          site,
          site_username: siteUsername,
          encrypted_password: encryptedPassword,
          notes,
          category,
          is_favorite: false
        });
        setMsg('Entry added');
      }
      clearForm();
      fetchVault();
    } catch (err) {
      setMsg('Error saving entry');
    }
  };

  const deleteEntry = async (id) => {
    try {
      await axios.delete(`${API}/vault/delete/${id}`);
      setMsg('Entry deleted');
      fetchVault();
    } catch (err) {
      setMsg('Error deleting entry');
    }
  };

  const startEdit = (entry) => {
    setSite(entry.site);
    setSiteUsername(entry.site_username);
    const bytes = CryptoJS.AES.decrypt(entry.encrypted_password, AES_SECRET);
    setSitePassword(bytes.toString(CryptoJS.enc.Utf8));
    setNotes(entry.notes || '');
    setCategory(entry.category || '');
    setEditId(entry.id);
  };

  const decryptPassword = (encrypted) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, AES_SECRET);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return '***';
    }
  };

  const getCategoryColor = (cat) => {
    const colors = {
      'Work': '#4ecdc4',
      'Personal': '#7f8c8d',
      'Social': '#ff6b6b',
      'Banking': '#45b7d1',
      'Other': '#6c5ce7'
    };
    return colors[cat] || colors['Other'];
  };

  const toggleFavorite = (id) => {
    // Find the current entry to get its current favorite status
    const entry = vaultEntries.find(e => e.id === id);
    if (!entry) return;
    
    // Toggle the favorite status and update in database
    const newFavoriteStatus = !entry.is_favorite;
    axios.put(`${API}/vault/favorite/${id}`, { is_favorite: newFavoriteStatus })
      .then(() => {
        // Update the local state
        setVaultEntries(prev => prev.map(e => 
          e.id === id ? { ...e, is_favorite: newFavoriteStatus } : e
        ));
      })
      .catch(err => {
        console.log('Error toggling favorite:', err);
        setMsg('Error toggling favorite');
      });
  };

  const renderEntryCard = (entry, index) => {
    const passwordPlain = decryptPassword(entry.encrypted_password);
    const isSelected = selectedEntryIndex === index;
    return (
      <div
        key={entry.id}
        style={{
          ...styles.card,
          borderLeft: `5px solid ${getCategoryColor(entry.category)}`,
          outline: isSelected ? '2px solid #00d4ff' : 'none'
        }}
        className="card"
        onMouseEnter={() => setHoveredEntryId(entry.id)}
        onMouseLeave={() => setHoveredEntryId(null)}
        onClick={() => setSelectedEntryIndex(index)}
      >
        <div style={styles.row}>
          <img src={`https://www.google.com/s2/favicons?domain=${entry.site}`} alt="" style={styles.favicon} onError={(e) => e.target.style.display = 'none'} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '18px', color: '#ffffff' }}>{entry.site}</strong>
            <div style={styles.small}>User: <span style={styles.linkText} onClick={() => { selectText(entry.site_username); copyToClipboard(entry.site_username, 'Username'); }}>{entry.site_username || '—'}</span></div>
          </div>
          <span className="favorite" style={styles.favorite} onClick={() => toggleFavorite(entry.id)}>{entry.is_favorite ? '⭐' : '☆'}</span>
        </div>
        <div style={{ marginTop: '10px' }}>
          <span style={styles.small}>Strength: <strong style={{ color: getPasswordStrength(passwordPlain) === 'Weak' ? '#ff6b6b' : getPasswordStrength(passwordPlain) === 'Medium' ? '#ffc107' : '#28a745' }}>{getPasswordStrength(passwordPlain)}</strong></span>
          <span style={{ ...styles.small, marginLeft: 12 }}>Age: {getEntryAge(entry.id)}</span>
          <span style={{ ...styles.small, marginLeft: 12 }}>Complexity: {getComplexityScore(passwordPlain)}%</span>
        </div>
        <div style={styles.cardButtonRow}>
          <button className="miniButton" style={styles.miniButton} onClick={() => copyToClipboard(passwordPlain, 'Password')}>Copy Pwd</button>
          <button className="miniButton" style={styles.miniButton} onClick={() => copyToClipboard(entry.site_username, 'Username')}>Copy User</button>
          <button className="miniButton" style={styles.miniButton} onClick={() => openWebsite(entry.site)}>Open Site</button>
          <button className="miniButton" style={styles.miniButton} onClick={() => inlineEditEntry(entry)}>Edit</button>
          <button className="miniButton" style={{ ...styles.miniButton, background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)' }} onClick={() => duplicateEntry(entry)}>Duplicate</button>
          <button className="miniButton" style={{ ...styles.miniButton, background: 'linear-gradient(135deg, #ff6b6b 0%, #dc3545 100%)' }} onClick={() => deleteEntry(entry.id)}>Delete</button>
        </div>
        {showHistory === entry.id && passwordHistory[entry.id] && (
          <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
            <strong>Password History:</strong>
            {passwordHistory[entry.id].map((oldPwd, idx) => <div key={idx} style={styles.small}>Old: {oldPwd}</div>)}
          </div>
        )}
      </div>
    );
  };

  // ---------- FAVORITES ----------

  const copyToClipboard = (text, label = 'Text') => {
    navigator.clipboard.writeText(text);
    setMsg(`${label} copied`);
  };

  const duplicateEntry = async (entry) => {
    const duplicate = {
      ...entry,
      site: `${entry.site} (copy)`
    };
    try {
      await axios.post(`${API}/vault/add`, {
        userId,
        site: duplicate.site,
        site_username: duplicate.site_username,
        encrypted_password: duplicate.encrypted_password,
        notes: duplicate.notes,
        category: duplicate.category
      });
      setMsg('Entry duplicated');
      fetchVault();
    } catch (err) {
      setMsg('Error duplicating entry');
    }
  };

  const quickAddEntry = async () => {
    if (!quickAddSite || !quickAddPassword) {
      setQuickAddMessage('Site and password are required');
      return;
    }
    setSite(quickAddSite);
    setSiteUsername(quickAddUsername);
    setSitePassword(quickAddPassword);
    setNotes(quickAddNotes);
    setCategory(quickAddCategory || 'Other');
    await addOrUpdateEntry();
    setQuickAddSite('');
    setQuickAddUsername('');
    setQuickAddPassword('');
    setQuickAddNotes('');
    setQuickAddCategory('');
    setQuickAddMessage('Entry added');
    setShowQuickAdd(false);
  };

  const openWebsite = (site) => {
    const url = site.startsWith('http') ? site : `https://${site}`;
    window.open(url, '_blank', 'noopener');
  };

  const inlineEditEntry = (entry) => {
    startEdit(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleCompactSidebar = () => {
    setCompactSidebar(prev => !prev);
  };

  const toggleFocusMode = () => {
    setFocusMode(prev => !prev);
  };

  const selectText = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setMsg('Auto-selected and copied');
  };

  // ---------- PASSWORD GENERATOR ----------

  const generatePassword = () => {
    let chars = '';
    if (genLowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (genUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genNumbers) chars += '0123456789';
    if (genSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) {
      setMsg('Enable at least one character set for generator');
      return;
    }

    let result = '';
    for (let i = 0; i < genLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSitePassword(result);
  };

  const copyPassword = () => {
    if (!sitePassword) {
      setMsg('Nothing to copy');
      return;
    }
    navigator.clipboard.writeText(sitePassword);
    setMsg('Password copied to clipboard');
  };

  // ---------- EXPORT / IMPORT ----------

  const exportVault = async () => {
    try {
      const res = await axios.get(`${API}/vault/${userId}`);
      if (!res.data.success) {
        setMsg('Unable to fetch vault for export');
        return;
      }
      const vaultData = res.data.data;
      const raw = JSON.stringify(vaultData, null, 2);

      if (exportFormat === 'enc') {
        const key = masterPassword || masterInput;
        if (!key) {
          setMsg('Master password needed for encrypted export');
          return;
        }
        const encrypted = CryptoJS.AES.encrypt(raw, key).toString();
        const blob = new Blob([encrypted], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vault_export.enc';
        a.click();
        URL.revokeObjectURL(url);
        setMsg('Encrypted vault exported');
      } else {
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vault_export.json';
        a.click();
        URL.revokeObjectURL(url);
        setMsg('Vault exported');
      }
    } catch (err) {
      setMsg('Error exporting vault');
    }
  };

  const importVault = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let entries;
        const rawContent = event.target.result;
        if (file.name.endsWith('.enc') || exportFormat === 'enc') {
          const key = masterPassword || masterInput;
          if (!key) {
            setMsg('Master password required to import encrypted file');
            return;
          }
          const decrypted = CryptoJS.AES.decrypt(rawContent, key).toString(CryptoJS.enc.Utf8);
          entries = JSON.parse(decrypted);
        } else {
          entries = JSON.parse(rawContent);
        }

        if (!Array.isArray(entries)) {
          setMsg('Invalid import file format');
          return;
        }
        await axios.post(`${API}/vault/import`, { userId, entries });
        setMsg('Vault imported successfully');
        fetchVault();
      } catch (err) {
        setMsg('Error importing vault');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------- SECURITY FUNCTIONS ----------

  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    if (score <= 2) return 'Weak';
    if (score <= 4) return 'Medium';
    return 'Strong';
  };

  const checkBreach = async (pwd) => {
    const hash = CryptoJS.SHA1(pwd).toString().toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    if (breachCache[prefix]) {
      return breachCache[prefix].includes(suffix);
    }
    try {
      const res = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
      const lines = res.data.split('\n');
      const found = lines.some(line => line.split(':')[0] === suffix);
      setBreachCache(prev => ({ ...prev, [prefix]: lines.map(l => l.split(':')[0]) }));
      return found;
    } catch {
      return false;
    }
  };

  const isReused = (pwd) => usedPasswords.has(pwd);

  const calculateSecurityScore = () => {
    let score = 100;
    const pwdCounts = {};
    vaultEntries.forEach(entry => {
      const pwd = decryptPassword(entry.encrypted_password);
      pwdCounts[pwd] = (pwdCounts[pwd] || 0) + 1;
      const strength = getPasswordStrength(pwd);
      if (strength === 'Weak') score -= 10;
      if (strength === 'Medium') score -= 5;
    });
    Object.values(pwdCounts).forEach(count => {
      if (count > 1) score -= 10 * (count - 1);
    });
    // Breach would require async, so skip for score or cache
    return Math.max(0, score);
  };

  const getComplexityScore = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    score += Math.min(25, pwd.length * 2);
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[A-Z]/.test(pwd)) score += 15;
    if (/[0-9]/.test(pwd)) score += 20;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 25;
    return Math.max(0, Math.min(100, score));
  };

  const getEntryAge = (id) => {
    if (!entryTimestamps[id]) return 'Unknown';
    const days = Math.floor((Date.now() - entryTimestamps[id]) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const getReminders = () => {
    return vaultEntries
      .filter(e => {
        const ts = entryTimestamps[e.id];
        if (!ts) return false;
        const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
        return days >= 90;
      })
      .map(e => `${e.site} (${getEntryAge(e.id)})`);
  };

  const hasDuplicateUsername = (site, siteUser, currentId = null) => {
    return vaultEntries.some(e => e.site === site && e.site_username === siteUser && e.id !== currentId);
  };

  const generateStrongPassword = () => {
    setGenLength(20);
    setGenNumbers(true);
    setGenSymbols(true);
    generatePassword();
  };

  // ---------- STYLES ----------

  const styles = {
    app: {
      fontFamily: "'Inter', sans-serif",
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background 0.3s ease, color 0.3s ease'
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: compactMode ? '10px' : '20px',
      display: 'flex',
      transition: 'padding 0.3s ease'
    },
    sidebar: {
      width: isMobile ? (sidebarOpen ? '280px' : '0') : '280px',
      background: 'var(--sidebar)',
      backdropFilter: 'blur(15px)',
      borderRight: '1px solid var(--border)',
      padding: sidebarOpen || !isMobile ? '30px 20px' : '0',
      boxShadow: '2px 0 20px rgba(0,0,0,0.3)',
      transition: 'width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), padding 0.3s ease',
      overflow: 'hidden',
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 1000,
      borderRadius: '0 20px 20px 0'
    },
    main: {
      flex: 1,
      padding: compactMode ? '10px' : '20px',
      transition: 'padding 0.3s ease'
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '15px 20px',
      marginBottom: '10px',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      borderRadius: '12px',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      textAlign: 'left',
      fontSize: '16px'
    },
    navItemActive: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    hamburger: {
      display: isMobile ? 'block' : 'none',
      position: 'fixed',
      top: '20px',
      left: '20px',
      zIndex: 1001,
      background: 'var(--card)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '12px',
      cursor: 'pointer',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      color: 'var(--text-primary)',
      transition: 'all 0.3s ease'
    },
    overlay: {
      display: isMobile && sidebarOpen ? 'block' : 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 999
    },
    heading: {
      fontSize: '32px',
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: '30px',
      color: 'var(--text-primary)',
      transition: 'color 0.3s ease'
    },
    input: {
      display: 'block',
      width: '100%',
      padding: '15px',
      marginBottom: '15px',
      boxSizing: 'border-box',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      background: 'var(--card)',
      backdropFilter: 'blur(5px)',
      color: 'var(--text-primary)',
      fontSize: '16px',
      transition: 'all 0.3s ease',
      outline: 'none'
    },
    select: {
      display: 'block',
      width: '100%',
      padding: '15px',
      marginBottom: '15px',
      boxSizing: 'border-box',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      background: 'var(--dropdown)',
      backdropFilter: 'blur(5px)',
      color: 'var(--text-primary)',
      fontSize: '16px',
      transition: 'all 0.3s ease',
      outline: 'none'
    },
    button: {
      padding: '12px 24px',
      marginRight: '8px',
      marginBottom: '8px',
      cursor: 'pointer',
      background: 'linear-gradient(135deg, #6a5cff 0%, #00d4ff 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '25px',
      fontSize: '14px',
      fontWeight: 'bold',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      boxShadow: '0 4px 15px rgba(106,92,255,0.4)',
      position: 'relative',
      overflow: 'hidden'
    },
    msg: {
      color: '#ff6b6b',
      marginBottom: '15px',
      padding: '12px',
      borderRadius: '10px',
      background: 'rgba(255,107,107,0.1)',
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(255,107,107,0.3)',
      transition: 'all 0.3s ease'
    },
    card: {
      background: 'var(--card)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border)',
      padding: compactMode ? '20px' : '25px',
      marginBottom: '20px',
      borderRadius: '15px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      animation: 'fadeIn 0.5s ease-out'
    },
    cardButtonRow: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '15px'
    },
    miniButton: {
      padding: '8px 16px',
      fontSize: '12px',
      borderRadius: '20px',
      border: 'none',
      cursor: 'pointer',
      background: 'linear-gradient(135deg, #6a5cff 0%, #00d4ff 100%)',
      color: '#fff',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      boxShadow: '0 2px 10px rgba(106,92,255,0.3)'
    },
    linkText: {
      color: '#00d4ff',
      cursor: 'pointer',
      textDecoration: 'none',
      transition: 'color 0.3s ease'
    },
    row: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: '15px'
    },
    small: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
      transition: 'color 0.3s ease'
    },
    hr: {
      margin: '25px 0',
      border: 'none',
      borderTop: '1px solid var(--border)',
      transition: 'border-color 0.3s ease'
    },
    collapsible: {
      marginBottom: '15px'
    },
    collapsibleHeader: {
      cursor: 'pointer',
      background: 'var(--card)',
      backdropFilter: 'blur(5px)',
      border: '1px solid var(--border)',
      padding: '15px',
      borderRadius: '10px',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'var(--text-primary)'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '20px'
    },
    list: {
      display: 'block'
    },
    favicon: {
      width: '24px',
      height: '24px',
      marginRight: '12px',
      borderRadius: '4px'
    },
    favorite: {
      cursor: 'pointer',
      fontSize: '20px',
      marginLeft: 'auto',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    },
    fab: {
      position: 'fixed',
      right: '30px',
      bottom: '30px',
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #6a5cff 0%, #00d4ff 100%)',
      border: 'none',
      color: '#fff',
      fontSize: '24px',
      cursor: 'pointer',
      boxShadow: '0 8px 25px rgba(106,92,255,0.5)',
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    },
    categoryColor: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      display: 'inline-block',
      marginRight: '10px'
    },
    loginCard: {
      background: 'var(--card)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '40px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      width: '100%',
      maxWidth: '400px',
      animation: 'loginCardEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      transition: 'background 0.3s ease'
    },
    topBar: {
      background: 'var(--card)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border)',
      borderRadius: '15px',
      padding: '15px 20px',
      marginBottom: '20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'all 0.3s ease'
    },
    modal: {
      background: 'var(--card)',
      backdropFilter: 'blur(15px)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
      width: 'min(90vw, 450px)',
      animation: 'fadeInUp 0.6s ease-out',
      transition: 'background 0.25s ease'
    }
  };

  // ---------- LOGIN SCREEN ----------

  if (screen === 'login') {
    return (
      <div className="app" style={styles.app}>
        <div style={{ ...styles.container, maxWidth: 'none', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div className="auth-card" style={styles.loginCard}>
            <h2 style={styles.heading}>🔐 Secure Password Vault</h2>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)' }}>Login to access your vault</p>
            {msg && <p style={styles.msg}>{msg}</p>}
            <input className="input" style={styles.input} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="input" style={styles.input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <div style={styles.row}>
              <button className="primary-button button" style={styles.button} onClick={login}>Login</button>
              <button className="secondary-button button" style={{ ...styles.button, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => { setScreen('register'); setMsg(''); }}>Register</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- REGISTER SCREEN ----------

  if (screen === 'register') {
    return (
      <div className="app" style={styles.app}>
        <div style={{ ...styles.container, maxWidth: 'none', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div className="auth-card" style={styles.loginCard}>
            <h2 style={styles.heading}>🔐 Create Account</h2>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)' }}>Sign up with master password</p>
            {msg && <p style={styles.msg}>{msg}</p>}
            <input className="input" style={styles.input} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="input" style={styles.input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <input className="input" style={styles.input} placeholder="Master Password (8+ chars)" type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} />
            <div style={styles.row}>
              <button className="primary-button button" style={styles.button} onClick={register}>Register</button>
              <button className="secondary-button button" style={{ ...styles.button, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => { setScreen('login'); setMsg(''); setMasterPassword(''); }}>Back to Login</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'master-password') {
    return (
      <div className="app" style={styles.app}>
        <div style={{ ...styles.container, maxWidth: 'none', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div className="auth-card" style={styles.loginCard}>
            <h2 style={styles.heading}>🔓 Unlock Vault</h2>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)' }}>Enter your master password</p>
            {msg && <p style={styles.msg}>{msg}</p>}
            <input className="input" style={styles.input} placeholder="Master Password" type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} />
            <div style={styles.row}>
              <button className="primary-button button" style={styles.button} onClick={verifyMaster}>Unlock</button>
              <button className="secondary-button button" style={{ ...styles.button, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)' }} onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- DASHBOARD ----------

  let filteredEntries = [...vaultEntries];
  if (currentView === 'favorites') {
    filteredEntries = filteredEntries.filter(e => e.is_favorite);
  }
  if (showFavorites) {
    filteredEntries = filteredEntries.filter(e => e.is_favorite);
  }
  if (filterCategory && filterCategory !== 'All') {
    filteredEntries = filteredEntries.filter(e => (e.category || 'Other') === filterCategory);
  }
  if (searchSite) {
    const val = searchSite.toLowerCase();
    filteredEntries = filteredEntries.filter(e => e.site.toLowerCase().includes(val));
  }
  if (searchUser) {
    const val = searchUser.toLowerCase();
    filteredEntries = filteredEntries.filter(e => (e.site_username || '').toLowerCase().includes(val));
  }

  const groupedEntries = currentView === 'categories' ? filteredEntries.reduce((acc, entry) => {
    const cat = entry.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {}) : null;

  const weakEntries = filteredEntries.filter(entry => getPasswordStrength(decryptPassword(entry.encrypted_password)) === 'Weak');

  const sidebarStyle = {
    ...styles.sidebar,
    left: focusMode ? '-100px' : styles.sidebar.left,
    width: compactSidebar ? '76px' : styles.sidebar.width,
    padding: compactSidebar ? '12px 8px' : styles.sidebar.padding,
    opacity: focusMode ? 0 : 1,
    transform: focusMode ? 'translateX(-110%)' : 'translateX(0)',
    transition: 'all 0.25s ease'
  };

  const containerStyle = {
    ...styles.container,
    marginLeft: focusMode ? '0' : styles.container.marginLeft,
    width: '100%'
  };

  const mainStyle = {
    ...styles.main,
    width: '100%'
  };

  return (
    <div className="app" style={styles.app}>
      <style>
        {`
          :root {
            --bg: #f5f7fb;
            --card: rgba(255,255,255,0.8);
            --text-primary: #111827;
            --text-secondary: #4b5563;
            --border: rgba(0,0,0,0.08);
            --sidebar: #ffffff;
            --dropdown: #ffffff;
            --input-bg: rgba(255,255,255,0.9);
          }
          body.dark {
            --bg: #0b0f1a;
            --card: rgba(18,24,43,0.8);
            --text-primary: #e6e9f0;
            --text-secondary: #9aa4bf;
            --border: rgba(255,255,255,0.08);
            --sidebar: #12182b;
            --dropdown: #1a2035;
            --input-bg: rgba(18,24,43,0.8);
          }
          body.dark .app {
            background: linear-gradient(135deg, #0b0f1a 0%, #12182b 50%, #0b0f1a 100%);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
          }
          body.dark .app::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 20% 80%, rgba(106,92,255,0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(0,212,255,0.1) 0%, transparent 50%),
                        radial-gradient(circle at 40% 40%, rgba(255,255,255,0.05) 0%, transparent 50%);
            animation: float 20s ease-in-out infinite;
            z-index: -1;
          }
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33% { transform: translateY(-10px) rotate(120deg); }
            66% { transform: translateY(10px) rotate(240deg); }
          }
          .button:hover {
            transform: translateY(-2px);
            boxShadow: 0 6px 20px rgba(106,92,255,0.6);
          }
          .navItem:hover {
            background: rgba(var(--text-primary), 0.1);
            transform: translateX(5px);
          }
          .card:hover {
            transform: translateY(-5px) scale(1.02);
            boxShadow: 0 15px 40px rgba(0,0,0,0.4);
          }
          .fab:hover {
            transform: scale(1.1);
            boxShadow: 0 12px 35px rgba(106,92,255,0.7);
          }
          .input:focus {
            border: 1px solid #00d4ff;
            boxShadow: 0 0 10px rgba(0,212,255,0.5);
          }
          .collapsibleHeader:hover {
            background: rgba(var(--text-primary), 0.05);
          }
          .favorite:hover {
            transform: scale(1.2);
          }
          .miniButton:hover {
            transform: translateY(-1px);
            boxShadow: 0 4px 15px rgba(106,92,255,0.5);
          }
          input::placeholder, select::placeholder {
            color: var(--text-secondary);
          }
          select {
            background: var(--dropdown);
            color: var(--text-primary);
          }
          select option {
            background: var(--dropdown);
            color: var(--text-primary);
          }
          .sidebar-item {
            color: var(--text-primary);
          }
          .sidebar-item:hover {
            background: rgba(106,92,255,0.15);
          }
          .sidebar-item.active {
            background: linear-gradient(135deg,#6a5cff,#00d4ff);
            color: #ffffff;
          }
          .sidebar-item.active span,
          .sidebar-item.active svg {
            color: #ffffff;
            fill: #ffffff;
          }
          .secondary-button {
            background: rgba(0,0,0,0.05);
            color: var(--text-primary);
          }
          .primary-button {
            color: #ffffff;
          }
          .auth-card {
            background: var(--card);
            color: var(--text-primary);
          }
          input, select, textarea {
            background: var(--input-bg);
            color: var(--text-primary);
            border: 1px solid var(--border);
          }
          ::placeholder {
            color: var(--text-secondary);
          }
          * {
            transition: background .2s ease, color .2s ease;
          }
        `}
      </style>
      <button className="hamburger" style={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      <div style={styles.overlay} onClick={() => setSidebarOpen(false)}></div>
      <div style={containerStyle}>
        <div style={sidebarStyle}>
          <h3 style={{ marginTop: 0, fontSize: compactSidebar ? '14px' : '16px' }}>{compactSidebar ? 'Menu' : 'Navigation'}</h3>
          <button className="navItem" style={{ ...styles.navItem, ...(currentView === 'dashboard' ? styles.navItemActive : {}) }} onClick={() => setCurrentView('dashboard')}>📊 Dashboard</button>
          <button className="navItem" style={{ ...styles.navItem, ...(currentView === 'vault' ? styles.navItemActive : {}) }} onClick={() => setCurrentView('vault')}>🔒 Vault</button>
          <button className="navItem" style={{ ...styles.navItem, ...(currentView === 'favorites' ? styles.navItemActive : {}) }} onClick={() => setCurrentView('favorites')}>⭐ Favorites</button>
          <button className="navItem" style={{ ...styles.navItem, ...(currentView === 'categories' ? styles.navItemActive : {}) }} onClick={() => setCurrentView('categories')}>📁 Categories</button>
          <button className="navItem" style={{ ...styles.navItem, ...(currentView === 'settings' ? styles.navItemActive : {}) }} onClick={() => setCurrentView('settings')}>⚙️ Settings</button>
          <button className="navItem" style={{ ...styles.navItem, background: 'linear-gradient(135deg, #ff6b6b 0%, #dc3545 100%)', color: '#ffffff' }} onClick={logout}>🚪 Logout</button>
        </div>
        <div style={mainStyle}>
          <div style={styles.topBar}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <input className="input" style={{ ...styles.input, maxWidth: '300px', margin: 0 }} placeholder="Search site" value={searchSite} onChange={e => setSearchSite(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="button" style={styles.button} onClick={toggleCompactSidebar}>{compactSidebar ? '➡' : '⬅'}</button>
              <button className="button" style={styles.button} onClick={toggleFocusMode}>{focusMode ? 'Exit Focus' : 'Focus Mode'}</button>
              <button className="button" style={styles.button} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>🌙</button>
              <button className="button" style={styles.button} onClick={() => setCompactMode(!compactMode)}>📏</button>
              <button className="button" style={styles.button} onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>{viewMode === 'list' ? '⊞' : '☰'}</button>
              <button className="button" style={styles.button} onClick={() => setShowQuickAdd(true)}>+ Add</button>
            </div>
          </div>

          {msg && <p style={styles.msg}>{msg}</p>}

          {showQuickAdd && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={styles.modal}>
                <h3 style={{ marginTop: 0, marginBottom: 10 }}>Quick Add Entry</h3>
                {quickAddMessage && <p style={{ ...styles.msg, backgroundColor: '#d4edda', color: '#155724' }}>{quickAddMessage}</p>}
                <input className="input" style={styles.input} placeholder="Site" value={quickAddSite} onChange={e => setQuickAddSite(e.target.value)} />
                <input className="input" style={styles.input} placeholder="Username" value={quickAddUsername} onChange={e => setQuickAddUsername(e.target.value)} />
                <input className="input" style={styles.input} placeholder="Password" value={quickAddPassword} onChange={e => setQuickAddPassword(e.target.value)} />
                <input className="input" style={styles.input} placeholder="Category" value={quickAddCategory} onChange={e => setQuickAddCategory(e.target.value)} />
                <input className="input" style={styles.input} placeholder="Notes" value={quickAddNotes} onChange={e => setQuickAddNotes(e.target.value)} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="button" style={{ ...styles.button, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => setShowQuickAdd(false)}>Cancel</button>
                  <button className="button" style={styles.button} onClick={quickAddEntry}>Add</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ ...styles.row, marginBottom: 16 }}>
            <input className="input" style={{ ...styles.input, maxWidth: 180 }} placeholder="Search username" value={searchUser} onChange={e => setSearchUser(e.target.value)} />
            <button className="button" style={styles.button} onClick={() => setShowFavorites(prev => !prev)}>{showFavorites ? 'All entries' : 'Favorites only'}</button>
            <select className="select" style={{ ...styles.select, maxWidth: 170 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {currentView === 'dashboard' && (
            <div>
              <h3>Dashboard</h3>
              <p>Total Entries: {vaultEntries.length}</p>
              <p>Favorites: {vaultEntries.filter(e => e.is_favorite).length}</p>
              <p>Categories: {new Set(vaultEntries.map(e => e.category || 'Other')).size}</p>
              <p>Security Score: {calculateSecurityScore()}/100</p>
              <p>Duplicates: {vaultEntries.filter(e => hasDuplicateUsername(e.site, e.site_username, e.id)).length}</p>
              <p>Old entries (90+ days): {getReminders().length}</p>
              {getReminders().length > 0 && (
                <div style={{ ...styles.msg, backgroundColor: '#fff3cd', color: '#856404' }}>
                  <strong>Reminder:</strong> Update passwords for: {getReminders().join(', ')}
                </div>
              )}
            </div>
          )}

          {(currentView === 'vault' || currentView === 'favorites') && (
            <div>
              {/* Collapsible Add Entry */}
              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setAddEntryCollapsed(!addEntryCollapsed)}>
                  <strong>{addEntryCollapsed ? '▶' : '▼'} Add / Edit Entry</strong>
                </div>
                {!addEntryCollapsed && (
                  <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginTop: '10px' }}>
                    <input style={styles.input} placeholder="Site (e.g. google.com)" value={site} onChange={e => setSite(e.target.value)} />
                    <input style={styles.input} placeholder="Username / Email" value={siteUsername} onChange={e => setSiteUsername(e.target.value)} />
                    <input style={styles.input} placeholder="Password" value={sitePassword} onChange={e => setSitePassword(e.target.value)} />
                    <div style={styles.row}>
                      <span>Strength: <strong style={{ color: getPasswordStrength(sitePassword) === 'Weak' ? '#dc3545' : getPasswordStrength(sitePassword) === 'Medium' ? '#ffc107' : '#28a745' }}>{getPasswordStrength(sitePassword)}</strong></span>
                      {getPasswordStrength(sitePassword) !== 'Strong' && <button style={styles.button} onClick={generateStrongPassword}>Suggest Stronger</button>}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px' }}>Complexity: {getComplexityScore(sitePassword)}%</label>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#ddd', borderRadius: '4px' }}>
                        <div style={{ width: `${getComplexityScore(sitePassword)}%`, height: '100%', backgroundColor: getComplexityScore(sitePassword) > 80 ? '#28a745' : getComplexityScore(sitePassword) > 50 ? '#ffc107' : '#dc3545', borderRadius: '4px' }} />
                      </div>
                    </div>
                    {isReused(sitePassword) && <div style={{ ...styles.msg, backgroundColor: '#fff3cd', color: '#856404' }}>This password is reused elsewhere. Use a unique one.</div>}
                    <select className="select" style={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
                      <option value="">Select Category</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <input style={styles.input} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
                    <div style={styles.row}>
                      <button style={styles.button} onClick={addOrUpdateEntry}>{editId ? 'Update' : 'Add'}</button>
                      {editId && <button style={{ ...styles.button, backgroundColor: '#6c757d' }} onClick={clearForm}>Cancel</button>}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Password Generator */}
              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setGenCollapsed(!genCollapsed)}>
                  <strong>{genCollapsed ? '▶' : '▼'} Password Generator</strong>
                </div>
                {!genCollapsed && (
                  <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginTop: '10px', transition: 'all 0.3s ease' }}>
                    <div style={styles.row}>
                      <label>Length: {genLength}</label>
                      <input type="range" min="8" max="64" value={genLength} onChange={e => setGenLength(parseInt(e.target.value))} />
                    </div>
                    <div style={styles.row}>
                      <label><input type="checkbox" checked={genLowercase} onChange={e => setGenLowercase(e.target.checked)} /> Lowercase</label>
                      <label><input type="checkbox" checked={genUppercase} onChange={e => setGenUppercase(e.target.checked)} /> Uppercase</label>
                      <label><input type="checkbox" checked={genNumbers} onChange={e => setGenNumbers(e.target.checked)} /> Numbers</label>
                      <label><input type="checkbox" checked={genSymbols} onChange={e => setGenSymbols(e.target.checked)} /> Symbols</label>
                    </div>
                    <div style={styles.row}>
                      <button style={styles.button} onClick={generatePassword}>Generate</button>
                      <button style={styles.button} onClick={copyPassword}>Copy</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Import/Export */}
              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setImportCollapsed(!importCollapsed)}>
                  <strong>{importCollapsed ? '▶' : '▼'} Import / Export</strong>
                </div>
                {!importCollapsed && (
                  <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginTop: '10px' }}>
                    <div style={styles.row}>
                      <label style={{ ...styles.input, maxWidth: '160px' }}>
                        Format:
                      <select className="select" value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={styles.select}>
                          <option value="json">JSON</option>
                          <option value="enc">Encrypted (.enc)</option>
                        </select>
                      </label>
                      <button style={styles.button} onClick={exportVault}>Export Vault ({exportFormat === 'enc' ? 'Encrypted' : 'JSON'})</button>
                      <label style={styles.button}>
                        Import Vault
                        <input type="file" accept={exportFormat === 'enc' ? '.enc' : '.json'} onChange={importVault} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {exportFormat === 'enc' && (
                      <p style={styles.small}>Encrypted import/export uses your current master password.</p>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setFavCollapsed(!favCollapsed)}>
                  <strong>{favCollapsed ? '▶' : '▼'} Favorites section ({filteredEntries.filter(e => e.is_favorite).length})</strong>
                </div>
                <div style={{ maxHeight: favCollapsed ? '0' : '700px', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                  {filteredEntries.filter(e => e.is_favorite).length === 0 && !favCollapsed && <p style={styles.small}>No favorite entries.</p>}
                  <div style={viewMode === 'grid' ? styles.grid : styles.list}>
                    {filteredEntries.filter(e => e.is_favorite).map((entry, idx) => renderEntryCard(entry, idx))}
                  </div>
                </div>
              </div>

              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setAllCollapsed(!allCollapsed)}>
                  <strong>{allCollapsed ? '▶' : '▼'} All entries ({filteredEntries.length})</strong>
                </div>
                <div style={{ maxHeight: allCollapsed ? '0' : '1200px', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                  {filteredEntries.length === 0 && !allCollapsed && <p style={styles.small}>No entries yet. Add one above.</p>}
                  <div style={viewMode === 'grid' ? styles.grid : styles.list}>
                    {filteredEntries.map((entry, idx) => renderEntryCard(entry, idx))}
                  </div>
                </div>
              </div>

              <div style={styles.collapsible}>
                <div className="collapsibleHeader" style={styles.collapsibleHeader} onClick={() => setWeakCollapsed(!weakCollapsed)}>
                  <strong>{weakCollapsed ? '▶' : '▼'} Weak passwords ({weakEntries.length})</strong>
                </div>
                <div style={{ maxHeight: weakCollapsed ? '0' : '800px', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                  {weakEntries.length === 0 && !weakCollapsed && <p style={styles.small}>No weak entries detected.</p>}
                  <div style={viewMode === 'grid' ? styles.grid : styles.list}>
                    {weakEntries.map((entry, idx) => renderEntryCard(entry, idx))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'categories' && (
            <div>
              <h3>Categories</h3>
              {Object.keys(groupedEntries).map(cat => (
                <div key={cat}>
                  <h4 style={{ color: getCategoryColor(cat) }}>{cat} ({groupedEntries[cat].length})</h4>
                  <div style={viewMode === 'grid' ? styles.grid : styles.list}>
                    {groupedEntries[cat].map(entry => (
                      <div key={entry.id} style={styles.card} className="card">
                        <div style={styles.row}>
                          <img src={`https://www.google.com/s2/favicons?domain=${entry.site}`} alt="" style={styles.favicon} onError={(e) => e.target.style.display = 'none'} />
                          <strong>{entry.site}</strong>
                          <span style={styles.favorite} onClick={() => toggleFavorite(entry.id)}>{entry.is_favorite ? '⭐' : '☆'}</span>
                        </div>
                        <span style={styles.small}>User: {entry.site_username}</span><br />
                        <span style={styles.small}>Password: {decryptPassword(entry.encrypted_password)}</span><br />
                        {entry.notes && <span style={styles.small}>Notes: {entry.notes}</span>}
                        <div style={{ marginTop: '8px' }}>
                          <button style={styles.button} onClick={() => startEdit(entry)}>Edit</button>
                          <button style={{ ...styles.button, backgroundColor: '#dc3545' }} onClick={() => deleteEntry(entry.id)}>Delete</button>
                          <button style={styles.button} onClick={() => setShowHistory(showHistory === entry.id ? null : entry.id)}>History</button>
                        </div>
                        {showHistory === entry.id && passwordHistory[entry.id] && (
                          <div style={{ marginTop: '10px' }}>
                            <strong>Password History:</strong>
                            {passwordHistory[entry.id].map((oldPwd, idx) => <div key={idx} style={styles.small}>Old: {oldPwd}</div>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentView === 'settings' && (
            <div>
              <h3>Settings</h3>
              <div style={styles.row}>
                <label>Theme: </label>
                <button style={styles.button} onClick={() => setTheme('light')}>Light</button>
                <button style={styles.button} onClick={() => setTheme('dark')}>Dark</button>
              </div>
              <div style={styles.row}>
                <label><input type="checkbox" checked={compactMode} onChange={e => setCompactMode(e.target.checked)} /> Compact Mode</label>
              </div>
              <div style={styles.row}>
                <label>View Mode: </label>
                <button style={styles.button} onClick={() => setViewMode('list')}>List</button>
                <button style={styles.button} onClick={() => setViewMode('grid')}>Grid</button>
              </div>
              <div style={styles.row}>
                <label><input type="checkbox" checked={pinEnabled} onChange={e => {
                  setPinEnabled(e.target.checked); localStorage.setItem('pinEnabled', e.target.checked ? 'true' : 'false');
                  if (!e.target.checked) {
                    setPinHash(''); localStorage.removeItem('pinHash');
                  }
                }} /> Enable PIN unlock</label>
              </div>
              <div style={styles.row}>
                <button style={styles.button} onClick={() => {
                  localStorage.removeItem('masterHash');
                  setScreen('master-password');
                  setMsg('Please enter your master password again.');
                }}>Reset Master Password</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <button className="fab" style={styles.fab} onClick={() => setShowQuickAdd(true)}>+</button>
    </div>
  );
}

export default App;