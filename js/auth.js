// ════════════════════════════════════════════════════════════════
// AUTH — Login / Logout / Sessie herstel
// ════════════════════════════════════════════════════════════════

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');
  const btnEl = document.getElementById('login-btn');
  const ldEl  = document.getElementById('login-loading');
  errEl.style.display = 'none';
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
    errEl.textContent = 'Inloggen mislukt. Controleer je e-mail en wachtwoord.';
    errEl.style.display = 'block';
  } finally {
    btnEl.disabled = false;
    ldEl.style.display = 'none';
  }
}

async function doLogout() {
  try { await supaAuth('/auth/v1/logout', {}); } catch (e) {}
  currentSession = null; currentUser = null;
  localStorage.removeItem('crm_session');
  DB = { besturen: [], scholen: [], contacten: [], dossiers: [], facturen: [], trainingen: [], uitvoeringen: [] };
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pw').value = '';
}

// Enter key triggers login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    doLogin();
  }
});

// ── Geen automatische sessie-herstel: gebruiker moet altijd expliciet
//    op "Inloggen" klikken. Oude sessie wordt gewist zodat er geen
//    stille auto-login meer plaatsvindt.
localStorage.removeItem('crm_session');
