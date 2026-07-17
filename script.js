const STORAGE_KEY = "casagest-static-v1";

const defaultState = {
  theme: "dark",
  address: { cep: "01001-000", logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" },
  residents: [
    { id: 1, name: "Cristian Bonadiman", cpf: "123.456.789-00", relation: "Titular da residência", owner: true, initials: "CB" },
    { id: 2, name: "Maria Oliveira", cpf: "987.654.321-00", relation: "Cônjuge", owner: false, initials: "MO" },
    { id: 3, name: "Lucas Silva", cpf: "456.789.123-00", relation: "Filho", owner: false, initials: "LS" }
  ],
  accounts: [
    { id: 1, type: "Energia elétrica", category: "energia", value: 245.8, due: "2026-07-20", paid: true },
    { id: 2, type: "Água e saneamento", category: "agua", value: 89.9, due: "2026-07-22", paid: false },
    { id: 3, type: "Internet fibra", category: "internet", value: 119.9, due: "2026-07-25", paid: true },
    { id: 4, type: "Condomínio", category: "outros", value: 480, due: "2026-07-28", paid: false }
  ]
};

const viewText = {
  home: ["Visão geral", "Tudo o que acontece na sua casa, em um só lugar."],
  moradores: ["Moradores", "Gerencie as pessoas vinculadas a esta residência."],
  contas: ["Contas da casa", "Acompanhe vencimentos e mantenha os pagamentos em dia."],
  perfil: ["Meu perfil", "Confira seus dados e preferências da residência."]
};

const icons = { energia: "ϟ", agua: "●", internet: "⌁", outros: "▦" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
let filter = "todas";
let search = "";
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (text) => String(text).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify(message) {
  const toast = $("#toast");
  $("p", toast).textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function totals() {
  const total = state.accounts.reduce((sum, item) => sum + item.value, 0);
  const paid = state.accounts.filter(item => item.paid).reduce((sum, item) => sum + item.value, 0);
  return { total, paid, pending: total - paid, percent: total ? Math.round(paid / total * 100) : 0 };
}

function changeView(view, pushHistory = true) {
  if (!viewText[view]) view = "home";
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".nav-btn").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#page-title").textContent = viewText[view][0];
  $("#page-subtitle").textContent = viewText[view][1];
  closeMenu();
  if (pushHistory) history.pushState({ view }, "", view === "home" ? location.pathname : `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openMenu() {
  $("#sidebar").classList.add("open");
  $("#overlay").classList.add("show");
}

function closeMenu() {
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  $("#theme-btn").textContent = theme === "dark" ? "☀" : "☾";
  $("#theme-label").textContent = theme === "dark" ? "Escuro" : "Claro";
  save();
}

function toggleTheme() {
  setTheme(state.theme === "dark" ? "light" : "dark");
  notify(`Modo ${state.theme === "dark" ? "escuro" : "claro"} ativado.`);
}

function formatCep(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function updateAddress() {
  const address = state.address;
  $("#address-street").textContent = address.logradouro;
  $("#address-city").textContent = `${address.bairro} • ${address.localidade}/${address.uf}`;
  $("#address-cep").textContent = `CEP ${address.cep}`;
  $("#profile-address").textContent = `${address.logradouro}, ${address.bairro}`;
  $("#cep").value = address.cep;
}

async function searchCep(event) {
  event.preventDefault();
  const input = $("#cep");
  const error = $("#cep-error");
  const button = $("#cep-button");
  const clean = input.value.replace(/\D/g, "");
  if (clean.length !== 8) {
    error.textContent = "Digite os 8 números do CEP.";
    return;
  }
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Buscando...";
  try {
    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await response.json();
    if (!response.ok || data.erro) throw new Error();
    state.address = {
      cep: formatCep(data.cep || clean),
      logradouro: data.logradouro || "Logradouro não informado",
      bairro: data.bairro || "Bairro não informado",
      localidade: data.localidade,
      uf: data.uf
    };
    save();
    renderAll();
    notify("Endereço atualizado com sucesso.");
  } catch {
    error.textContent = "CEP não encontrado. Confira e tente novamente.";
  } finally {
    button.disabled = false;
    button.textContent = "⌕ Buscar endereço";
  }
}

function renderDashboard() {
  const value = totals();
  $("#stat-residents").textContent = state.residents.length;
  $("#stat-accounts").textContent = state.accounts.length;
  $("#stat-pending-count").textContent = `${state.accounts.filter(item => !item.paid).length} aguardando pagamento`;
  $("#stat-paid").textContent = money.format(value.paid);
  $("#stat-percent").textContent = `${value.percent}% das despesas`;
  $("#stat-pending").textContent = money.format(value.pending);
  $("#month-total").textContent = money.format(value.total);
  $("#paid-percent").textContent = `${value.percent}% pago`;
  $("#progress-bar").style.width = `${value.percent}%`;

  $("#accounts-preview").innerHTML = state.accounts.slice(0, 3).map(item => `
    <div class="preview-item">
      <span class="bill-icon ${item.category}">${icons[item.category]}</span>
      <div class="bill-name"><strong>${escapeHtml(item.type)}</strong><small>Vence em ${date.format(new Date(item.due))}</small></div>
      <strong>${money.format(item.value)}</strong><span class="status ${item.paid ? "paid" : "pending"}">${item.paid ? "Pago" : "Pendente"}</span>
    </div>`).join("") || '<div class="empty">Nenhuma conta cadastrada.</div>';

  $("#residents-preview").innerHTML = state.residents.slice(0, 3).map(item => `
    <div class="resident-preview"><span class="avatar small">${escapeHtml(item.initials)}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.relation)}</small></div>${item.owner ? '<span class="owner">Titular</span>' : ""}</div>`).join("");
}

function renderResidents() {
  $("#resident-count").textContent = `${state.residents.length} ${state.residents.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}`;
  $("#residents-grid").innerHTML = state.residents.map(item => `
    <article class="panel resident-card">
      <div class="resident-card-top"><span class="avatar">${escapeHtml(item.initials)}</span><span>•••</span></div>
      <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.relation)}</p>
      <div class="resident-details"><span>✓ CPF ${escapeHtml(item.cpf)}</span><span>⌖ ${escapeHtml(state.address.localidade)}, ${escapeHtml(state.address.uf)}</span></div>
      <div class="resident-footer"><span class="owner">${item.owner ? "Titular" : "Morador"}</span><button class="delete-btn" data-delete-resident="${item.id}" aria-label="Excluir morador">⌫</button></div>
    </article>`).join("") + `
    <button class="add-card" data-open="resident-modal"><span>+</span><strong>Adicionar nova pessoa</strong><small>Cadastre mais um morador</small></button>`;
}

function renderAccounts() {
  const value = totals();
  $("#summary-total").textContent = money.format(value.total);
  $("#summary-paid").textContent = money.format(value.paid);
  $("#summary-pending").textContent = money.format(value.pending);
  $("#summary-count").textContent = `${state.accounts.length} contas cadastradas`;
  $("#summary-pending-count").textContent = `${state.accounts.filter(item => !item.paid).length} contas pendentes`;
  const visible = state.accounts.filter(item => {
    const filterMatch = filter === "todas" || (filter === "pagas" && item.paid) || (filter === "pendentes" && !item.paid);
    return filterMatch && item.type.toLowerCase().includes(search.toLowerCase());
  });
  $("#accounts-list").innerHTML = visible.map(item => `
    <article class="account-row">
      <span class="bill-icon ${item.category}">${icons[item.category]}</span>
      <div class="account-main"><strong>${escapeHtml(item.type)}</strong><small>▣ Vencimento: ${date.format(new Date(item.due))}</small></div>
      <div class="account-value"><small>VALOR</small><strong>${money.format(item.value)}</strong></div>
      <span class="status ${item.paid ? "paid" : "pending"}">${item.paid ? "Pago" : "Pendente"}</span>
      <div class="row-actions"><button class="mark-btn" data-toggle-account="${item.id}">${item.paid ? "◷ Reabrir" : "✓ Marcar paga"}</button><button class="delete-btn" data-delete-account="${item.id}" aria-label="Excluir conta">⌫</button></div>
    </article>`).join("") || '<div class="empty">⌕<br>Nenhuma conta encontrada.</div>';
}

function renderAll() {
  updateAddress();
  renderDashboard();
  renderResidents();
  renderAccounts();
}

function addAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  state.accounts.push({ id: Date.now(), type: data.get("type").trim(), category: data.get("category"), value: Number(data.get("value")), due: data.get("due"), paid: false });
  save(); renderAll(); form.reset(); $("#account-modal").close(); notify("Nova conta adicionada.");
}

function addResident(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = data.get("name").trim();
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  state.residents.push({ id: Date.now(), name, cpf: data.get("cpf").trim(), relation: data.get("relation"), owner: false, initials });
  save(); renderAll(); form.reset(); $("#resident-modal").close(); notify("Novo morador adicionado.");
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) changeView(viewButton.dataset.view);
  const openButton = event.target.closest("[data-open]");
  if (openButton) $(`#${openButton.dataset.open}`).showModal();
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) $(`#${closeButton.dataset.close}`).close();
  const toggleButton = event.target.closest("[data-toggle-account]");
  if (toggleButton) {
    const account = state.accounts.find(item => item.id === Number(toggleButton.dataset.toggleAccount));
    if (account) { account.paid = !account.paid; save(); renderAll(); notify("Status da conta atualizado."); }
  }
  const deleteAccount = event.target.closest("[data-delete-account]");
  if (deleteAccount) { state.accounts = state.accounts.filter(item => item.id !== Number(deleteAccount.dataset.deleteAccount)); save(); renderAll(); notify("Conta removida."); }
  const deleteResident = event.target.closest("[data-delete-resident]");
  if (deleteResident) {
    const resident = state.residents.find(item => item.id === Number(deleteResident.dataset.deleteResident));
    if (resident?.owner) return notify("O titular não pode ser removido.");
    state.residents = state.residents.filter(item => item.id !== Number(deleteResident.dataset.deleteResident)); save(); renderAll(); notify("Morador removido.");
  }
});

$("#open-menu").addEventListener("click", openMenu);
$("#close-menu").addEventListener("click", closeMenu);
$("#overlay").addEventListener("click", closeMenu);
$("#theme-btn").addEventListener("click", toggleTheme);
$("#preference-theme").addEventListener("click", toggleTheme);
$("#notification-btn").addEventListener("click", () => notify("Você não tem novas notificações."));
$("#report-btn").addEventListener("click", () => notify("Relatórios mensais estão ativados."));
$("#cep").addEventListener("input", event => event.target.value = formatCep(event.target.value));
$("#cep-form").addEventListener("submit", searchCep);
$("#account-form").addEventListener("submit", addAccount);
$("#resident-form").addEventListener("submit", addResident);
$("#account-search").addEventListener("input", event => { search = event.target.value; renderAccounts(); });
$$('[data-filter]').forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; $$('[data-filter]').forEach(item => item.classList.toggle("active", item === button)); renderAccounts(); }));
window.addEventListener("popstate", () => changeView(location.hash.slice(1) || "home", false));
document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });

setTheme(state.theme);
renderAll();
changeView(location.hash.slice(1) || "home", false);
