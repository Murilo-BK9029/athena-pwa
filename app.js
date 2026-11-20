const STORAGE_KEYS = {
  CONFIG: 'athena_cfg_v1',
  CACHE: 'athena_cache_v1',
  PEOPLE: 'athena_people_v1',
  HIDDEN_PEOPLE: 'athena_hidden_people_v1',
  RECONCILED: 'athena_reconciled_months_v1',
  THEME: 'athena_theme_v1',
  CARDS_CONFIG: 'athena_cards_config_v1'
};

const DEFAULT_PEOPLE = ['MAE', 'ERIC', 'ANDERSON'];
const ALLOWED_THEMES = ['blue-dark', 'white-white', 'dark', 'blue-white'];

const DEFAULT_CARD_RULE = {
  closingMode: 'DAY',
  closingDay: 25,
  dueMode: 'DAYS_AFTER',
  dueDays: 6,
  dueDay: 6
};

const DEFAULT_CARDS_CONFIG = {
  Nubank: { ...DEFAULT_CARD_RULE, closingDay: 25, dueMode: 'DAYS_AFTER', dueDays: 6, dueDay: 6 },
  'C6 Bank': { ...DEFAULT_CARD_RULE, closingMode: 'LAST', closingDay: 28, dueMode: 'DAYS_AFTER', dueDays: 7, dueDay: 7 },
  'Mercado Pago': { ...DEFAULT_CARD_RULE, closingDay: 20, dueMode: 'DAY', dueDays: 6, dueDay: 28 }
};

const MONTH_NAMES_FULL = {
  '01': 'JANEIRO',
  '02': 'FEVEREIRO',
  '03': 'MARÇO',
  '04': 'ABRIL',
  '05': 'MAIO',
  '06': 'JUNHO',
  '07': 'JULHO',
  '08': 'AGOSTO',
  '09': 'SETEMBRO',
  '10': 'OUTUBRO',
  '11': 'NOVEMBRO',
  '12': 'DEZEMBRO'
};

const MONTH_NAMES_SHORT = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez'
};

const CANONICAL_TEXT_MAP = {
  salario: 'Salário',
  '13 salario': '13º Salário',
  '13o salario': '13º Salário',
  'free lancer': 'Freelancer',
  freelancer: 'Freelancer',
  supermercado: 'Supermercado',
  ifood: 'Ifood',
  'delivery / ifood': 'Delivery / Ifood',
  alimentacao: 'Alimentação',
  reembolso: 'Reembolso',
  placa_solar: 'Placa Solar',
  'placa solar': 'Placa Solar',
  moto: 'Moto',
  'transporte / moto': 'Transporte / Moto',
  seguros: 'Seguros',
  'saude / seguros': 'Saúde / Seguros',
  'casa / contas': 'Casa / Contas',
  investimentos: 'Investimentos',
  educacao: 'Educação',
  'lazer / jogos': 'Lazer / Jogos',
  outros: 'Outros',
  geral: 'Outros'
};

const CANONICAL_ACCOUNT_MAP = {
  nubank: 'Nubank',
  nu: 'Nubank',
  nb: 'Nubank',
  'c6 bank': 'C6 Bank',
  c6: 'C6 Bank',
  'mercado pago': 'Mercado Pago',
  mp: 'Mercado Pago',
  btg: 'BTG',
  'btg pactual': 'BTG',
  'banco do brasil': 'Banco do Brasil',
  bb: 'Banco do Brasil',
  caixa: 'Caixa',
  'caixa economica': 'Caixa',
  'caixa econômica': 'Caixa',
  itau: 'Itaú',
  itaú: 'Itaú',
  bradesco: 'Bradesco',
  santander: 'Santander',
  inter: 'Inter',
  sicredi: 'Sicredi',
  banrisul: 'Banrisul',
  picpay: 'PicPay',
  xp: 'XP',
  dinheiro: 'Dinheiro',
  carteira: 'Dinheiro'
};

const state = {
  config: { apiUrl: '', apiKey: '' },
  snapshot: null,
  people: [...DEFAULT_PEOPLE],
  hiddenPeople: [],
  reconciledMonths: {},
  theme: 'blue-dark',
  cardsConfig: JSON.parse(JSON.stringify(DEFAULT_CARDS_CONFIG)),
  selectedPersonFilter: 'ALL',
  movFilters: {
    period: 'ALL',
    month: 'ALL',
    type: 'ALL',
    account: 'ALL',
    search: ''
  }
};

/* ==========================================================================
   1. TEMA, REGRAS POR CARTÃO, NORMALIZAÇÃO E FORMATAÇÃO
   ========================================================================== */

function applyTheme(themeName) {
  const chosen = ALLOWED_THEMES.includes(themeName) ? themeName : 'blue-dark';
  state.theme = chosen;
  document.body.setAttribute('data-theme', chosen);
  localStorage.setItem(STORAGE_KEYS.THEME, chosen);

  const selectEl = document.getElementById('cfgTheme');
  if (selectEl) selectEl.value = chosen;
}

function getCardRule(cardName) {
  const canon = canonicalizeAccount(cardName || 'Nubank');
  if (!state.cardsConfig[canon]) {
    state.cardsConfig[canon] = { ...DEFAULT_CARD_RULE };
  }
  return state.cardsConfig[canon];
}

function getClosingDateForYearMonth(year, month1To12, rule) {
  if (rule.closingMode === 'LAST') {
    const lastDay = new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
    return new Date(Date.UTC(year, month1To12 - 1, lastDay));
  }
  const desiredDay = Math.min(28, Math.max(1, Number(rule.closingDay || 25)));
  const maxDay = new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
  return new Date(Date.UTC(year, month1To12 - 1, Math.min(desiredDay, maxDay)));
}

function computeStatementCycleForCard(cardName, dateIso, installmentIndex0 = 0) {
  const rule = getCardRule(cardName);
  const parts = String(dateIso || '').slice(0, 10).split('-').map(Number);
  if (parts.length !== 3) {
    return { competencia: '', dueDateIso: '', closingDateIso: '' };
  }

  const baseYear = parts[0];
  const baseMonthIdx = parts[1] - 1 + installmentIndex0;
  const purchaseDate = new Date(Date.UTC(baseYear, baseMonthIdx, parts[2]));

  const pYear = purchaseDate.getUTCFullYear();
  const pMonth = purchaseDate.getUTCMonth() + 1;
  const pDay = purchaseDate.getUTCDate();

  const closingThisMonth = getClosingDateForYearMonth(pYear, pMonth, rule);
  const closingDayThisMonth = closingThisMonth.getUTCDate();

  const closingDate = pDay <= closingDayThisMonth
    ? closingThisMonth
    : getClosingDateForYearMonth(pYear, pMonth + 1, rule);

  let dueDate;
  if (rule.dueMode === 'DAY') {
    const targetDay = Math.min(31, Math.max(1, Number(rule.dueDay || 6)));
    const cYear = closingDate.getUTCFullYear();
    const cMonth = closingDate.getUTCMonth() + 1;
    const cDay = closingDate.getUTCDate();
    const dueMonth = targetDay <= cDay ? cMonth + 1 : cMonth;
    const maxDueDay = new Date(Date.UTC(cYear, dueMonth, 0)).getUTCDate();
    dueDate = new Date(Date.UTC(cYear, dueMonth - 1, Math.min(targetDay, maxDueDay)));
  } else {
    const daysAfter = Math.max(1, Number(rule.dueDays || 6));
    dueDate = new Date(closingDate.getTime() + daysAfter * 86400000);
  }

  const competencia = `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    competencia,
    closingDateIso: closingDate.toISOString().slice(0, 10),
    dueDateIso: dueDate.toISOString().slice(0, 10)
  };
}

function syncCardsConfigFromData() {
  const parcelas = (state.snapshot && Array.isArray(state.snapshot.parcelas_cartao))
    ? state.snapshot.parcelas_cartao
    : [];
  parcelas.forEach((p) => {
    const cName = canonicalizeAccount(p.cartao_id || '');
    if (cName && cName !== 'Sem Conta' && !state.cardsConfig[cName]) {
      state.cardsConfig[cName] = { ...DEFAULT_CARD_RULE };
    }
  });
  localStorage.setItem(STORAGE_KEYS.CARDS_CONFIG, JSON.stringify(state.cardsConfig));
}

function renderCardsConfigManager() {
  syncCardsConfigFromData();
  const container = document.getElementById('cardsConfigList');
  if (!container) return;

  const cardNames = Object.keys(state.cardsConfig).sort();
  if (!cardNames.length) {
    container.innerHTML = '<p class="muted">Nenhum cartão cadastrado ainda. Adicione um cartão acima.</p>';
    return;
  }

  container.innerHTML = cardNames.map((name) => {
    const rule = getCardRule(name);
    const sample = computeStatementCycleForCard(name, '2026-11-20', 0);
    const fechaTxt = rule.closingMode === 'LAST' ? 'último dia do mês' : `dia ${rule.closingDay}`;
    const venceTxt = rule.dueMode === 'DAY' ? `dia ${rule.dueDay}` : `${rule.dueDays} dias após fechamento`;

    return `
      <div class="card-rule-box" data-card-name="${name}">
        <div class="card-rule-top">
          <div>
            <strong>${name}</strong>
            <span class="month-detail-meta">Fecha: ${fechaTxt} • Vence: ${venceTxt} • Ex. 20/11/2026 → vence ${formatDateBR(sample.dueDateIso)} (${sample.competencia})</span>
          </div>
          <button type="button" class="btn-delete" data-remove-card="${name}" title="Remover cartão">🗑️</button>
        </div>

        <div class="card-rule-grid">
          <label>
            Fechamento
            <select class="rule-closing-mode">
              <option value="DAY" ${rule.closingMode === 'DAY' ? 'selected' : ''}>Dia fixo (1 a 28)</option>
              <option value="LAST" ${rule.closingMode === 'LAST' ? 'selected' : ''}>Último dia do mês</option>
            </select>
          </label>

          <label class="rule-closing-day-wrap ${rule.closingMode === 'LAST' ? 'hidden' : ''}">
            Dia Fechamento (1-28)
            <input type="number" class="rule-closing-day" min="1" max="28" value="${rule.closingDay}" />
          </label>

          <label>
            Regra Vencimento
            <select class="rule-due-mode">
              <option value="DAYS_AFTER" ${rule.dueMode === 'DAYS_AFTER' ? 'selected' : ''}>Dias após fechamento</option>
              <option value="DAY" ${rule.dueMode === 'DAY' ? 'selected' : ''}>Dia fixo do mês</option>
            </select>
          </label>

          <label class="rule-due-days-wrap ${rule.dueMode !== 'DAYS_AFTER' ? 'hidden' : ''}">
            Dias à Frente
            <input type="number" class="rule-due-days" min="1" max="45" value="${rule.dueDays}" />
          </label>

          <label class="rule-due-day-wrap ${rule.dueMode !== 'DAY' ? 'hidden' : ''}">
            Dia Fixo Venc. (1-31)
            <input type="number" class="rule-due-day" min="1" max="31" value="${rule.dueDay}" />
          </label>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.card-rule-box').forEach((box) => {
    const cName = box.dataset.cardName;
    const onRuleChange = () => {
      const closingMode = box.querySelector('.rule-closing-mode').value;
      const closingDay = Math.min(28, Math.max(1, Number(box.querySelector('.rule-closing-day').value || 25)));
      const dueMode = box.querySelector('.rule-due-mode').value;
      const dueDays = Math.min(45, Math.max(1, Number(box.querySelector('.rule-due-days').value || 6)));
      const dueDay = Math.min(31, Math.max(1, Number(box.querySelector('.rule-due-day').value || 6)));

      state.cardsConfig[cName] = { closingMode, closingDay, dueMode, dueDays, dueDay };
      localStorage.setItem(STORAGE_KEYS.CARDS_CONFIG, JSON.stringify(state.cardsConfig));
      renderCardsConfigManager();
      renderAll();
      updateCardCyclePreviewInModal();
    };

    box.querySelectorAll('select, input').forEach((ctrl) => {
      ctrl.addEventListener('change', onRuleChange);
    });
  });

  container.querySelectorAll('[data-remove-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.removeCard;
      delete state.cardsConfig[target];
      localStorage.setItem(STORAGE_KEYS.CARDS_CONFIG, JSON.stringify(state.cardsConfig));
      renderCardsConfigManager();
      renderAll();
      showToast(`Cartão "${target}" removido da configuração.`, 'info');
    });
  });
}

