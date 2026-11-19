const STORAGE_KEYS = {
  CONFIG: 'athena_cfg_v1',
  CACHE: 'athena_cache_v1'
};

const state = {
  config: { apiUrl: '', apiKey: '' },
  snapshot: null
};

function formatBRL(value) {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
  } catch (err) {
    console.warn('Falha ao carregar armazenamento local:', err);
  }

  const urlInput = document.getElementById('cfgApiUrl');
  const keyInput = document.getElementById('cfgApiKey');
  if (urlInput) urlInput.value = state.config.apiUrl || '';
  if (keyInput) keyInput.value = state.config.apiKey || '';

  const dateInput = document.getElementById('txData');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  renderAll();
}

function saveConfig(event) {
  event.preventDefault();
  const apiUrl = document.getElementById('cfgApiUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();

  if (!apiUrl || !apiKey) {
    alert('Preencha a URL do Web App e a chave API_ACCESS_KEY.');
    return;
  }

  state.config = { apiUrl, apiKey };
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(state.config));
  updateSyncBadge('Configuração salva. Clique em Sincronizar.');
  alert('Configuração salva neste navegador.');
}

function updateSyncBadge(text) {
  const badge = document.getElementById('syncStatus');
  if (badge) badge.textContent = text;
}

async function syncFromBackend() {
  if (!state.config.apiUrl || !state.config.apiKey) {
    updateSyncBadge('Configure URL e Chave na aba Configurações');
    switchTab('config');
    return;
  }

  updateSyncBadge('Sincronizando...');
  try {
    const sep = state.config.apiUrl.indexOf('?') === -1 ? '?' : '&';
    const sinceParam = state.snapshot && state.snapshot.last_sync_ts
      ? `&since=${encodeURIComponent(state.snapshot.last_sync_ts)}`
      : '';
    const endpoint = `${state.config.apiUrl}${sep}action=sync&api_key=${encodeURIComponent(state.config.apiKey)}${sinceParam}`;

    const resp = await fetch(endpoint);
    const json = await resp.json();

    if (!json.ok) {
      throw new Error(json.error || 'Erro ao sincronizar com o Apps Script.');
    }

    if (json.data && json.data.has_changes !== false) {
      state.snapshot = Object.assign({}, state.snapshot || {}, json.data);
      localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(state.snapshot));
    }

    const stamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    updateSyncBadge(`Sincronizado às ${stamp}`);
    renderAll();
  } catch (err) {
    updateSyncBadge('Falha na sincronização (usando cache local)');
    console.error(err);
    alert(`Erro ao sincronizar: ${err.message}`);
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
  const cardBox = document.getElementById('cardExtraFields');
  const splitBox = document.getElementById('splitFields');

  if (tipo === 'COMPRA_CARTAO') {
    cardBox.classList.remove('hidden');
  } else {
    cardBox.classList.add('hidden');
  }

  if (tipo === 'COMPRA_CARTAO' && resp === 'MAE_COMPARTILHADO') {
    splitBox.classList.remove('hidden');
  } else {
    splitBox.classList.add('hidden');
  }

  evaluateSplitWarning();
}

