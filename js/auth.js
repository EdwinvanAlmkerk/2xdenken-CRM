// ════════════════════════════════════════════════════════════════
// AUTH — Login / Logout / Wachtwoord reset
// ════════════════════════════════════════════════════════════════

let passwordRecoverySession = null;

function setLoginError(message = '') {
  const errEl = document.getElementById('login-error');
  const infoEl = document.getElementById('login-info');
  if (infoEl) {
    infoEl.style.display = 'none';
    infoEl.textContent = '';
  }
  if (!errEl) return;
  errEl.textContent = message;
  errEl.style.display = message ? 'block' : 'none';
}

function setLoginInfo(message = '') {
  const errEl = document.getElementById('login-error');
  const infoEl = document.getElementById('login-info');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
  if (!infoEl) return;
  infoEl.textContent = message;
  infoEl.style.display = message ? 'block' : 'none';
}

function getResetRedirectUrl() {
  const isGitHubPages = window.location.hostname.endsWith('github.io');
  return isGitHubPages
    ? 'https://edwinvanalmkerk.github.io/2xdenken-CRM/'
    : window.location.href.split('#')[0].split('?')[0];
}

function toggleResetMode(isRecovery = false) {
  const loginPanel = document.getElementById('login-form-panel');
  const resetPanel = document.getElementById('reset-password-panel');
  const titleEl = document.getElementById('login-title');
  const subEl = document.getElementById('login-sub');

  if (loginPanel) loginPanel.style.display = isRecovery ? 'none' : 'block';
  if (resetPanel) resetPanel.style.display = isRecovery ? 'block' : 'none';
  if (titleEl) titleEl.textContent = isRecovery ? 'Nieuw wachtwoord instellen' : 'Welkom terug';
  if (subEl) subEl.textContent = isRecovery
    ? 'Kies een sterk wachtwoord voor je account'
    : 'Log in op je 2xDenken CRM';
}

function clearRecoveryUrl() {
  if (window.location.hash || window.location.search) {
    window.history.replaceState({}, document.title, getResetRedirectUrl());
  }
}

async function requestPasswordReset() {
  const email = document.getElementById('login-email').value.trim();
  const btnEl = document.getElementById('reset-request-btn');

  if (!email) {
    setLoginError('Vul eerst je e-mailadres in.');
    document.getElementById('login-email').focus();
    return;
  }

  btnEl.disabled = true;
  setLoginError('');
  setLoginInfo('');

  try {
    await supaAuth(`/auth/v1/recover?redirect_to=${encodeURIComponent(getResetRedirectUrl())}`, { email });
    setLoginInfo('Als dit account bestaat, is er een resetlink naar je e-mailadres verstuurd.');
  } catch (e) {
    console.error(e);
    setLoginError('Resetlink versturen mislukt. Probeer het opnieuw.');
  } finally {
    btnEl.disabled = false;
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  const btnEl = document.getElementById('login-btn');
  const ldEl = document.getElementById('login-loading');

  setLoginError('');
  setLoginInfo('');

  if (!email || !pw) {
    setLoginError('Vul je e-mailadres en wachtwoord in.');
    return;
  }

  btnEl.disabled = true;
  ldEl.style.display = 'block';

  try {
    const data = await supaAuth('/auth/v1/token?grant_type=password', { email, password: pw });
    currentSession = data;
    currentUser = { name: data.user?.email?.split('@')[0] || 'Gebruiker', email: data.user?.email };
    localStorage.setItem('crm_session', JSON.stringify(data));
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebar-user-label').textContent = currentUser.name;
    await loadAllData();
    navigate('dashboard');
  } catch (e) {
    console.error(e);
    setLoginError('Inloggen mislukt. Controleer je e-mail en wachtwoord.');
  } finally {
    btnEl.disabled = false;
    ldEl.style.display = 'none';
  }
}

async function updateForgottenPassword() {
  const pw = document.getElementById('reset-new-pw').value;
  const confirmPw = document.getElementById('reset-confirm-pw').value;
  const btnEl = document.getElementById('reset-password-btn');

  setLoginError('');

  if (!passwordRecoverySession?.access_token) {
    setLoginError('Deze resetlink is ongeldig of verlopen. Vraag een nieuwe resetmail aan.');
    return;
  }
  if (!pw || pw.length < 8) {
    setLoginError('Gebruik een wachtwoord van minimaal 8 tekens.');
    return;
  }
  if (pw !== confirmPw) {
    setLoginError('De wachtwoorden komen niet overeen.');
    return;
  }

  btnEl.disabled = true;

  try {
    const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${passwordRecoverySession.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: pw })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Wachtwoord wijzigen mislukt.');
    }

    passwordRecoverySession = null;
    currentSession = null;
    currentUser = null;
    localStorage.removeItem('crm_session');
    document.getElementById('reset-new-pw').value = '';
    document.getElementById('reset-confirm-pw').value = '';
    clearRecoveryUrl();
    toggleResetMode(false);
    setLoginInfo('Je wachtwoord is bijgewerkt. Je kunt nu inloggen met je nieuwe wachtwoord.');
  } catch (e) {
    console.error(e);
    setLoginError(e.message || 'Wachtwoord wijzigen mislukt.');
  } finally {
    btnEl.disabled = false;
  }
}

function showLoginMode() {
  passwordRecoverySession = null;
  clearRecoveryUrl();
  toggleResetMode(false);
  setLoginError('');
}

async function initPasswordRecoveryFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  const type = hashParams.get('type') || searchParams.get('type');
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
  const tokenHash = hashParams.get('token_hash') || searchParams.get('token_hash');
  const error = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');

  toggleResetMode(false);

  if (error) {
    setLoginError(decodeURIComponent(error));
    return;
  }

  if (type !== 'recovery') return;

  try {
    setLoginInfo('Resetlink wordt verwerkt...');

    if (accessToken) {
      passwordRecoverySession = { access_token: accessToken, refresh_token: refreshToken || null };
    } else if (tokenHash) {
      const data = await supaAuth('/auth/v1/verify', { type: 'recovery', token_hash: tokenHash });
      passwordRecoverySession = { access_token: data.access_token, refresh_token: data.refresh_token || null };
    } else {
      setLoginError('Deze resetlink mist de benodigde gegevens. Vraag een nieuwe resetmail aan.');
      return;
    }

    toggleResetMode(true);
    setLoginInfo('Kies hieronder een nieuw wachtwoord.');
  } catch (e) {
    console.error(e);
    setLoginError('Deze resetlink is ongeldig of verlopen. Vraag een nieuwe resetmail aan.');
  }
}

async function doLogout() {
  try { await supaAuth('/auth/v1/logout', {}); } catch (e) {}
  currentSession = null;
  currentUser = null;
  passwordRecoverySession = null;
  localStorage.removeItem('crm_session');
  DB = { besturen: [], scholen: [], contacten: [], dossiers: [], facturen: [], trainingen: [], uitvoeringen: [] };
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('reset-new-pw').value = '';
  document.getElementById('reset-confirm-pw').value = '';
  toggleResetMode(false);
  setLoginError('');
}

// Enter key triggers the active auth action
window.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || document.getElementById('login-screen').style.display === 'none') return;
  if (document.getElementById('reset-password-panel').style.display !== 'none') {
    updateForgottenPassword();
  } else {
    doLogin();
  }
});

// ── Geen automatische sessie-herstel: gebruiker moet altijd expliciet
//    op "Inloggen" klikken. Oude sessie wordt gewist zodat er geen
//    stille auto-login meer plaatsvindt.
localStorage.removeItem('crm_session');
initPasswordRecoveryFromUrl();