function handleAddCardRule(event) {
  event.preventDefault();
  const input = document.getElementById('newCardName');
  const cardName = canonicalizeAccount(input.value);
  if (!cardName) return;

  if (!state.cardsConfig[cardName]) {
    state.cardsConfig[cardName] = { ...DEFAULT_CARD_RULE };
    localStorage.setItem(STORAGE_KEYS.CARDS_CONFIG, JSON.stringify(state.cardsConfig));
  }
  input.value = '';
  renderCardsConfigManager();
  renderAll();
  showToast(`Cartão "${cardName}" adicionado. Ajuste fechamento e vencimento abaixo.`, 'success');
}

function updateCardCyclePreviewInModal() {
  const previewEl = document.getElementById('cardCyclePreview');
  const tipo = document.getElementById('txTipo')?.value;
  if (!previewEl || tipo !== 'COMPRA_CARTAO') return;

  const cardName = resolveSelectedAccount();
  const dt = document.getElementById('txData')?.value || new Date().toISOString().slice(0, 10);
  const parcelas = Math.max(1, parseInt(document.getElementById('txParcelas')?.value || '1', 10));
  const firstCycle = computeStatementCycleForCard(cardName, dt, 0);
  const lastCycle = computeStatementCycleForCard(cardName, dt, parcelas - 1);

  previewEl.textContent = parcelas > 1
    ? `${cardName}: 1ª parcela vence ${formatDateBR(firstCycle.dueDateIso)} (${firstCycle.competencia}) • ${parcelas}ª em ${formatDateBR(lastCycle.dueDateIso)} (${lastCycle.competencia}).`
    : `${cardName}: fatura ${firstCycle.competencia} • vencimento estimado ${formatDateBR(firstCycle.dueDateIso)}.`;
}

function stripDiacritics(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cleanSpaces(str) {
  return String(str || '').trim().replace(/\s+/g, ' ');
}

function canonicalizeText(text) {
  const cleaned = cleanSpaces(text);
  if (!cleaned) return '';
  const key = stripDiacritics(cleaned).toLowerCase();
  if (CANONICAL_TEXT_MAP[key]) {
    return CANONICAL_TEXT_MAP[key];
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function canonicalizeCategory(cat) {
  const cleaned = cleanSpaces(cat);
  if (!cleaned) return 'Outros';
  const key = stripDiacritics(cleaned).toLowerCase();
  return CANONICAL_TEXT_MAP[key] || (cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
}

function canonicalizeAccount(acc) {
  const cleaned = cleanSpaces(acc);
  if (!cleaned) return 'Sem Conta';
  const key = stripDiacritics(cleaned).toLowerCase();
  return CANONICAL_ACCOUNT_MAP[key] || cleaned;
}

function normalizePersonName(name) {
  const base = stripDiacritics(cleanSpaces(name))
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (base === 'MAE' || base === 'MINHA_MAE') return 'MAE';
  return base;
}

function normalizeTicker(ticker) {
  return stripDiacritics(cleanSpaces(ticker)).toUpperCase().replace(/\s+/g, '');
}

function formatBRL(value) {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBR(isoOrDate) {
  const raw = String(isoOrDate || '').trim();
  if (!raw) return '--/--/----';
  const ymd = raw.slice(0, 10);
  const parts = ymd.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymd;
}

function formatMonthLabel(ym) {
  const cleanYm = String(ym || '').slice(0, 7);
  const parts = cleanYm.split('-');
  if (parts.length !== 2) return cleanYm || 'SEM MÊS';
  const nome = MONTH_NAMES_FULL[parts[1]] || parts[1];
  return `${nome} / ${parts[0]}`;
}

function formatMonthShort(ym) {
  const cleanYm = String(ym || '').slice(0, 7);
  const parts = cleanYm.split('-');
  if (parts.length !== 2) return cleanYm;
  const nome = MONTH_NAMES_SHORT[parts[1]] || parts[1];
  return `${nome}/${parts[0].slice(2)}`;
}

function addMonthsToDateIso(dateIso, monthsToAdd) {
  const parts = String(dateIso || '').slice(0, 10).split('-').map(Number);
  if (parts.length !== 3) return dateIso;
  const year = parts[0];
  const monthIdx = parts[1] - 1 + monthsToAdd;
  const day = parts[2];

  const targetDate = new Date(Date.UTC(year, monthIdx, 1));
  const maxDaysInTarget = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  targetDate.setUTCDate(Math.min(day, maxDaysInTarget));

  return targetDate.toISOString().slice(0, 10);
}

function getMovementBadge(tipoMov) {
  const t = String(tipoMov || '').toUpperCase();
  if (t === 'RECEITA') return '<span class="badge badge-in">Entrada</span>';
  if (t === 'REEMBOLSO') return '<span class="badge badge-in">Reembolso</span>';
  if (t === 'RESGATE') return '<span class="badge badge-info">Resgate</span>';
  if (t === 'APORTE') return '<span class="badge badge-info">Aporte</span>';
  if (t === 'PAGTO_FATURA') return '<span class="badge badge-warn">Pagto. Fatura</span>';
  return '<span class="badge badge-out">Saída</span>';
}

function getStatusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'QUITADO' || s === 'PAGA' || s === 'REALIZADO') {
    return '<span class="badge badge-in">Quitado</span>';
  }
  return '<span class="badge badge-warn">Pendente</span>';
}

function isMonthReconciled(ym) {
  return Boolean(state.reconciledMonths && state.reconciledMonths[ym]);
}

function toggleMonthReconciled(ym) {
  if (!ym || ym === '0000-00') return;
  state.reconciledMonths[ym] = !isMonthReconciled(ym);
  localStorage.setItem(STORAGE_KEYS.RECONCILED, JSON.stringify(state.reconciledMonths));
  renderAll();
  showToast(
    state.reconciledMonths[ym]
      ? `Mês ${formatMonthShort(ym)} marcado como Conferido ✓`
      : `Mês ${formatMonthShort(ym)} reaberto para conferência.`,
    state.reconciledMonths[ym] ? 'success' : 'info'
  );
}

function renderReconcileButton(ym) {
  if (!ym || ym === '0000-00') return '';
  const checked = isMonthReconciled(ym);
  return `<button type="button" class="recon-btn ${checked ? 'checked' : 'open'}" data-recon-ym="${ym}" title="Alternar status de conciliação mensal">${checked ? 'Conferido ✓' : 'Em aberto'}</button>`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.remove(), 220);
  }, 3600);
}

/* ==========================================================================
   2. ESTADO LOCAL, CONFIGURAÇÃO E SINCRONIZAÇÃO
   ========================================================================== */

function loadSavedState() {
  try {
    const rawCfg = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (rawCfg) {
      state.config = Object.assign(state.config, JSON.parse(rawCfg));
    }
    const rawCache = localStorage.getItem(STORAGE_KEYS.CACHE);
    if (rawCache) {
      state.snapshot = JSON.parse(rawCache);
    }
    const rawPeople = localStorage.getItem(STORAGE_KEYS.PEOPLE);
    if (rawPeople) {
      const parsedPeople = JSON.parse(rawPeople);
      if (Array.isArray(parsedPeople)) {
        state.people = parsedPeople;
      }
    }
    const rawHiddenPeople = localStorage.getItem(STORAGE_KEYS.HIDDEN_PEOPLE);
    if (rawHiddenPeople) {
      state.hiddenPeople = JSON.parse(rawHiddenPeople) || [];
    }
    const rawRecon = localStorage.getItem(STORAGE_KEYS.RECONCILED);
    if (rawRecon) {
      state.reconciledMonths = JSON.parse(rawRecon) || {};
    }
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme && ALLOWED_THEMES.includes(savedTheme)) {
      state.theme = savedTheme;
    }
    const rawCards = localStorage.getItem(STORAGE_KEYS.CARDS_CONFIG);
    if (rawCards) {
      const parsedCards = JSON.parse(rawCards);
      if (parsedCards && typeof parsedCards === 'object') {
        state.cardsConfig = parsedCards;
      }
    }
  } catch (err) {
    console.warn('Falha ao carregar armazenamento local:', err);
  }

  applyTheme(state.theme);
  renderCardsConfigManager();

  const urlInput = document.getElementById('cfgApiUrl');
  const keyInput = document.getElementById('cfgApiKey');
  if (urlInput) urlInput.value = state.config.apiUrl || '';
  if (keyInput) keyInput.value = state.config.apiKey || '';

  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('txData');
  if (dateInput && !dateInput.value) dateInput.value = today;

  const invDateInput = document.getElementById('invData');
  if (invDateInput && !invDateInput.value) invDateInput.value = today;

  if (state.snapshot && state.snapshot.last_sync_ts) {
    updateSyncBadge('Cache local carregado • Clique em Sincronizar', 'ok');
  }

  renderPeopleControls();
  renderAll();
}

function saveAppearance(event) {
  event.preventDefault();
  const themeVal = document.getElementById('cfgTheme').value;
  applyTheme(themeVal);
  renderAll();
  showToast('Tema atualizado com sucesso.', 'success');
}

function saveConfig(event) {
  event.preventDefault();
  const apiUrl = document.getElementById('cfgApiUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();

  if (!apiUrl || !apiKey) {
    showToast('Preencha a URL do Web App e a chave API_ACCESS_KEY.', 'warn');
    return;
  }

  state.config = { apiUrl, apiKey };
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(state.config));
  updateSyncBadge('Configuração salva • Sincronizando...', 'ok');
  showToast('Conexão salva neste navegador.', 'success');
  syncFromBackend();
}

function updateSyncBadge(text, variant = '') {
  const badge = document.getElementById('syncStatus');
  if (!badge) return;
  badge.textContent = text;
  badge.className = `sync-badge ${variant}`.trim();
}

async function syncFromBackend() {
  if (!state.config.apiUrl || !state.config.apiKey) {
    updateSyncBadge('Configure URL e Chave na aba Configurações', 'warn');
    switchTab('config');
    return;
  }

  updateSyncBadge('Sincronizando com Google Sheets...', 'warn');
  try {
    const sep = state.config.apiUrl.indexOf('?') === -1 ? '?' : '&';
    const endpoint = `${state.config.apiUrl}${sep}action=sync&api_key=${encodeURIComponent(state.config.apiKey)}`;

    const resp = await fetch(endpoint);
    const json = await resp.json();

    if (!json.ok) {
      throw new Error(json.error || 'Erro ao sincronizar com o Apps Script.');
    }

    if (json.data) {
      state.snapshot = Object.assign({}, state.snapshot || {}, json.data);
      localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(state.snapshot));
    }

    const stamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    updateSyncBadge(`Sincronizado às ${stamp}`, 'ok');
    renderPeopleControls();
    renderCardsConfigManager();
    renderAll();
    showToast(`Dados atualizados às ${stamp}.`, 'success');
  } catch (err) {
    updateSyncBadge('Falha na sincronização (usando cache local)', 'warn');
    console.error(err);
    showToast(`Erro ao sincronizar: ${err.message}`, 'error');
  }
}