async function handleQuickAddSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitTx');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const tipo = document.getElementById('txTipo').value;
    const descricao = document.getElementById('txDescricao').value.trim();
    const valor = Number(document.getElementById('txValor').value);
    const data = document.getElementById('txData').value;
    const categoria = document.getElementById('txCategoria').value.trim() || 'Geral';
    const conta = document.getElementById('txConta').value;
    const idemKey = `pwa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (tipo === 'COMPRA_CARTAO') {
      const parcelas = Math.max(1, parseInt(document.getElementById('txParcelas').value || '1', 10));
      const resp = document.getElementById('txResponsavel').value;
      const minhaRaw = document.getElementById('txMinhaParte').value;
      const desconto = Number(document.getElementById('txDesconto').value || 0);

      let modoDivisao = 'INTEGRAL_MEU';
      let pessoaId = '';
      let valorMinhaParte = valor;
      let valorParteTerceiro = 0;

      if (resp === 'MAE_INTEGRAL') {
        modoDivisao = 'INTEGRAL_TERCEIRO';
        pessoaId = 'MAE';
        valorMinhaParte = 0;
        valorParteTerceiro = valor;
      } else if (resp === 'MAE_COMPARTILHADO') {
        modoDivisao = 'COMPARTILHADO';
        pessoaId = 'MAE';
        valorMinhaParte = minhaRaw !== '' ? Number(minhaRaw) : valor / 2;
        valorParteTerceiro = Math.max(0, valor - valorMinhaParte);
      } else if (resp === 'ERIC') {
        modoDivisao = 'INTEGRAL_TERCEIRO';
        pessoaId = 'ERIC';
        valorMinhaParte = 0;
        valorParteTerceiro = valor;
      } else if (resp === 'ANDERSON') {
        modoDivisao = 'INTEGRAL_TERCEIRO';
        pessoaId = 'ANDERSON';
        valorMinhaParte = 0;
        valorParteTerceiro = valor;
      }

      const res = await postToBackend('createCardPurchase', {
        idempotency_key: idemKey,
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
        is_estimativa: desconto > 0 || resp === 'MAE_COMPARTILHADO'
      });

      if (res && res.alerta_divergencia) {
        alert(`Registrado, mas atenção à divisão:\n${res.alerta_divergencia}`);
      } else {
        alert('Compra no cartão registrada com sucesso!');
      }
    } else if (tipo === 'REEMBOLSO') {
      const pessoaId = document.getElementById('txResponsavel').value === 'ERIC'
        ? 'ERIC'
        : document.getElementById('txResponsavel').value === 'ANDERSON'
          ? 'ANDERSON'
          : 'MAE';

      await postToBackend('recordRefund', {
        idempotency_key: idemKey,
        pessoa_id: pessoaId,
        competencia: data.slice(0, 7),
        data_recebimento: data,
        descricao,
        categoria_id: categoria,
        account_id: conta,
        valor_recebido: valor
      });
      alert('Reembolso registrado com sucesso!');
    } else {
      await postToBackend('createTransaction', {
        idempotency_key: idemKey,
        data_competencia: data,
        data_caixa: data,
        descricao,
        tipo_mov: tipo,
        categoria_id: categoria,
        account_id: conta,
        valor,
        status: 'REALIZADO'
      });
      alert('Movimentação registrada com sucesso!');
    }

    document.getElementById('quickAddForm').reset();
    document.getElementById('txData').value = new Date().toISOString().slice(0, 10);
    closeModal();
    await syncFromBackend();
  } catch (err) {
    alert(`Erro ao salvar: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar e Sincronizar';
  }
}