async function postToBackend(action, payload) {
  if (!state.config.apiUrl || !state.config.apiKey) {
    throw new Error('Configure a URL e a chave em Configurações antes de lançar.');
  }

  const resp = await fetch(state.config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      api_key: state.config.apiKey,
      action,
      payload
    })
  });

  const json = await resp.json();
  if (!json.ok) {
    throw new Error(json.error || 'Falha ao gravar no backend.');
  }
  return json.result;
}

/* ==========================================================================
   3. CADASTRO/EXCLUSÃO DE PESSOAS E REGRAS DO MODAL (+ LANÇAR)
   ========================================================================== */

function syncPeopleListFromData() {
  const hiddenSet = new Set(state.hiddenPeople || []);
  const set = new Set();

  if (Array.isArray(state.people)) {
    state.people.forEach((p) => {
      const n = normalizePersonName(p);
      if (n && n !== 'EU' && !hiddenSet.has(n)) set.add(n);
    });
  }

  const terceiros = (state.snapshot && Array.isArray(state.snapshot.terceiros_razao))
    ? state.snapshot.terceiros_razao
    : [];
  terceiros.forEach((t) => {
    const n = normalizePersonName(t.pessoa_id);
    if (n && n !== 'EU' && !hiddenSet.has(n)) set.add(n);
  });

  state.people = Array.from(set);
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(state.people));
}

function handleRemovePerson(personName) {
  const clean = normalizePersonName(personName);
  const ok = confirm(`Remover "${clean}" da lista de pessoas?`);
  if (!ok) return;

  state.people = state.people.filter((p) => p !== clean);
  if (!state.hiddenPeople.includes(clean)) {
    state.hiddenPeople.push(clean);
  }
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(state.people));
  localStorage.setItem(STORAGE_KEYS.HIDDEN_PEOPLE, JSON.stringify(state.hiddenPeople));

  if (state.selectedPersonFilter === clean) {
    state.selectedPersonFilter = 'ALL';
  }
  renderPeopleControls();
  renderAll();
  showToast(`Pessoa "${clean}" removida.`, 'info');
}

function renderPeopleControls() {
  syncPeopleListFromData();

  const chipsEl = document.getElementById('peopleChips');
  if (chipsEl) {
    const allChip = `<button type="button" class="chip ${state.selectedPersonFilter === 'ALL' ? 'active' : ''}" data-person="ALL">Todos</button>`;
    const personChips = state.people
      .map((p) => `
        <span class="chip chip-with-del ${state.selectedPersonFilter === p ? 'active' : ''}" data-person="${p}">
          <span>${p}</span>
          <button type="button" class="chip-del-x" data-del-person="${p}" title="Remover pessoa">✕</button>
        </span>
      `)
      .join('');
    chipsEl.innerHTML = allChip + personChips;

    chipsEl.querySelectorAll('[data-person]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('[data-del-person]')) return;
        state.selectedPersonFilter = chip.dataset.person;
        renderPeopleControls();
        renderAll();
      });
    });

    chipsEl.querySelectorAll('[data-del-person]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRemovePerson(btn.dataset.delPerson);
      });
    });
  }

  const badge = document.getElementById('terceirosActiveFilterBadge');
  if (badge) {
    badge.textContent = state.selectedPersonFilter === 'ALL'
      ? 'Exibindo: Todos'
      : `Filtrado por: ${state.selectedPersonFilter}`;
  }

  const respSelect = document.getElementById('txResponsavel');
  if (respSelect) {
    const currentVal = respSelect.value;
    const baseOptions = [
      { value: 'EU', label: 'Apenas Eu' },
      { value: 'MAE_COMPARTILHADO', label: 'Compartilhado com Mãe' }
    ];
    state.people.forEach((person) => {
      baseOptions.push({ value: person, label: `Terceiro: ${person}` });
    });
    baseOptions.push({ value: '__NOVA_PESSOA__', label: '+ Cadastrar nova pessoa...' });

    respSelect.innerHTML = baseOptions
      .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
      .join('');

    if (currentVal && Array.from(respSelect.options).some((o) => o.value === currentVal)) {
      respSelect.value = currentVal;
    }
  }
}

function handleAddPerson(event) {
  event.preventDefault();
  const input = document.getElementById('newPersonName');
  const clean = normalizePersonName(input.value);
  if (!clean) return;

  state.hiddenPeople = state.hiddenPeople.filter((p) => p !== clean);
  localStorage.setItem(STORAGE_KEYS.HIDDEN_PEOPLE, JSON.stringify(state.hiddenPeople));

  if (!state.people.includes(clean)) {
    state.people.push(clean);
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(state.people));
  }
  input.value = '';
  renderPeopleControls();
  renderAll();
  showToast(`Pessoa "${clean}" adicionada.`, 'success');
}

function evaluateSplitWarning() {
  const tipo = document.getElementById('txTipo').value;
  const resp = document.getElementById('txResponsavel').value;
  const warnBox = document.getElementById('splitAlert');
  const total = Number(document.getElementById('txValor').value || 0);
  const minhaRaw = document.getElementById('txMinhaParte').value;
  const desc = Number(document.getElementById('txDesconto').value || 0);

  if (tipo !== 'COMPRA_CARTAO' || resp !== 'MAE_COMPARTILHADO' || total <= 0) {
    warnBox.classList.add('hidden');
    warnBox.textContent = '';
    return;
  }

  if (minhaRaw !== '') {
    const minha = Number(minhaRaw);
    const maeBruta = Math.max(0, total - minha);
    const maeLiquida = Math.max(0, maeBruta - desc);
    if (desc > 0 || maeBruta !== maeLiquida) {
      warnBox.classList.remove('hidden');
      warnBox.textContent =
        `Total: ${formatBRL(total)} | Sua parte: ${formatBRL(minha)} | Parte bruta Mãe: ${formatBRL(maeBruta)} | Desconto: ${formatBRL(desc)} | Líquido a cobrar da Mãe: ${formatBRL(maeLiquida)}.`;
      return;
    }
  }

  warnBox.classList.add('hidden');
  warnBox.textContent = '';
}

function updateQuickFormVisibility() {
  const tipo = document.getElementById('txTipo').value;
  const resp = document.getElementById('txResponsavel').value;
  const contaVal = document.getElementById('txConta').value;
  const isRec = document.getElementById('txIsRecorrente').checked;

  const cardBox = document.getElementById('cardExtraFields');
  const splitBox = document.getElementById('splitFields');
  const recurrenceBox = document.getElementById('recurrenceBox');
  const recurrenceFields = document.getElementById('recurrenceFields');
  const novaPessoaInput = document.getElementById('txNovaPessoa');
  const outroBancoInput = document.getElementById('txOutroBanco');

  if (tipo === 'COMPRA_CARTAO') {
    cardBox.classList.remove('hidden');
    recurrenceBox.classList.add('hidden');
    updateCardCyclePreviewInModal();
  } else {
    cardBox.classList.add('hidden');
    recurrenceBox.classList.remove('hidden');
  }

  if (recurrenceFields) {
    recurrenceFields.classList.toggle('hidden', !isRec);
  }

  if (tipo === 'COMPRA_CARTAO' && resp === 'MAE_COMPARTILHADO') {
    splitBox.classList.remove('hidden');
  } else {
    splitBox.classList.add('hidden');
  }

  if (novaPessoaInput) {
    novaPessoaInput.classList.toggle('hidden', resp !== '__NOVA_PESSOA__');
  }

  if (outroBancoInput) {
    outroBancoInput.classList.toggle('hidden', contaVal !== '__OUTRO_BANCO__');
  }

  evaluateSplitWarning();
}

function resolveSelectedAccount() {
  const contaVal = document.getElementById('txConta').value;
  if (contaVal === '__OUTRO_BANCO__') {
    return canonicalizeAccount(document.getElementById('txOutroBanco').value || 'Outro Banco');
  }
  return canonicalizeAccount(contaVal);
}

function resolveSelectedPerson() {
  const resp = document.getElementById('txResponsavel').value;
  if (resp === '__NOVA_PESSOA__') {
    const custom = normalizePersonName(document.getElementById('txNovaPessoa').value);
    if (custom && !state.people.includes(custom)) {
      state.people.push(custom);
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(state.people));
      renderPeopleControls();
    }
    return custom || 'TERCEIRO';
  }
  return resp;
}

/* ==========================================================================
   4. ESCRITA, EDIÇÃO E EXCLUSÃO EM TODOS OS MÓDULOS
   ========================================================================== */

async function handleQuickAddSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitTx');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const tipo = document.getElementById('txTipo').value;
    const descricao = canonicalizeText(document.getElementById('txDescricao').value);
    const valor = Number(document.getElementById('txValor').value);
    const data = document.getElementById('txData').value;
    const categoria = canonicalizeCategory(document.getElementById('txCategoria').value);
    const conta = resolveSelectedAccount();
    const baseKey = `pwa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (tipo === 'COMPRA_CARTAO') {
      const parcelas = Math.max(1, parseInt(document.getElementById('txParcelas').value || '1', 10));
      const resp = resolveSelectedPerson();
      const minhaRaw = document.getElementById('txMinhaParte').value;
      const desconto = Number(document.getElementById('txDesconto').value || 0);

      let modoDivisao = 'INTEGRAL_MEU';
      let pessoaId = '';
      let valorMinhaParte = valor;
      let valorParteTerceiro = 0;

      if (resp === 'EU') {
        modoDivisao = 'INTEGRAL_MEU';
        pessoaId = '';
        valorMinhaParte = valor;
        valorParteTerceiro = 0;
      } else if (resp === 'MAE_COMPARTILHADO') {
        modoDivisao = 'COMPARTILHADO';
        pessoaId = 'MAE';
        valorMinhaParte = minhaRaw !== '' ? Number(minhaRaw) : valor / 2;
        valorParteTerceiro = Math.max(0, valor - valorMinhaParte);
      } else {
        modoDivisao = 'INTEGRAL_TERCEIRO';
        pessoaId = normalizePersonName(resp);
        valorMinhaParte = 0;
        valorParteTerceiro = valor;
      }

      const firstCycle = computeStatementCycleForCard(conta, data, 0);

      const res = await postToBackend('createCardPurchase', {
        idempotency_key: baseKey,
        data_compra: data,
        cartao_id: conta,
        descricao,
        categoria_id: categoria,
        valor_total: valor,
        qtd_parcelas: parcelas,
        responsavel_principal: resp,
        modo_divisao: modoDivisao,
        pessoa_id: pessoaId,
        valor_minha_parte: valorMinhaParte,
        valor_parte_terceiro: valorParteTerceiro,
        desconto_estimado: desconto,
        is_estimativa: desconto > 0 || resp === 'MAE_COMPARTILHADO',
        competencia_inicial: firstCycle.competencia,
        data_vencimento_inicial: firstCycle.dueDateIso
      });

      if (res && res.alerta_divergencia) {
        showToast(`Registrado com aviso: ${res.alerta_divergencia}`, 'warn');
      } else {
        showToast(
          parcelas > 1
            ? `Compra parcelada em ${parcelas}x (${conta}) — vence ${formatDateBR(firstCycle.dueDateIso)}!`
            : `Compra no cartão ${conta} — vence ${formatDateBR(firstCycle.dueDateIso)}!`,
          'success'
        );
      }
    } else {
      const isRecorrente = document.getElementById('txIsRecorrente').checked;
      const totalMeses = isRecorrente
        ? Math.min(24, Math.max(2, parseInt(document.getElementById('txRecorrenciaMeses').value || '12', 10)))
        : 1;

      if (tipo === 'REEMBOLSO') {
        const pessoaId = resolveSelectedPerson();
        const cleanPerson = (pessoaId === 'EU' || pessoaId === 'MAE_COMPARTILHADO')
          ? 'MAE'
          : normalizePersonName(pessoaId);

        for (let i = 0; i < totalMeses; i += 1) {
          const dtOcorrencia = addMonthsToDateIso(data, i);
          const descOcorrencia = totalMeses > 1 ? `${descricao} (${i + 1}/${totalMeses})` : descricao;
          btn.textContent = totalMeses > 1 ? `Salvando ${i + 1}/${totalMeses}...` : 'Salvando...';

          await postToBackend('recordRefund', {
            idempotency_key: `${baseKey}_m${i + 1}`,
            pessoa_id: cleanPerson,
            competencia: dtOcorrencia.slice(0, 7),
            data_recebimento: dtOcorrencia,
            descricao: descOcorrencia,
            categoria_id: categoria,
            account_id: conta,
            valor_recebido: valor
          });
        }
        showToast(
          totalMeses > 1
            ? `${totalMeses} reembolsos recorrentes registrados!`
            : 'Reembolso registrado com sucesso!',
          'success'
        );
      } else {
        for (let i = 0; i < totalMeses; i += 1) {
          const dtOcorrencia = addMonthsToDateIso(data, i);
          const descOcorrencia = totalMeses > 1 ? `${descricao} (${i + 1}/${totalMeses})` : descricao;
          btn.textContent = totalMeses > 1 ? `Salvando ${i + 1}/${totalMeses}...` : 'Salvando...';

          await postToBackend('createTransaction', {
            idempotency_key: `${baseKey}_m${i + 1}`,
            data_competencia: dtOcorrencia,
            data_caixa: dtOcorrencia,
            descricao: descOcorrencia,
            tipo_mov: tipo,
            categoria_id: categoria,
            account_id: conta,
            valor,
            status: 'REALIZADO'
          });
        }
        showToast(
          totalMeses > 1
            ? `Recorrência mensal (${totalMeses} meses) lançada com sucesso!`
            : 'Movimentação registrada com sucesso!',
          'success'
        );
      }
    }

    document.getElementById('quickAddForm').reset();
    document.getElementById('txData').value = new Date().toISOString().slice(0, 10);
    closeModal();
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar e Sincronizar';
  }
}

async function handleDeleteMovement(txId, label) {
  if (!txId) return;
  if (!confirm(`Excluir a movimentação "${label}"?`)) return;
  try {
    await postToBackend('deleteTransaction', { tx_id: txId });
    showToast('Movimentação excluída.', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao excluir: ${err.message}`, 'error');
  }
}

async function handleDeleteCardPurchase(compraId, label) {
  if (!compraId) return;
  if (!confirm(`Excluir a compra no cartão "${label}" e todas as suas parcelas/rateios?`)) return;
  try {
    await postToBackend('deleteCardPurchase', { compra_id: compraId });
    showToast('Compra no cartão excluída.', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao excluir compra no cartão: ${err.message}`, 'error');
  }
}

async function handleDeleteThirdParty(razaoId, label) {
  if (!razaoId) return;
  if (!confirm(`Excluir o lançamento de terceiro "${label}"?`)) return;
  try {
    await postToBackend('deleteThirdPartyEntry', { razao_id: razaoId });
    showToast('Lançamento de terceiro excluído.', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao excluir terceiro: ${err.message}`, 'error');
  }
}

async function handleDeleteInvestmentOp(opInvId, label) {
  if (!opInvId) return;
  if (!confirm(`Excluir esta operação de investimento (${label})?`)) return;
  try {
    await postToBackend('deleteInvestmentOp', { op_inv_id: opInvId });
    showToast('Operação de investimento excluída.', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao excluir operação: ${err.message}`, 'error');
  }
}

async function handleDeleteInvestmentAsset(ticker) {
  if (!ticker) return;
  if (!confirm(`Excluir TODAS as operações do ativo "${ticker}"?`)) return;
  try {
    await postToBackend('deleteInvestmentOp', { ticker });
    showToast(`Ativo ${ticker} removido da carteira.`, 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao excluir ativo: ${err.message}`, 'error');
  }
}

function openEditModal(config) {
  document.getElementById('editModalTitle').textContent = config.title || 'Editar Lançamento';
  document.getElementById('editKind').value = config.kind;
  document.getElementById('editId').value = config.id;
  document.getElementById('editDesc').value = config.desc || '';
  document.getElementById('editDate').value = config.date || '';
  document.getElementById('editValor').value = config.valor || '';
  document.getElementById('editAccountOrPerson').value = config.accountOrPerson || '';
  document.getElementById('editQty').value = config.qty || '';
  document.getElementById('editStatus').value = config.status || 'PENDENTE';

  document.getElementById('editDateWrap').classList.toggle('hidden', !config.showDate);
  document.getElementById('editValWrap').classList.toggle('hidden', !config.showVal);
  document.getElementById('editAccountWrap').classList.toggle('hidden', !config.showAccountOrPerson);
  document.getElementById('editQtyWrap').classList.toggle('hidden', !config.showQty);
  document.getElementById('editStatusWrap').classList.toggle('hidden', !config.showStatus);

  document.getElementById('editEntryModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editEntryModal').classList.add('hidden');
}

async function handleSaveEditSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSaveEdit');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const kind = document.getElementById('editKind').value;
    const id = document.getElementById('editId').value;
    const desc = canonicalizeText(document.getElementById('editDesc').value);
    const dt = document.getElementById('editDate').value;
    const val = Number(document.getElementById('editValor').value || 0);
    const accOrPerson = document.getElementById('editAccountOrPerson').value.trim();
    const qty = Number(document.getElementById('editQty').value || 0);
    const status = document.getElementById('editStatus').value;

    if (kind === 'MOVEMENT') {
      await postToBackend('updateTransaction', {
        tx_id: id,
        descricao: desc,
        data_competencia: dt,
        data_caixa: dt,
        valor: val,
        account_id: canonicalizeAccount(accOrPerson)
      });
    } else if (kind === 'CARD_PURCHASE') {
      await postToBackend('updateCardPurchase', {
        compra_id: id,
        descricao: desc,
        cartao_id: canonicalizeAccount(accOrPerson)
      });
    } else if (kind === 'THIRD_PARTY') {
      await postToBackend('updateThirdPartyEntry', {
        razao_id: id,
        descricao: desc,
        pessoa_id: normalizePersonName(accOrPerson),
        valor: val,
        status
      });
    } else if (kind === 'INVESTMENT') {
      await postToBackend('updateInvestmentOp', {
        op_inv_id: id,
        ticker: normalizeTicker(desc),
        data_op: dt,
        quantidade: qty,
        valor_total: val
      });
    }

    closeEditModal();
    showToast('Alterações salvas com sucesso!', 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao editar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Alterações';
  }
}