function renderAll() {
  const snap = state.snapshot;
  const movs = (snap && Array.isArray(snap.movimentacoes))
    ? snap.movimentacoes.filter((m) => !m.deleted && m.status !== 'CANCELADO')
    : [];
  const parcelas = (snap && Array.isArray(snap.parcelas_cartao)) ? snap.parcelas_cartao : [];
  const terceiros = (snap && Array.isArray(snap.terceiros_razao)) ? snap.terceiros_razao : [];
  const investimentos = (snap && Array.isArray(snap.investimentos)) ? snap.investimentos : [];
  const proj = (snap && Array.isArray(snap.projecao_2026_2027)) ? snap.projecao_2026_2027 : [];

  let caixa = 0;
  movs.forEach((m) => {
    const v = Number(m.valor || 0);
    const t = String(m.tipo_mov || '').toUpperCase();
    if (t === 'RECEITA' || t === 'REEMBOLSO' || t === 'RESGATE') caixa += v;
    if (t === 'DESPESA' || t === 'PAGTO_FATURA' || t === 'APORTE') caixa -= v;
  });

  const faturasAbertas = parcelas
    .filter((p) => String(p.status_fatura || '').toUpperCase() !== 'PAGA')
    .reduce((acc, p) => acc + Number(p.valor_fatura_banco || 0), 0);

  const aReceber = terceiros
    .filter((t) => String(t.status || '').toUpperCase() !== 'QUITADO')
    .reduce((acc, t) => acc + Number(t.valor_ajustado_cobrado || 0), 0);

  const invTotal = investimentos.reduce((acc, op) => {
    const v = Number(op.valor_total || 0);
    return String(op.tipo_op).toUpperCase() === 'VENDA' ? acc - v : acc + v;
  }, 0);

  document.getElementById('kpiCaixa').textContent = formatBRL(caixa);
  document.getElementById('kpiFaturas').textContent = formatBRL(faturasAbertas);
  document.getElementById('kpiAReceber').textContent = formatBRL(aReceber);
  document.getElementById('kpiPatrimonio').textContent = formatBRL(caixa + invTotal);

  // 1. Movimentações
  const movListEl = document.getElementById('movimentacoesList');
  movListEl.innerHTML = movs.length
    ? movs.slice(-25).reverse().map((m) => {
        const dt = String(m.data_caixa || '').slice(0, 10);
        return `<div class="list-item"><span><strong>${m.descricao || 'Sem descrição'}</strong><br><small class="muted">${dt} • ${m.tipo_mov || ''} • ${m.account_id || ''}</small></span><strong>${formatBRL(m.valor)}</strong></div>`;
      }).join('')
    : '<p class="muted">Nenhuma movimentação encontrada na base.</p>';

  // 2. Cartões Compartilhados
  const cartoesEl = document.getElementById('cartoesList');
  if (cartoesEl) {
    cartoesEl.innerHTML = parcelas.length
      ? parcelas.slice(-30).reverse().map((p) => {
          const minha = Number(p.minha_parte_liquida || 0);
          const terc = Number(p.terceiro_liquido_a_receber || 0);
          const desc = Number(p.desconto_rateado || 0);
          const extra = terc > 0
            ? ` • ${p.pessoa_id || 'Terceiro'}: ${formatBRL(terc)}${desc > 0 ? ` (desc. ${formatBRL(desc)})` : ''}`
            : '';
          return `<div class="list-item"><span><strong>${p.descricao_parcela || 'Compra'}</strong><br><small class="muted">${p.cartao_id || ''} • Fatura ${p.competencia_fatura || ''} • Minha parte: ${formatBRL(minha)}${extra}</small></span><strong>${formatBRL(p.valor_fatura_banco)}</strong></div>`;
        }).join('')
      : '<p class="muted">Nenhuma parcela ou compra no cartão registrada ainda. Use "+ Lançar" e escolha "Compra no Cartão".</p>';
  }

  // 3. Terceiros / Reembolsos
  const terceirosEl = document.getElementById('terceirosList');
  if (terceirosEl) {
    terceirosEl.innerHTML = terceiros.length
      ? terceiros.slice(-30).reverse().map((t) =>
          `<div class="list-item"><span><strong>${t.descricao || t.tipo_evento}</strong><br><small class="muted">${t.pessoa_id || ''} • Comp. ${t.competencia || ''} • ${t.status || ''}</small></span><strong>${formatBRL(t.valor_ajustado_cobrado)}</strong></div>`
        ).join('')
      : '<p class="muted">Nenhum lançamento de reembolso ou terceiro registrado ainda.</p>';
  }

  // 4. Investimentos
  const invEl = document.getElementById('investimentosList');
  if (invEl) {
    invEl.innerHTML = investimentos.length
      ? investimentos.slice(-30).reverse().map((op) =>
          `<div class="list-item"><span><strong>${op.ticker || op.nome_ativo}</strong><br><small class="muted">${op.tipo_op || ''} • ${op.classe_ativo || ''} • Qtd: ${op.quantidade || 0}</small></span><strong>${formatBRL(op.valor_total)}</strong></div>`
        ).join('')
      : '<p class="muted">Nenhuma operação de investimento registrada na base ainda.</p>';
  }

  // 5. Projeção até 12/2027 (somando o caixa atual ao saldo projetado)
  const projPreviewEl = document.getElementById('homeProjectionPreview');
  const projFullEl = document.getElementById('projecaoFullList');
  if (proj.length) {
    const mapRow = (p) => {
      const saldoAjustado = Number(p.saldo_caixa_projetado || 0) + caixa;
      const saldoComReemb = Number(p.saldo_com_reembolsos_previstos || 0) + caixa;
      return `<div class="list-item"><span><strong>${p.competencia}</strong><br><small class="muted">A receber: ${formatBRL(p.reembolsos_a_receber)} • Com reembolsos: ${formatBRL(saldoComReemb)}</small></span><strong>Caixa proj.: ${formatBRL(saldoAjustado)}</strong></div>`;
    };
    projPreviewEl.innerHTML = proj.slice(0, 4).map(mapRow).join('');
    projFullEl.innerHTML = proj.map(mapRow).join('');
  }
}

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

  document.getElementById('btnOpenQuickAdd').addEventListener('click', openModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnSync').addEventListener('click', syncFromBackend);
  document.getElementById('configForm').addEventListener('submit', saveConfig);
  document.getElementById('quickAddForm').addEventListener('submit', handleQuickAddSubmit);

  ['txTipo', 'txResponsavel', 'txValor', 'txMinhaParte', 'txDesconto'].forEach((id) => {
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