async function handleInvestSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitInv');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const tipoOp = document.getElementById('invTipoOp').value;
    const classeAtivo = document.getElementById('invClasse').value;
    const ticker = normalizeTicker(document.getElementById('invTicker').value);
    const dataOp = document.getElementById('invData').value;
    const qtd = Number(document.getElementById('invQtd').value || 0);
    const valorTotal = Number(document.getElementById('invValorTotal').value || 0);
    const precoUnit = qtd > 0 ? Number((valorTotal / qtd).toFixed(4)) : valorTotal;
    const idemKey = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await postToBackend('recordInvestmentOp', {
      idempotency_key: idemKey,
      data_operacao: dataOp,
      tipo_op: tipoOp,
      classe_ativo: classeAtivo,
      ticker,
      nome_ativo: ticker,
      quantidade: qtd,
      preco_unitario: precoUnit,
      valor_total: valorTotal
    });

    document.getElementById('investForm').reset();
    document.getElementById('invData').value = new Date().toISOString().slice(0, 10);
    showToast(`Operação em ${ticker} registrada com sucesso!`, 'success');
    await syncFromBackend();
  } catch (err) {
    showToast(`Erro ao registrar investimento: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Investimento';
  }
}

async function handleUpdateQuotes() {
  try {
    updateSyncBadge('Atualizando cotações...', 'warn');
    await postToBackend('refreshQuotes', {});
    showToast('Cotações atualizadas!', 'success');
    await syncFromBackend();
  } catch (err) {
    updateSyncBadge('Falha nas cotações', 'warn');
    showToast(`Não foi possível atualizar cotações: ${err.message}`, 'error');
  }
}

/* ==========================================================================
   5. RENDERIZAÇÃO POR SEÇÃO (INÍCIO, CONTAS, MOVS, CARTÕES, TERCEIROS, INV)
   ========================================================================== */

function getChartColorsForCurrentTheme() {
  const t = state.theme;
  if (t === 'white-white') {
    return { barOut: '#d97706', barOk: '#16a34a', barNeg: '#dc2626', axis: '#cbd5e1', label: '#475569' };
  }
  if (t === 'blue-white') {
    return { barOut: '#d97706', barOk: '#0284c7', barNeg: '#dc2626', axis: '#93c5fd', label: '#334155' };
  }
  if (t === 'dark') {
    return { barOut: '#f59e0b', barOk: '#22c55e', barNeg: '#ef4444', axis: '#3f3f46', label: '#a1a1aa' };
  }
  return { barOut: '#f59e0b', barOk: '#22c55e', barNeg: '#ef4444', axis: '#25324a', label: '#94a3b8' };
}

function renderMonthlyChart(scheduleRows) {
  const container = document.getElementById('monthlyChartContainer');
  if (!container) return;

  if (!Array.isArray(scheduleRows) || !scheduleRows.length) {
    container.innerHTML = '<p class="muted">Sincronize para gerar o gráfico mês a mês.</p>';
    return;
  }

  const colors = getChartColorsForCurrentTheme();
  const maxAbs = Math.max(
    1,
    ...scheduleRows.map((s) => Math.max(Math.abs(s.aPagar), Math.abs(s.saldoFinal)))
  );

  const barWidth = 22;
  const gap = 30;
  const chartHeight = 178;
  const baseY = 128;
  const width = Math.max(460, scheduleRows.length * (barWidth * 2 + gap) + 40);

  const barsSvg = scheduleRows.map((item, idx) => {
    const x0 = 20 + idx * (barWidth * 2 + gap);
    const hPagar = Math.max(3, Math.round((Math.abs(item.aPagar) / maxAbs) * 95));
    const hSaldo = Math.max(3, Math.round((Math.abs(item.saldoFinal) / maxAbs) * 95));

    const yPagar = baseY - hPagar;
    const ySaldo = item.saldoFinal >= 0 ? baseY - hSaldo : baseY;
    const colorSaldo = item.saldoFinal >= 0 ? colors.barOk : colors.barNeg;

    const labelShort = formatMonthShort(item.mes);
    return `
      <g>
        <rect x="${x0}" y="${yPagar}" width="${barWidth}" height="${hPagar}" rx="4" fill="${colors.barOut}">
          <title>${labelShort} • A pagar / saídas: ${formatBRL(item.aPagar)}</title>
        </rect>
        <rect x="${x0 + barWidth + 4}" y="${ySaldo}" width="${barWidth}" height="${hSaldo}" rx="4" fill="${colorSaldo}">
          <title>${labelShort} • Saldo final na conta: ${formatBRL(item.saldoFinal)}</title>
        </rect>
        <text x="${x0 + barWidth + 2}" y="${chartHeight - 12}" text-anchor="middle" fill="${colors.label}" font-size="11">${labelShort}</text>
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <div class="chart-legend">
      <span><i class="dot-reemb" style="background:${colors.barOut};"></i> A pagar / saídas no mês</span>
      <span><i class="dot-proj" style="background:${colors.barOk};"></i> Saldo final na conta</span>
    </div>
    <svg width="${width}" height="${chartHeight}" viewBox="0 0 ${width} ${chartHeight}" role="img" aria-label="Cronograma mensal de pagamentos e saldo na conta">
      <line x1="12" y1="${baseY}" x2="${width - 12}" y2="${baseY}" stroke="${colors.axis}" stroke-width="1.5" />
      ${barsSvg}
    </svg>
  `;
}

function renderPortfolioChart(positions) {
  const container = document.getElementById('investimentosChartContainer');
  if (!container) return;

  if (!Array.isArray(positions) || !positions.length) {
    container.innerHTML = '<p class="muted">Adicione operações para visualizar o gráfico da carteira.</p>';
    return;
  }

  const colors = getChartColorsForCurrentTheme();
  const maxVal = Math.max(1, ...positions.map((p) => p.valorAtual));
  const barWidth = 34;
  const gap = 26;
  const chartHeight = 165;
  const baseY = 122;
  const width = Math.max(360, positions.length * (barWidth + gap) + 40);

  const barsSvg = positions.map((p, idx) => {
    const x0 = 20 + idx * (barWidth + gap);
    const h = Math.max(4, Math.round((p.valorAtual / maxVal) * 92));
    const y = baseY - h;
    return `
      <g>
        <rect x="${x0}" y="${y}" width="${barWidth}" height="${h}" rx="5" fill="${colors.barOk}">
          <title>${p.ticker} • Valor: ${formatBRL(p.valorAtual)} • PM: ${formatBRL(p.pm)}</title>
        </rect>
        <text x="${x0 + barWidth / 2}" y="${chartHeight - 12}" text-anchor="middle" fill="${colors.label}" font-size="11">${p.ticker}</text>
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <div class="chart-legend">
      <span><i class="dot-proj" style="background:${colors.barOk};"></i> Valor por ativo na carteira</span>
    </div>
    <svg width="${width}" height="${chartHeight}" viewBox="0 0 ${width} ${chartHeight}" role="img" aria-label="Gráfico de alocação por ativo">
      <line x1="12" y1="${baseY}" x2="${width - 12}" y2="${baseY}" stroke="${colors.axis}" stroke-width="1.5" />
      ${barsSvg}
    </svg>
  `;
}

function renderExecutiveHome(currentRow, movs, faturasAbertas, parcelas, terceiros, currentMonthYm) {
  const actionsEl = document.getElementById('homeCurrentMonthActions');
  const summaryEl = document.getElementById('homeCurrentMonthSummary');
  const recentEl = document.getElementById('homeRecentEntriesList');
  const alertsEl = document.getElementById('homeUpcomingAlerts');
  if (!actionsEl || !summaryEl || !alertsEl || !recentEl) return;

  actionsEl.innerHTML = renderReconcileButton(currentMonthYm);

  if (currentRow) {
    const balClass = currentRow.saldoFinal >= 0 ? 'amt-pos' : 'amt-neg';
    summaryEl.innerHTML = `
      <div class="month-block">
        <div class="month-header">
          <span class="month-title">${currentRow.tituloMes}</span>
          <span class="${currentRow.saldoFinal >= 0 ? 'month-balance-ok' : 'month-balance-neg'}">Saldo previsto: ${formatBRL(currentRow.saldoFinal)}</span>
        </div>
        <div class="month-metrics">
          <div class="month-metric"><span>Entradas no Mês</span><strong class="amt-pos">${formatBRL(currentRow.entradas)}</strong></div>
          <div class="month-metric"><span>Saídas + Faturas</span><strong class="amt-neg">${formatBRL(currentRow.aPagar)}</strong></div>
          <div class="month-metric"><span>Resultado Líquido</span><strong class="${balClass}">${formatBRL(currentRow.entradas - currentRow.aPagar)}</strong></div>
        </div>
      </div>
    `;
  } else {
    summaryEl.innerHTML = '<p class="muted">Sincronize para visualizar o resumo executivo do mês atual.</p>';
  }

  const recentMovs = [...movs].slice(-5).reverse();
  recentEl.innerHTML = recentMovs.length
    ? recentMovs.map((m) => {
        const dtIso = String(m.data_caixa || m.data_competencia || '').slice(0, 10);
        const dtBr = formatDateBR(dtIso);
        const desc = canonicalizeText(m.descricao || 'Sem descrição');
        const acc = canonicalizeAccount(m.account_id);
        const t = String(m.tipo_mov || '').toUpperCase();
        const isPositive = (t === 'RECEITA' || t === 'REEMBOLSO' || t === 'RESGATE');
        const sign = isPositive ? '+' : '-';
        const amtClass = isPositive ? 'amt-pos' : 'amt-neg';
        const badge = getMovementBadge(t);

        return `
          <div class="month-detail-row">
            <div>
              <strong>${desc}</strong> ${badge}
              <span class="month-detail-meta">${dtBr} • ${acc}</span>
            </div>
            <div class="month-detail-right">
              <strong class="${amtClass}">${sign} ${formatBRL(m.valor)}</strong>
              <button type="button" class="btn-edit" data-edit-mov="${m.tx_id || ''}" title="Editar">✏️</button>
              <button type="button" class="btn-delete" data-del-mov="${m.tx_id || ''}" data-del-label="${desc}" title="Excluir">🗑️</button>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="muted">Nenhum lançamento recente encontrado.</p>';

  const alerts = [];
  if (faturasAbertas > 0) {
    const openCardsSet = new Set(
      parcelas
        .filter((p) => String(p.status_fatura || '').toUpperCase() !== 'PAGA')
        .map((p) => canonicalizeAccount(p.cartao_id || 'Cartão'))
    );
    const cardSummaryDue = Array.from(openCardsSet).map((cName) => {
      const cyc = computeStatementCycleForCard(cName, new Date().toISOString().slice(0, 10), 0);
      return `${cName}: ${formatDateBR(cyc.dueDateIso)}`;
    }).join(' • ');

    alerts.push(`
      <div class="list-item">
        <div>
          <strong>Faturas de Cartão em Aberto</strong> <span class="badge badge-warn">Em Aberto</span>
          <span class="month-detail-meta">${cardSummaryDue || 'Parcelas em aberto'}</span>
        </div>
        <strong class="amt-neg">${formatBRL(faturasAbertas)}</strong>
      </div>
    `);
  }

  const pendingByPerson = {};
  terceiros.forEach((t) => {
    if (String(t.status || '').toUpperCase() === 'QUITADO') return;
    const person = normalizePersonName(t.pessoa_id || 'TERCEIRO');
    pendingByPerson[person] = (pendingByPerson[person] || 0) + Number(t.valor_ajustado_cobrado || 0);
  });

  Object.entries(pendingByPerson).forEach(([person, val]) => {
    alerts.push(`
      <div class="list-item">
        <div>
          <strong>Reembolso Pendente • ${person}</strong> <span class="badge badge-warn">Pendente</span>
          <span class="month-detail-meta">Valor a receber de terceiro</span>
        </div>
        <strong style="color: var(--warning);">${formatBRL(val)}</strong>
      </div>
    `);
  });

  alertsEl.innerHTML = alerts.length
    ? alerts.join('')
    : '<p class="muted">Nenhuma pendência crítica ou vencimento em aberto.</p>';
}

function renderMovementsSection(movs, todayIso, currentMonthYm) {
  const movListEl = document.getElementById('movimentacoesList');
  if (!movListEl) return;

  const monthSelect = document.getElementById('filterMovMonth');
  const accountSelect = document.getElementById('filterMovAccount');
  if (monthSelect && accountSelect) {
    const monthsSet = new Set();
    const accountsSet = new Set();
    movs.forEach((m) => {
      const ym = String(m.data_caixa || m.data_competencia || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) monthsSet.add(ym);
      const acc = canonicalizeAccount(m.account_id);
      if (acc && acc !== 'Sem Conta') accountsSet.add(acc);
    });

    const prevMonth = state.movFilters.month;
    monthSelect.innerHTML =
      '<option value="ALL">Todos os meses</option>' +
      Array.from(monthsSet)
        .sort((a, b) => b.localeCompare(a))
        .map((ym) => `<option value="${ym}">${formatMonthLabel(ym)}</option>`)
        .join('');
    monthSelect.value = monthsSet.has(prevMonth) ? prevMonth : 'ALL';

    const prevAcc = state.movFilters.account;
    accountSelect.innerHTML =
      '<option value="ALL">Todas as contas</option>' +
      Array.from(accountsSet)
        .sort()
        .map((acc) => `<option value="${acc}">${acc}</option>`)
        .join('');
    accountSelect.value = accountsSet.has(prevAcc) ? prevAcc : 'ALL';
  }

  const filtered = movs.filter((m) => {
    const dtIso = String(m.data_caixa || m.data_competencia || '').slice(0, 10);
    const ym = dtIso.slice(0, 7);
    const tipo = String(m.tipo_mov || '').toUpperCase();
    const acc = canonicalizeAccount(m.account_id);
    const descNorm = canonicalizeText(m.descricao || '').toLowerCase();
    const catNorm = canonicalizeCategory(m.categoria_id || '').toLowerCase();

    if (state.movFilters.period === 'PAST' && dtIso > todayIso) return false;
    if (state.movFilters.period === 'FUTURE' && dtIso <= todayIso) return false;
    if (state.movFilters.month !== 'ALL' && ym !== state.movFilters.month) return false;
    if (state.movFilters.type !== 'ALL' && tipo !== state.movFilters.type) return false;
    if (state.movFilters.account !== 'ALL' && acc !== state.movFilters.account) return false;
    if (state.movFilters.search) {
      const q = state.movFilters.search.toLowerCase();
      if (!descNorm.includes(q) && !catNorm.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    movListEl.innerHTML = '<p class="muted">Nenhuma movimentação encontrada para os filtros selecionados.</p>';
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    const da = String(a.data_caixa || a.data_competencia || '');
    const db = String(b.data_caixa || b.data_competencia || '');
    return db.localeCompare(da);
  });

  const groupsMap = new Map();
  sorted.forEach((m) => {
    const ym = String(m.data_caixa || m.data_competencia || '').slice(0, 7) || '0000-00';
    if (!groupsMap.has(ym)) {
      groupsMap.set(ym, { key: ym, netTotal: 0, items: [] });
    }
    const g = groupsMap.get(ym);
    const v = Number(m.valor || 0);
    const t = String(m.tipo_mov || '').toUpperCase();
    const isPositive = (t === 'RECEITA' || t === 'REEMBOLSO' || t === 'RESGATE');
    g.netTotal += isPositive ? v : -v;
    g.items.push(m);
  });

  const groups = Array.from(groupsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

  movListEl.innerHTML = groups.map((g, idx) => {
    const title = g.key === '0000-00' ? 'SEM DATA' : formatMonthLabel(g.key);
    const totalClass = g.netTotal < 0 ? 'month-balance-neg' : 'month-balance-ok';
    const isOpen = state.movFilters.month !== 'ALL' || state.movFilters.period !== 'ALL' || g.key === currentMonthYm || idx === 0;
    const reconBtn = renderReconcileButton(g.key);

    const rowsHtml = g.items.map((m) => {
      const dtBr = formatDateBR(m.data_caixa || m.data_competencia);
      const desc = canonicalizeText(m.descricao || 'Sem descrição');
      const cat = canonicalizeCategory(m.categoria_id || '');
      const acc = canonicalizeAccount(m.account_id);
      const t = String(m.tipo_mov || '').toUpperCase();
      const isPositive = (t === 'RECEITA' || t === 'REEMBOLSO' || t === 'RESGATE');
      const sign = isPositive ? '+' : '-';
      const amtClass = isPositive ? 'amt-pos' : 'amt-neg';
      const badge = getMovementBadge(t);

      return `
        <div class="month-detail-row">
          <div>
            <strong>${desc}</strong> ${badge}
            <span class="month-detail-meta">${dtBr} • ${acc} • ${cat}</span>
          </div>
          <div class="month-detail-right">
            <strong class="${amtClass}">${sign} ${formatBRL(m.valor)}</strong>
            <button type="button" class="btn-edit" data-edit-mov="${m.tx_id || ''}" title="Editar movimentação">✏️</button>
            <button type="button" class="btn-delete" data-del-mov="${m.tx_id || ''}" data-del-label="${desc}" title="Excluir movimentação">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <details class="month-block" ${isOpen ? 'open' : ''}>
        <summary class="month-header">
          <span class="month-header-left">
            <span class="month-chevron">▶</span>
            <span class="month-title">${title}</span>
            <span class="month-count">${g.items.length}</span>
          </span>
          <span class="month-header-right">
            ${reconBtn}
            <span class="${totalClass}">Saldo mês: ${formatBRL(g.netTotal)}</span>
          </span>
        </summary>
        <div class="month-details">
          ${rowsHtml}
        </div>
      </details>
    `;
  }).join('');
}

function renderCardsSeparatedByMonthAndCard(parcelas, currentMonthYm) {
  const detailContainer = document.getElementById('cartoesByMonthAndCardList');
  const summaryContainer = document.getElementById('cartoesMonthlySummaryList');
  if (!detailContainer || !summaryContainer) return;

  const openParcelas = parcelas.filter(
    (p) => String(p.status_fatura || '').toUpperCase() !== 'PAGA'
  );

  if (!openParcelas.length) {
    detailContainer.innerHTML = '<p class="muted">Nenhuma fatura ou parcela em aberto registrada.</p>';
    summaryContainer.innerHTML = '<p class="muted">Nenhuma soma mensal de fatura disponível.</p>';
    return;
  }

  const remainingByPurchase = {};
  openParcelas.forEach((p) => {
    const cid = String(p.compra_id || '');
    if (!cid) return;
    remainingByPurchase[cid] = (remainingByPurchase[cid] || 0) + Number(p.valor_fatura_banco || 0);
  });

  const byMonth = new Map();

  openParcelas.forEach((p) => {
    const rawMonth = String(p.competencia_fatura || '').slice(0, 7);
    const monthKey = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : '0000-00';
    const cardName = canonicalizeAccount(p.cartao_id || 'Cartão');

    const totalBanco = Number(p.valor_fatura_banco || 0);
    const minhaParte = Number(p.minha_parte_liquida || 0);
    const parteTerceiros = Number(p.terceiro_liquido_a_receber || 0);
    const desconto = Number(p.desconto_rateado || 0);

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, {
        monthKey,
        totalGeral: 0,
        totalMinhaParte: 0,
        totalTerceiros: 0,
        totalDesconto: 0,
        cards: new Map()
      });
    }

    const mBucket = byMonth.get(monthKey);
    mBucket.totalGeral += totalBanco;
    mBucket.totalMinhaParte += minhaParte;
    mBucket.totalTerceiros += parteTerceiros;
    mBucket.totalDesconto += desconto;

    if (!mBucket.cards.has(cardName)) {
      const cyc = monthKey !== '0000-00'
        ? computeStatementCycleForCard(cardName, `${monthKey}-10`, 0)
        : { dueDateIso: '' };
      mBucket.cards.set(cardName, {
        cardName,
        dueDateIso: cyc.dueDateIso,
        totalCartao: 0,
        minhaParteCartao: 0,
        terceirosCartao: 0,
        items: []
      });
    }

    const cBucket = mBucket.cards.get(cardName);
    cBucket.totalCartao += totalBanco;
    cBucket.minhaParteCartao += minhaParte;
    cBucket.terceirosCartao += parteTerceiros;
    cBucket.items.push(p);
  });

  const sortedMonths = Array.from(byMonth.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  detailContainer.innerHTML = sortedMonths.map((m, idx) => {
    const monthTitle = m.monthKey === '0000-00' ? 'SEM MÊS DEFINIDO' : formatMonthLabel(m.monthKey);
    const isOpen = m.monthKey === currentMonthYm || idx === 0;
    const cardsArr = Array.from(m.cards.values()).sort((a, b) =>
      a.cardName.localeCompare(b.cardName)
    );

    const cardsHtml = cardsArr.map((c) => {
      const dueBadge = c.dueDateIso
        ? `<span class="badge badge-info">Venc. ${formatDateBR(c.dueDateIso)}</span>`
        : '';

      const itemsHtml = c.items.map((item) => {
        const descParcela = canonicalizeText(item.descricao_parcela || 'Compra');
        const numP = Number(item.num_parcela || 1);
        const totP = Number(item.total_parcelas || 1);
        const minha = formatBRL(item.minha_parte_liquida || 0);
        const terc = Number(item.terceiro_liquido_a_receber || 0);
        const desc = Number(item.desconto_rateado || 0);
        const pessoa = normalizePersonName(item.pessoa_id || '');
        const tercTxt = terc > 0 ? ` • ${pessoa || 'TERCEIRO'}: ${formatBRL(terc)}` : '';
        const descTxt = desc > 0 ? ` • Desc.: ${formatBRL(desc)}` : '';
        const saldoRestanteCompra = item.compra_id && totP > 1
          ? ` • Saldo restante: ${formatBRL(remainingByPurchase[item.compra_id] || 0)}`
          : '';

        return `
          <div class="month-detail-row">
            <div>
              <strong>${descParcela}</strong> <span class="badge badge-info">${numP}/${totP}</span>
              <span class="month-detail-meta">Minha parte: ${minha}${tercTxt}${descTxt}${saldoRestanteCompra}</span>
            </div>
            <div class="month-detail-right">
              <strong>${formatBRL(item.valor_fatura_banco)}</strong>
              <button type="button" class="btn-edit" data-edit-card-purchase="${item.compra_id || ''}" data-card-desc="${descParcela}" data-card-name="${c.cardName}" title="Editar compra">✏️</button>
              <button type="button" class="btn-delete" data-del-card-purchase="${item.compra_id || ''}" data-del-label="${descParcela}" title="Excluir compra no cartão">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="card-subgroup">
          <div class="card-subgroup-header">
            <span>${c.cardName} ${dueBadge}</span>
            <span>Fatura: ${formatBRL(c.totalCartao)}</span>
          </div>
          <div class="card-split-line">
            <span>Minha parte: <strong>${formatBRL(c.minhaParteCartao)}</strong></span>
            <span>Terceiros / Rateio: <strong>${formatBRL(c.terceirosCartao)}</strong></span>
          </div>
          <div class="list-stack" style="gap: 6px;">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <details class="month-block" ${isOpen ? 'open' : ''}>
        <summary class="month-header">
          <span class="month-header-left">
            <span class="month-chevron">▶</span>
            <span class="month-title">${monthTitle}</span>
            <span class="month-count">${cardsArr.length} cartão(ões)</span>
          </span>
          <span class="month-balance-ok">Fatura Total: ${formatBRL(m.totalGeral)}</span>
        </summary>
        ${cardsHtml}
      </details>
    `;
  }).join('');

  summaryContainer.innerHTML = sortedMonths.map((m) => {
    const monthTitle = m.monthKey === '0000-00' ? 'SEM MÊS DEFINIDO' : formatMonthLabel(m.monthKey);
    return `
      <div class="month-block">
        <div class="month-header">
          <span class="month-title">${monthTitle}</span>
          <span class="month-balance-ok">Soma Total: ${formatBRL(m.totalGeral)}</span>
        </div>
        <div class="month-summary-box">
          <div class="summary-pill">
            <span>Fatura Total (Cartões)</span>
            <strong>${formatBRL(m.totalGeral)}</strong>
          </div>
          <div class="summary-pill">
            <span>Minha Parte (Própria)</span>
            <strong class="amt-pos">${formatBRL(m.totalMinhaParte)}</strong>
          </div>
          <div class="summary-pill">
            <span>Terceiros / Rateio</span>
            <strong style="color: var(--warning);">${formatBRL(m.totalTerceiros)}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderThirdPartiesSection(terceiros, currentMonthYm) {
  const summaryGridEl = document.getElementById('terceirosSummaryGrid');
  const listEl = document.getElementById('terceirosList');
  if (!summaryGridEl || !listEl) return;

  const balanceByPerson = {};
  state.people.forEach((p) => {
    balanceByPerson[p] = 0;
  });

  terceiros.forEach((t) => {
    const person = normalizePersonName(t.pessoa_id || 'TERCEIRO');
    if (!(person in balanceByPerson)) balanceByPerson[person] = 0;
    if (String(t.status || '').toUpperCase() !== 'QUITADO') {
      balanceByPerson[person] += Number(t.valor_ajustado_cobrado || 0);
    }
  });

  const personEntries = Object.entries(balanceByPerson);
  summaryGridEl.innerHTML = personEntries.length
    ? personEntries
        .sort((a, b) => b[1] - a[1])
        .map(([person, pending]) => {
          const isQuitado = pending <= 0.009;
          return `
            <div class="bank-card">
              <div class="bank-card-top">
                <span class="bank-name">${person}</span>
                ${isQuitado ? '<span class="badge badge-in">Quitado</span>' : '<span class="badge badge-warn">Pendente</span>'}
              </div>
              <strong class="bank-balance ${isQuitado ? 'pos' : 'warn'}">${formatBRL(pending)}</strong>
            </div>
          `;
        })
        .join('')
    : '<p class="muted">Nenhuma pessoa cadastrada.</p>';

  const filtered = state.selectedPersonFilter === 'ALL'
    ? terceiros
    : terceiros.filter((t) => normalizePersonName(t.pessoa_id) === state.selectedPersonFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<p class="muted">Nenhum lançamento encontrado para esta pessoa.</p>';
    return;
  }

  const groupsMap = new Map();
  [...filtered].reverse().forEach((t) => {
    const ym = String(t.competencia || '').slice(0, 7) || '0000-00';
    if (!groupsMap.has(ym)) {
      groupsMap.set(ym, { key: ym, total: 0, items: [] });
    }
    const g = groupsMap.get(ym);
    g.total += Number(t.valor_ajustado_cobrado || 0);
    g.items.push(t);
  });

  const groups = Array.from(groupsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

  listEl.innerHTML = groups.map((g, idx) => {
    const title = g.key === '0000-00' ? 'SEM COMPETÊNCIA' : formatMonthLabel(g.key);
    const isOpen = g.key === currentMonthYm || idx === 0;

    const rowsHtml = g.items.map((t) => {
      const desc = canonicalizeText(t.descricao || t.tipo_evento || 'Lançamento');
      const statusBadge = getStatusBadge(t.status);
      const person = normalizePersonName(t.pessoa_id || '-');
      return `
        <div class="month-detail-row">
          <div>
            <strong>${desc}</strong> ${statusBadge}
            <span class="month-detail-meta">Pessoa: ${person} • Competência: ${formatMonthShort(t.competencia)}</span>
          </div>
          <div class="month-detail-right">
            <strong>${formatBRL(t.valor_ajustado_cobrado)}</strong>
            <button type="button" class="btn-edit" data-edit-third="${t.razao_id || ''}" title="Editar">✏️</button>
            <button type="button" class="btn-delete" data-del-third="${t.razao_id || ''}" data-del-label="${desc}" title="Excluir">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <details class="month-block" ${isOpen ? 'open' : ''}>
        <summary class="month-header">
          <span class="month-header-left">
            <span class="month-chevron">▶</span>
            <span class="month-title">${title}</span>
            <span class="month-count">${g.items.length}</span>
          </span>
          <span class="month-balance-ok">Total: ${formatBRL(g.total)}</span>
        </summary>
        <div class="month-details">
          ${rowsHtml}
        </div>
      </details>
    `;
  }).join('');
}

function renderInvestmentsSection(investimentos, cotacoesCache) {
  const consolidatedEl = document.getElementById('investimentosConsolidatedList');
  const historyEl = document.getElementById('investimentosList');
  const kpiValorEl = document.getElementById('invKpiValorAtual');
  const kpiCustoEl = document.getElementById('invKpiCustoLiquido');
  const kpiProvEl = document.getElementById('invKpiProventos');
  if (!consolidatedEl || !historyEl) return;

  if (!investimentos.length) {
    if (kpiValorEl) kpiValorEl.textContent = formatBRL(0);
    if (kpiCustoEl) kpiCustoEl.textContent = formatBRL(0);
    if (kpiProvEl) kpiProvEl.textContent = formatBRL(0);
    renderPortfolioChart([]);
    consolidatedEl.innerHTML = '<p class="muted">Nenhuma posição consolidada ainda.</p>';
    historyEl.innerHTML = '<p class="muted">Nenhuma operação de investimento registrada na base ainda.</p>';
    return;
  }

  const quoteMap = {};
  if (Array.isArray(cotacoesCache)) {
    cotacoesCache.forEach((c) => {
      const t = normalizeTicker(c.ticker);
      if (t) quoteMap[t] = Number(c.preco_atual || 0);
    });
  }

  const chronologicalOps = [...investimentos].sort((a, b) =>
    String(a.data_op || a.data_operacao || '').localeCompare(
      String(b.data_op || b.data_operacao || '')
    )
  );

  const posMap = new Map();
  let totalProventos = 0;

  chronologicalOps.forEach((op) => {
    const ticker = normalizeTicker(op.ticker || op.nome_ativo || 'ATIVO');
    const tipo = String(op.tipo_op || '').toUpperCase();
    const qtd = Number(op.quantidade || 0);
    const val = Number(op.valor_total || 0);

    if (!posMap.has(ticker)) {
      posMap.set(ticker, {
        ticker,
        classe: op.classe_ativo || 'ACAO',
        qtdLiquida: 0,
        custoTotal: 0,
        proventos: 0
      });
    }

    const pos = posMap.get(ticker);
    if (tipo === 'COMPRA' || tipo === 'APORTE' || tipo === 'SALDO_INICIAL') {
      pos.qtdLiquida += qtd;
      pos.custoTotal += val;
    } else if (tipo === 'VENDA' || tipo === 'RESGATE') {
      const pmAtual = pos.qtdLiquida > 0 ? pos.custoTotal / pos.qtdLiquida : 0;
      pos.qtdLiquida = Math.max(0, pos.qtdLiquida - qtd);
      pos.custoTotal = Math.max(0, pos.custoTotal - pmAtual * qtd);
    } else if (tipo === 'DIVIDENDO' || tipo === 'JCP' || tipo === 'RENDIMENTO_RF') {
      pos.proventos += val;
      totalProventos += val;
    }
  });

  const positions = Array.from(posMap.values())
    .filter((p) => p.qtdLiquida > 0 || p.custoTotal > 0 || p.proventos > 0)
    .map((p) => {
      const pm = p.qtdLiquida > 0 ? p.custoTotal / p.qtdLiquida : 0;
      const cotAtual = quoteMap[p.ticker] || 0;
      const valorAtual = cotAtual > 0 && p.qtdLiquida > 0 ? cotAtual * p.qtdLiquida : p.custoTotal;
      return Object.assign({}, p, { pm, cotAtual, valorAtual });
    });

  const somaValorAtual = positions.reduce((acc, p) => acc + p.valorAtual, 0);
  const somaCustoLiquido = positions.reduce((acc, p) => acc + p.custoTotal, 0);

  if (kpiValorEl) kpiValorEl.textContent = formatBRL(somaValorAtual);
  if (kpiCustoEl) kpiCustoEl.textContent = formatBRL(somaCustoLiquido);
  if (kpiProvEl) kpiProvEl.textContent = formatBRL(totalProventos);

  renderPortfolioChart(positions);

  consolidatedEl.innerHTML = positions.map((p) => {
    const cotLabel = p.cotAtual > 0 ? formatBRL(p.cotAtual) : '—';
    const diff = p.valorAtual - p.custoTotal;
    const diffSign = diff >= 0 ? '+' : '';
    const diffCls = diff >= 0 ? 'amt-pos' : 'amt-neg';

    return `
      <div class="list-item">
        <div>
          <strong>${p.ticker}</strong> <span class="badge badge-info">${p.classe}</span>
          <span class="month-detail-meta">Qtd: ${p.qtdLiquida} • PM: ${formatBRL(p.pm)} • Cotação: ${cotLabel} • Custo: ${formatBRL(p.custoTotal)}</span>
        </div>
        <div class="month-detail-right">
          <div style="text-align: right;">
            <strong>${formatBRL(p.valorAtual)}</strong>
            <span class="month-detail-meta ${diffCls}">${diffSign}${formatBRL(diff)}</span>
          </div>
          <button type="button" class="btn-delete" data-del-asset="${p.ticker}" title="Excluir ativo inteiro">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  historyEl.innerHTML = [...investimentos].reverse().map((op) => {
    const ticker = normalizeTicker(op.ticker || op.nome_ativo);
    const dtBr = formatDateBR(op.data_op || op.data_operacao);
    const tipo = String(op.tipo_op || '').toUpperCase();
    const qtd = Number(op.quantidade || 0);
    const val = Number(op.valor_total || 0);
    const precoUnit = Number(op.preco_unitario || (qtd > 0 ? val / qtd : val));
    const isBuy = tipo === 'COMPRA' || tipo === 'APORTE' || tipo === 'SALDO_INICIAL';
    const badge = isBuy
      ? '<span class="badge badge-info">Compra</span>'
      : tipo === 'VENDA' || tipo === 'RESGATE'
        ? '<span class="badge badge-warn">Venda</span>'
        : '<span class="badge badge-in">Provento</span>';

    return `
      <div class="list-item">
        <div>
          <strong>${ticker}</strong> ${badge}
          <span class="month-detail-meta">${dtBr} • Qtd: ${qtd} • Preço unit.: ${formatBRL(precoUnit)}</span>
        </div>
        <div class="month-detail-right">
          <strong>${formatBRL(val)}</strong>
          <button type="button" class="btn-edit" data-edit-inv="${op.op_inv_id || ''}" title="Editar ordem">✏️</button>
          <button type="button" class="btn-delete" data-del-inv="${op.op_inv_id || ''}" data-del-label="${ticker}" title="Excluir ordem">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function bindDynamicEditDeleteButtons(movs, parcelas, terceiros, investimentos) {
  document.querySelectorAll('[data-del-mov]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteMovement(btn.dataset.delMov, btn.dataset.delLabel);
    });
  });

  document.querySelectorAll('[data-edit-mov]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = movs.find((x) => String(x.tx_id) === String(btn.dataset.editMov));
      if (!m) return;
      openEditModal({
        title: 'Editar Movimentação',
        kind: 'MOVEMENT',
        id: m.tx_id,
        desc: m.descricao,
        date: String(m.data_caixa || m.data_competencia || '').slice(0, 10),
        valor: m.valor,
        accountOrPerson: canonicalizeAccount(m.account_id),
        showDate: true,
        showVal: true,
        showAccountOrPerson: true,
        showQty: false,
        showStatus: false
      });
    });
  });

  document.querySelectorAll('[data-del-card-purchase]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCardPurchase(btn.dataset.delCardPurchase, btn.dataset.delLabel);
    });
  });

  document.querySelectorAll('[data-edit-card-purchase]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal({
        title: 'Editar Compra no Cartão',
        kind: 'CARD_PURCHASE',
        id: btn.dataset.editCardPurchase,
        desc: btn.dataset.cardDesc.replace(/\s*\(\d+\/\d+\)$/, ''),
        accountOrPerson: btn.dataset.cardName,
        showDate: false,
        showVal: false,
        showAccountOrPerson: true,
        showQty: false,
        showStatus: false
      });
    });
  });

  document.querySelectorAll('[data-del-third]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteThirdParty(btn.dataset.delThird, btn.dataset.delLabel);
    });
  });

  document.querySelectorAll('[data-edit-third]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = terceiros.find((x) => String(x.razao_id) === String(btn.dataset.editThird));
      if (!t) return;
      openEditModal({
        title: 'Editar Lançamento de Terceiro',
        kind: 'THIRD_PARTY',
        id: t.razao_id,
        desc: t.descricao,
        valor: t.valor_ajustado_cobrado,
        accountOrPerson: normalizePersonName(t.pessoa_id),
        status: t.status || 'PENDENTE',
        showDate: false,
        showVal: true,
        showAccountOrPerson: true,
        showQty: false,
        showStatus: true
      });
    });
  });

  document.querySelectorAll('[data-del-asset]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteInvestmentAsset(btn.dataset.delAsset);
    });
  });

  document.querySelectorAll('[data-del-inv]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteInvestmentOp(btn.dataset.delInv, btn.dataset.delLabel);
    });
  });

  document.querySelectorAll('[data-edit-inv]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const op = investimentos.find((x) => String(x.op_inv_id) === String(btn.dataset.editInv));
      if (!op) return;
      openEditModal({
        title: 'Editar Operação de Investimento',
        kind: 'INVESTMENT',
        id: op.op_inv_id,
        desc: op.ticker || op.nome_ativo,
        date: String(op.data_op || op.data_operacao || '').slice(0, 10),
        valor: op.valor_total,
        qty: op.quantidade,
        showDate: true,
        showVal: true,
        showAccountOrPerson: false,
        showQty: true,
        showStatus: false
      });
    });
  });
}

function renderAll() {
  const snap = state.snapshot;
  const movs = (snap && Array.isArray(snap.movimentacoes))
    ? snap.movimentacoes.filter((m) => !m.deleted && m.status !== 'CANCELADO')
    : [];
  const parcelas = (snap && Array.isArray(snap.parcelas_cartao)) ? snap.parcelas_cartao : [];
  const terceiros = (snap && Array.isArray(snap.terceiros_razao)) ? snap.terceiros_razao : [];
  const investimentos = (snap && Array.isArray(snap.investimentos)) ? snap.investimentos : [];
  const cotacoesCache = (snap && Array.isArray(snap.cotacoes_cache)) ? snap.cotacoes_cache : [];
  const proj = (snap && Array.isArray(snap.projecao_2026_2027)) ? snap.projecao_2026_2027 : [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentMonthYm = todayIso.slice(0, 7);
  let caixaHoje = 0;

  const saldosPorBanco = {};
  const entradasPorMes = {};
  const saidasMovPorMes = {};
  const itensPorMes = {};

  function pushMesItem(mesKey, label, valorStr, isPositive) {
    if (!mesKey) return;
    if (!itensPorMes[mesKey]) itensPorMes[mesKey] = [];
    itensPorMes[mesKey].push({ label, valorStr, isPositive });
  }

  movs.forEach((m) => {
    const v = Number(m.valor || 0);
    const t = String(m.tipo_mov || '').toUpperCase();
    const dtIso = String(m.data_caixa || m.data_competencia || '').slice(0, 10);
    const dtBr = formatDateBR(dtIso);
    const mesKey = dtIso.slice(0, 7);
    const banco = canonicalizeAccount(m.account_id);
    const desc = canonicalizeText(m.descricao || t);

    let delta = 0;
    if (t === 'RECEITA' || t === 'REEMBOLSO' || t === 'RESGATE') delta = v;
    if (t === 'DESPESA' || t === 'PAGTO_FATURA' || t === 'APORTE') delta = -v;

    if (!dtIso || dtIso <= todayIso) {
      caixaHoje += delta;
      saldosPorBanco[banco] = (saldosPorBanco[banco] || 0) + delta;
    }

    if (mesKey) {
      if (delta > 0) {
        entradasPorMes[mesKey] = (entradasPorMes[mesKey] || 0) + delta;
        pushMesItem(mesKey, `${dtBr} • ${desc} (${banco})`, `+ ${formatBRL(v)}`, true);
      }
      if (delta < 0) {
        saidasMovPorMes[mesKey] = (saidasMovPorMes[mesKey] || 0) + Math.abs(delta);
        pushMesItem(mesKey, `${dtBr} • ${desc} (${banco})`, `- ${formatBRL(v)}`, false);
      }
    }
  });

  // Aba Contas
  const bankGridEl = document.getElementById('bankBalancesGrid');
  if (bankGridEl) {
    const bancos = Object.entries(saldosPorBanco);
    bankGridEl.innerHTML = bancos.length
      ? bancos
          .sort((a, b) => b[1] - a[1])
          .map(([nomeBanco, saldo]) => {
            const cls = saldo >= 0 ? 'pos' : 'neg';
            return `<div class="bank-card"><span class="bank-name">${nomeBanco}</span><strong class="bank-balance ${cls}">${formatBRL(saldo)}</strong></div>`;
          })
          .join('')
      : '<p class="muted">Nenhuma conta movimentada até a data de hoje.</p>';
  }

  const faturasPorMes = {};
  parcelas.forEach((p) => {
    if (String(p.status_fatura || '').toUpperCase() === 'PAGA') return;
    const comp = String(p.competencia_fatura || '').slice(0, 7);
    const val = Number(p.valor_fatura_banco || 0);
    const descParcela = canonicalizeText(p.descricao_parcela || 'Parcela');
    const cartao = canonicalizeAccount(p.cartao_id || 'Cartão');
    if (comp) {
      faturasPorMes[comp] = (faturasPorMes[comp] || 0) + val;
      pushMesItem(
        comp,
        `Fatura ${cartao} • ${descParcela}`,
        `- ${formatBRL(val)}`,
        false
      );
    }
  });

  const faturasAbertas = parcelas
    .filter((p) => String(p.status_fatura || '').toUpperCase() !== 'PAGA')
    .reduce((acc, p) => acc + Number(p.valor_fatura_banco || 0), 0);

  const aReceber = terceiros
    .filter((t) => String(t.status || '').toUpperCase() !== 'QUITADO')
    .reduce((acc, t) => acc + Number(t.valor_ajustado_cobrado || 0), 0);

  const invTotal = investimentos.reduce((acc, op) => {
    const v = Number(op.valor_total || 0);
    return String(op.tipo_op).toUpperCase() === 'VENDA' || String(op.tipo_op).toUpperCase() === 'RESGATE'
      ? acc - v
      : acc + v;
  }, 0);

  document.getElementById('kpiCaixa').textContent = formatBRL(caixaHoje);
  document.getElementById('kpiFaturas').textContent = formatBRL(faturasAbertas);
  document.getElementById('kpiAReceber').textContent = formatBRL(aReceber);
  document.getElementById('kpiPatrimonio').textContent = formatBRL(caixaHoje + invTotal);

  renderMovementsSection(movs, todayIso, currentMonthYm);
  renderCardsSeparatedByMonthAndCard(parcelas, currentMonthYm);
  renderThirdPartiesSection(terceiros, currentMonthYm);
  renderInvestmentsSection(investimentos, cotacoesCache);

  let saldoAcumulado = caixaHoje;
  const scheduleRows = proj.map((p) => {
    const mes = String(p.competencia || '').slice(0, 7);
    const entradas = Number(entradasPorMes[mes] || 0);
    const saidasMov = Number(saidasMovPorMes[mes] || 0);
    const faturasMes = Number(faturasPorMes[mes] || 0);
    const aPagar = saidasMov + faturasMes;

    if (mes !== currentMonthYm) {
      saldoAcumulado += entradas - aPagar;
    }

    return {
      mes,
      tituloMes: formatMonthLabel(mes),
      entradas,
      faturasMes,
      aPagar,
      reembolsosPrevistos: Number(p.reembolsos_a_receber || 0),
      saldoFinal: saldoAcumulado,
      detalhes: itensPorMes[mes] || []
    };
  });

  const currentRow = scheduleRows.find((r) => r.mes === currentMonthYm) || scheduleRows[0] || null;
  renderExecutiveHome(currentRow, movs, faturasAbertas, parcelas, terceiros, currentMonthYm);

  const projFullEl = document.getElementById('projecaoFullList');
  if (projFullEl && scheduleRows.length) {
    projFullEl.innerHTML = scheduleRows
      .map((item) => {
        const balClass = item.saldoFinal >= 0 ? 'month-balance-ok' : 'month-balance-neg';
        const reconBtn = renderReconcileButton(item.mes);
        const isOpen = item.mes === currentMonthYm;
        const detailsHtml = item.detalhes.length
          ? `<div class="month-details">${item.detalhes.map((d) => {
              const amtCls = d.isPositive ? 'amt-pos' : 'amt-neg';
              return `<div class="month-detail-row"><span>${d.label}</span><strong class="${amtCls}">${d.valorStr}</strong></div>`;
            }).join('')}</div>`
          : '<div class="month-details"><span class="muted">Sem lançamentos programados neste mês.</span></div>';

        return `
          <details class="month-block" ${isOpen ? 'open' : ''}>
            <summary class="month-header">
              <span class="month-header-left">
                <span class="month-chevron">▶</span>
                <span class="month-title">${item.tituloMes}</span>
              </span>
              <span class="month-header-right">
                ${reconBtn}
                <span class="${balClass}">Saldo: ${formatBRL(item.saldoFinal)}</span>
              </span>
            </summary>
            <div class="month-metrics">
              <div class="month-metric"><span>Entradas</span><strong class="amt-pos">${formatBRL(item.entradas)}</strong></div>
              <div class="month-metric"><span>A pagar (desp./faturas)</span><strong class="amt-neg">${formatBRL(item.aPagar)}</strong></div>
              <div class="month-metric"><span>Faturas cartão</span><strong>${formatBRL(item.faturasMes)}</strong></div>
            </div>
            ${detailsHtml}
          </details>
        `;
      })
      .join('');
  }

  renderMonthlyChart(scheduleRows);

  document.querySelectorAll('[data-recon-ym]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMonthReconciled(btn.dataset.reconYm);
    });
  });

  bindDynamicEditDeleteButtons(movs, parcelas, terceiros, investimentos);
}

/* ==========================================================================
   6. NAVEGAÇÃO E EVENT LISTENERS
   ========================================================================== */

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function openModal() {
  document.getElementById('quickAddModal').classList.remove('hidden');
  updateQuickFormVisibility();
}

function closeModal() {
  document.getElementById('quickAddModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const btnGoToFluxo = document.getElementById('btnGoToFluxo');
  if (btnGoToFluxo) {
    btnGoToFluxo.addEventListener('click', () => switchTab('projecao'));
  }

  const btnGoToMovs = document.getElementById('btnGoToMovs');
  if (btnGoToMovs) {
    btnGoToMovs.addEventListener('click', () => switchTab('movimentacoes'));
  }

  document.getElementById('btnOpenQuickAdd').addEventListener('click', openModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnSync').addEventListener('click', syncFromBackend);
  document.getElementById('configForm').addEventListener('submit', saveConfig);
  document.getElementById('quickAddForm').addEventListener('submit', handleQuickAddSubmit);
  document.getElementById('editEntryForm').addEventListener('submit', handleSaveEditSubmit);

  const appearanceForm = document.getElementById('appearanceForm');
  if (appearanceForm) appearanceForm.addEventListener('submit', saveAppearance);

  const addCardRuleForm = document.getElementById('addCardRuleForm');
  if (addCardRuleForm) addCardRuleForm.addEventListener('submit', handleAddCardRule);

  const filterPeriod = document.getElementById('filterMovPeriod');
  const filterMonth = document.getElementById('filterMovMonth');
  const filterType = document.getElementById('filterMovType');
  const filterAccount = document.getElementById('filterMovAccount');
  const filterSearch = document.getElementById('filterMovSearch');
  const clearFiltersBtn = document.getElementById('btnClearMovFilters');

  if (filterPeriod) {
    filterPeriod.addEventListener('change', () => {
      state.movFilters.period = filterPeriod.value;
      renderAll();
    });
  }
  if (filterMonth) {
    filterMonth.addEventListener('change', () => {
      state.movFilters.month = filterMonth.value;
      renderAll();
    });
  }
  if (filterType) {
    filterType.addEventListener('change', () => {
      state.movFilters.type = filterType.value;
      renderAll();
    });
  }
  if (filterAccount) {
    filterAccount.addEventListener('change', () => {
      state.movFilters.account = filterAccount.value;
      renderAll();
    });
  }
  if (filterSearch) {
    filterSearch.addEventListener('input', () => {
      state.movFilters.search = filterSearch.value.trim();
      renderAll();
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.movFilters = { period: 'ALL', month: 'ALL', type: 'ALL', account: 'ALL', search: '' };
      if (filterPeriod) filterPeriod.value = 'ALL';
      if (filterMonth) filterMonth.value = 'ALL';
      if (filterType) filterType.value = 'ALL';
      if (filterAccount) filterAccount.value = 'ALL';
      if (filterSearch) filterSearch.value = '';
      renderAll();
    });
  }

  const addPersonForm = document.getElementById('addPersonForm');
  if (addPersonForm) addPersonForm.addEventListener('submit', handleAddPerson);

  const investForm = document.getElementById('investForm');
  if (investForm) investForm.addEventListener('submit', handleInvestSubmit);

  const btnQuotes = document.getElementById('btnUpdateQuotes');
  if (btnQuotes) btnQuotes.addEventListener('click', handleUpdateQuotes);

  ['txTipo', 'txResponsavel', 'txConta', 'txValor', 'txMinhaParte', 'txDesconto', 'txIsRecorrente', 'txData', 'txParcelas'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateQuickFormVisibility);
      el.addEventListener('change', updateQuickFormVisibility);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service Worker não registrado:', err);
    });
  }
});