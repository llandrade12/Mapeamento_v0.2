const STORAGE_KEY = "office-map-data-v3";
const LEGACY_KEYS = ["office-map-data-v2", "office-map-data-v1"];
const employeeFunctions = ["Gestão", "Planilha", "Cobrança", "Cadastro", "TI", "Financeiro"];
const brazilStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const types = ["person", "email", "sheet", "notebook", "phone", "office", "wifi", "item"];
const unassignedTypes = ["person", "item", "wifi"];
const MASTER_PASSWORD = "espartano260708";
const protectedDetailKeys = ["password", "cardLastDigits"];
const typeLabels = { person: "Funcionário", email: "E-mail", sheet: "Planilha", notebook: "Notebook", phone: "Celular", office: "Office Family", wifi: "Rede Wi-Fi", item: "Item geral" };
const viewTitles = { dashboard: "Painel", people: "Funcionários", emails: "E-mails", sheets: "Planilhas", notebooks: "Notebooks", phones: "Celulares", offices: "Office Family", wifis: "Redes Wi-Fi", items: "Itens gerais", map: "Mapa" };
const listTargets = { person: "peopleList", email: "emailsList", sheet: "sheetsList", notebook: "notebooksList", phone: "phonesList", office: "officesList", wifi: "wifisList", item: "itemsList" };
const schemas = {
  person: [field("function", "Função", "select", false, employeeFunctions), field("states", "Estados trabalhados", "multistate"), field("username", "Username"), field("email", "E-mail principal", "email"), field("phone", "Telefone"), field("status", "Status", "select", false, ["Ativo", "Afastado", "Desligado"])],
  email: [field("address", "Endereço de e-mail", "email", false), field("kind", "Tipo", "select", false, ["Individual", "Compartilhado", "Alias", "Grupo"]), field("purpose", "Finalidade")],
  sheet: [field("purpose", "Finalidade", "text", false), field("states", "Estados atendidos", "multistate"), field("frequency", "Atualização", "select", false, ["Diária", "Semanal", "Mensal", "Sob demanda"]), field("ownerArea", "Área responsável")],
  notebook: [field("username", "Username", "text", false), field("model", "Modelo"), field("serial", "Serial"), field("patrimony", "Patrimônio"), field("status", "Status", "select", false, ["Em uso", "Reserva", "Manutenção", "Devolvido"])],
  phone: [field("role", "Tipo do celular", "select", false, ["Principal", "Clone", "Indeterminado"]), field("numbers", "Número(s)", "text", false, [], "Separe mais de um número por vírgula"), field("states", "Estados vinculados ao principal", "multistate"), field("model", "Modelo"), field("imei", "IMEI"), field("chip", "Chip/Operadora"), field("status", "Status", "select", false, ["Em uso", "Reserva", "Manutenção", "Devolvido"])],
  office: [field("proprietor", "Proprietário do Office", "text", false), field("users", "Users vinculados", "text", false, [], "Ex.: usuario1, usuario2"), field("cardLastDigits", "Final do cartão", "text", false), field("cardOwner", "Proprietário do cartão", "text", false), field("accountEmail", "Conta Microsoft", "email"), field("plan", "Plano", "select", false, ["Microsoft 365 Family", "Microsoft 365 Personal", "Outro"]), field("renewal", "Renovação", "date")],
  wifi: [field("ssid", "Nome da rede / SSID", "text", false), field("password", "Senha da rede", "password", false), field("security", "Segurança", "select", false, ["WPA2", "WPA3", "WPA/WPA2", "Aberta", "Outro"]), field("kind", "Tipo", "select", false, ["Corporativa", "Visitantes", "Equipamentos", "Outro"]), field("location", "Local")],
  item: [field("category", "Categoria", "select", false, ["Acesso", "Documento", "Chave", "Equipamento", "Outro"]), field("identifier", "Identificação"), field("status", "Status", "select", false, ["Ativo", "Pendente", "Arquivado", "Devolvido"])]
};
const primary = { person: "username", email: "address", sheet: "purpose", notebook: "username", phone: "numbers", office: "proprietor", wifi: "ssid", item: "identifier" };
let records = loadRecords();
let searchTerm = "";
let currentAttachments = [];
const modal = document.querySelector("#entryModal");
const form = document.querySelector("#entryForm");
const dynamicFields = document.querySelector("#dynamicFields");
const fields = { id: document.querySelector("#recordId"), type: document.querySelector("#recordType"), name: document.querySelector("#recordName"), department: document.querySelector("#recordDepartment"), owner: document.querySelector("#recordOwner"), tags: document.querySelector("#recordTags"), notes: document.querySelector("#recordNotes") };
const ownerWrap = document.querySelector('[data-common="owner"]');
ensureAttachmentsPanel();
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll(".quick-add").forEach((button) => button.addEventListener("click", () => openModal({ type: button.dataset.type })));
document.querySelector("#openEntryModal").addEventListener("click", () => openModal({ type: "person" }));
document.querySelector("#deleteRecord").addEventListener("click", deleteCurrentRecord);
document.querySelector("#closeEntryModal").addEventListener("click", () => modal.close());
document.querySelector("#cancelEntryModal").addEventListener("click", () => modal.close());
document.querySelector("#globalSearch").addEventListener("input", (event) => { searchTerm = event.target.value.trim().toLowerCase(); render(); });
document.querySelector("#exportJson").addEventListener("click", exportJson);
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#exportExcel")?.addEventListener("click", exportExcel);
document.querySelector("#exportPdf")?.addEventListener("click", exportPdfReport);
document.querySelector("#importJson").addEventListener("change", importJson);
fields.type.addEventListener("change", () => prepareForm(fields.type.value));
dynamicFields.addEventListener("change", (event) => { if (event.target?.dataset?.detail === "role") updateOwnerOptions(); });
form.addEventListener("submit", async (event) => { event.preventDefault(); await saveRecord(); });
render();
function field(key, label, type = "text", required = false, options = [], placeholder = "") { return { key, label, type, required, options, placeholder }; }
function makeRecord(record) { return { id: record.id || crypto.randomUUID(), type: record.type, name: record.name || "Sem nome", department: record.department || "", ownerId: record.ownerId || "", details: record.details || {}, attachments: Array.isArray(record.attachments) ? record.attachments : [], tags: Array.isArray(record.tags) ? record.tags : [], notes: record.notes || "", createdAt: record.createdAt || new Date().toISOString() }; }
function sampleData() { const person = crypto.randomUUID(); return [makeRecord({ id: person, type: "person", name: "Ana Souza", department: "Financeiro", details: { function: "Financeiro", states: "SP, RJ", username: "ana.souza", email: "ana@empresa.com", phone: "", status: "Ativo" }, tags: ["contas", "pagamentos"], notes: "Responsável por pagamentos, boletos e conferência mensal." }), makeRecord({ type: "email", name: "E-mail principal Ana", department: "Financeiro", ownerId: person, details: { address: "ana@empresa.com", kind: "Individual", purpose: "contato principal" } }), makeRecord({ type: "email", name: "Financeiro compartilhado", department: "Financeiro", ownerId: person, details: { address: "financeiro@empresa.com", kind: "Compartilhado", purpose: "notas, cobranças e comprovantes" } }), makeRecord({ type: "notebook", name: "Notebook Ana Souza", department: "Financeiro", ownerId: person, details: { username: "ana.souza", model: "Dell Latitude", serial: "", patrimony: "NB-001", status: "Em uso" } })]; }
function loadRecords() { const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean); if (!stored) { const data = sampleData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return data; } try { const data = JSON.parse(stored); if (!Array.isArray(data)) throw new Error("invalid data"); const normalized = data.map(normalizeRecord); localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); return normalized; } catch { return sampleData(); } }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function setView(view) { document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view)); document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active-view", section.id === view)); document.querySelector("#viewTitle").textContent = viewTitles[view]; render(); }
function render() { updateOwnerOptions(); renderCounts(); renderRecent(); renderOwners(); types.forEach(renderCards); renderMap(); }
function renderCounts() { setText("#peopleCount", count("person")); setText("#emailCount", count("email")); setText("#sheetCount", count("sheet")); setText("#notebookCount", count("notebook")); setText("#phoneCount", count("phone")); setText("#officeCount", count("office")); setText("#wifiCount", count("wifi")); setText("#itemCount", count("item")); }
function count(type) { return records.filter((record) => record.type === type).length; }
function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
function filteredRecords(type) { return records.filter((record) => !type || record.type === type).filter((record) => { if (!searchTerm) return true; const haystack = [record.name, record.department, record.notes, getOwner(record)?.name, record.tags?.join(" "), record.attachments?.map((file) => file.name).join(" "), ...Object.values(record.details || {})].join(" ").toLowerCase(); return haystack.includes(searchTerm); }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); }
function renderRecent() { const recent = [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6); document.querySelector("#recentList").innerHTML = recent.length ? recent.map(recordRow).join("") : emptyState("Nenhum registro ainda."); }
function renderOwners() { const people = records.filter((record) => record.type === "person").map((person) => ({ ...person, count: linkedRecords(person.id).length })).sort((a, b) => b.count - a.count).slice(0, 6); document.querySelector("#ownerList").innerHTML = people.length ? people.map((person) => recordRow(person, person.count + " vínculo(s)")).join("") : emptyState("Cadastre funcionários para ver responsáveis."); }
function renderCards(type) { const target = document.querySelector("#" + listTargets[type]); if (!target) return; const list = filteredRecords(type); target.innerHTML = list.length ? list.map(cardTemplate).join("") : emptyState("Nenhum " + typeLabels[type].toLowerCase() + " encontrado."); target.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openModal(records.find((record) => record.id === button.dataset.edit)))); target.querySelectorAll("[data-toggle-secret]").forEach((button) => button.addEventListener("click", toggleSecret)); }
function renderMap() { const people = filteredRecords("person"); const target = document.querySelector("#relationshipMap"); if (!people.length) { target.innerHTML = emptyState("Cadastre funcionários para montar o mapa."); return; } target.innerHTML = people.map((person) => { const linked = linkedRecords(person.id); return '<article class="map-owner"><div class="map-owner-heading"><div><h4>' + escapeHtml(person.name) + '</h4><p>' + escapeHtml([person.details?.function, person.department, person.details?.username].filter(Boolean).join(" · ")) + '</p></div><span class="badge">' + linked.length + ' vínculo(s)</span></div><div class="map-links">' + mapColumn("Notebooks", linked.filter((record) => record.type === "notebook")) + mapColumn("Celulares", linked.filter((record) => record.type === "phone")) + mapColumn("Office Family", linked.filter((record) => record.type === "office")) + mapColumn("E-mails", linked.filter((record) => record.type === "email")) + mapColumn("Planilhas", linked.filter((record) => record.type === "sheet")) + '</div></article>'; }).join(""); }
function mapColumn(title, list) { const content = list.length ? list.map((record) => '<div>' + escapeHtml(record.name) + (primaryValue(record) ? '<small>' + escapeHtml(primaryValue(record)) + '</small>' : '') + '</div>').join("") : '<div>Nenhum vínculo</div>'; return '<section class="map-column"><strong>' + escapeHtml(title) + '</strong>' + content + '</section>'; }
function cardTemplate(record) { const owner = getOwner(record); const tags = (record.tags || []).map((tag) => '<span class="tag">' + escapeHtml(tag) + '</span>').join(""); return '<article class="card"><div class="card-header"><div><h4>' + escapeHtml(record.name) + '</h4><p>' + escapeHtml(typeLabels[record.type]) + (record.department ? ' · ' + escapeHtml(record.department) : '') + '</p></div><span class="badge">' + escapeHtml(typeLabels[record.type]) + '</span></div><div class="card-meta">' + (owner ? '<p><strong>Funcionário:</strong> ' + escapeHtml(owner.name) + '</p>' : '') + cardDetails(record) + attachmentLinks(record) + (record.notes ? '<p>' + escapeHtml(record.notes) + '</p>' : '') + '</div>' + (tags ? '<div class="tag-list">' + tags + '</div>' : '') + '<div class="card-actions"><button class="text-btn" data-edit="' + record.id + '">Editar</button></div></article>'; }
function cardDetails(record) { return (schemas[record.type] || []).filter((item) => record.details?.[item.key]).slice(0, 7).map((item) => '<p><strong>' + escapeHtml(item.label) + ':</strong> ' + formatDetail(record.details[item.key], item) + '</p>').join(""); }
function formatDetail(value, schema) { const safe = escapeHtml(value); if (protectedDetailKeys.includes(schema.key)) return '<span class="secret-value" data-secret="' + safe + '">••••••••</span> <button type="button" class="inline-btn" data-toggle-secret>Mostrar</button>'; if (schema.type === "url" && /^https?:\/\//i.test(value)) return '<a href="' + safe + '" target="_blank" rel="noreferrer">' + safe + '</a>'; if (schema.type === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '<a href="mailto:' + safe + '">' + safe + '</a>'; return safe; }
function attachmentLinks(record) { if (!record.attachments?.length) return ""; return '<div class="attachment-list"><strong>Anexos:</strong>' + record.attachments.map((file) => '<a href="' + escapeHtml(file.dataUrl) + '" download="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</a>').join("") + '</div>'; }
function toggleSecret(event) { const value = event.currentTarget.previousElementSibling; if (!value) return; const visible = value.dataset.visible === "true"; if (!visible) { const typed = prompt("Digite a senha mestra para revelar este dado:"); if (typed !== MASTER_PASSWORD) { alert("Senha incorreta."); return; } } value.textContent = visible ? "••••••••" : value.dataset.secret; value.dataset.visible = visible ? "false" : "true"; event.currentTarget.textContent = visible ? "Mostrar" : "Ocultar"; }
function recordRow(record, detail) { const subtitle = detail || [typeLabels[record.type], record.department, primaryValue(record)].filter(Boolean).join(" · "); return '<div class="record-row"><div><strong>' + escapeHtml(record.name) + '</strong><span>' + escapeHtml(subtitle) + '</span></div><span class="badge">' + escapeHtml(typeLabels[record.type]) + '</span></div>'; }
function emptyState(text) { return '<div class="empty-state">' + escapeHtml(text) + '</div>'; }
function getOwner(record) { return records.find((item) => item.id === record.ownerId && item.type === "person"); }
function linkedRecords(personId) { return records.filter((record) => record.ownerId === personId); }
function updateOwnerOptions() { const people = records.filter((record) => record.type === "person").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); const current = fields.owner.value; fields.owner.innerHTML = '<option value="">Sem funcionário vinculado</option>' + people.map((person) => '<option value="' + person.id + '">' + escapeHtml(person.name) + (person.details?.username ? ' (' + escapeHtml(person.details.username) + ')' : '') + '</option>').join(""); fields.owner.value = people.some((person) => person.id === current) ? current : ""; const role = dynamicFields.querySelector('[data-detail="role"]')?.value || ""; const hideOwner = unassignedTypes.includes(fields.type.value) || (fields.type.value === "phone" && role === "Principal"); fields.owner.disabled = hideOwner; ownerWrap.classList.toggle("hidden", hideOwner); }
function prepareForm(type, details = {}) { renderDynamicFields(type, details); updateOwnerOptions(); const placeholders = { person: "Ex.: Ana Souza", email: "Ex.: Financeiro compartilhado", sheet: "Ex.: Controle de contas", notebook: "Ex.: Notebook Ana Souza", phone: "Ex.: Celular Ana Souza", office: "Ex.: Office Family Financeiro", wifi: "Ex.: Wi-Fi Escritório", item: "Ex.: Chave do arquivo fiscal" }; fields.name.placeholder = placeholders[type] || "Nome do registro"; fields.department.placeholder = type === "person" ? "Ex.: Financeiro" : "Área relacionada"; }
function renderDynamicFields(type, details = {}) { dynamicFields.innerHTML = (schemas[type] || []).map((schema) => fieldTemplate(schema, details[schema.key] || "")).join(""); }
function fieldTemplate(schema, value) { const required = schema.required ? " required" : ""; if (schema.type === "select") return '<label><span>' + escapeHtml(schema.label) + (schema.required ? ' *' : '') + '</span><select data-detail="' + schema.key + '"' + required + '><option value="">Selecione</option>' + schema.options.map((option) => '<option value="' + escapeHtml(option) + '"' + (option === value ? ' selected' : '') + '>' + escapeHtml(option) + '</option>').join("") + '</select></label>'; if (schema.type === "multistate") { const selected = splitList(value); return '<fieldset class="state-field" data-detail="' + schema.key + '"><legend>' + escapeHtml(schema.label) + (schema.required ? ' *' : '') + '</legend><div class="state-grid">' + brazilStates.map((state) => '<label><input type="checkbox" value="' + state + '"' + (selected.includes(state) ? ' checked' : '') + ' />' + state + '</label>').join("") + '</div></fieldset>'; } const placeholder = schema.placeholder ? ' placeholder="' + escapeHtml(schema.placeholder) + '"' : ''; return '<label><span>' + escapeHtml(schema.label) + (schema.required ? ' *' : '') + '</span><input data-detail="' + schema.key + '" type="' + schema.type + '" value="' + escapeHtml(value) + '"' + placeholder + required + ' /></label>'; }
function ensureAttachmentsPanel() { if (document.querySelector("#attachmentsPanel")) return; const panel = document.createElement("div"); panel.id = "attachmentsPanel"; panel.className = "attachments-panel wide"; panel.innerHTML = '<label><span>Anexos</span><input id="recordAttachments" type="file" multiple /></label><div id="existingAttachments" class="attachment-list"></div><p class="field-hint">Use para termo de responsabilidade, nota fiscal, print, contrato, comprovante ou foto do patrimônio.</p>'; dynamicFields.insertAdjacentElement("afterend", panel); }
function renderAttachmentsPanel(record = {}) { currentAttachments = Array.isArray(record.attachments) ? [...record.attachments] : []; const input = document.querySelector("#recordAttachments"); if (input) input.value = ""; renderExistingAttachments(); }
function renderExistingAttachments() { const target = document.querySelector("#existingAttachments"); if (!target) return; target.innerHTML = currentAttachments.length ? '<strong>Anexos salvos:</strong>' + currentAttachments.map((file, index) => '<span class="attachment-chip"><a href="' + escapeHtml(file.dataUrl) + '" download="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</a><button type="button" data-remove-attachment="' + index + '">Remover</button></span>').join("") : '<span>Nenhum anexo salvo.</span>'; target.querySelectorAll("[data-remove-attachment]").forEach((button) => { button.addEventListener("click", () => { currentAttachments.splice(Number(button.dataset.removeAttachment), 1); renderExistingAttachments(); }); }); }
function renderPersonLinks(record = {}) { document.querySelector("#personLinksPanel")?.remove(); if (record.type !== "person" || !record.id) return; const linked = linkedRecords(record.id); const panel = document.createElement("section"); panel.id = "personLinksPanel"; panel.className = "person-links-panel wide"; panel.innerHTML = '<h4>Vínculos do funcionário</h4>' + (linked.length ? types.filter((type) => type !== "person" && !["wifi", "item"].includes(type)).map((type) => personLinkGroup(type, linked.filter((item) => item.type === type))).join("") : '<p>Nenhum vínculo cadastrado para este funcionário.</p>'); document.querySelector("#attachmentsPanel").insertAdjacentElement("afterend", panel); }
function personLinkGroup(type, list) { if (!list.length) return ""; return '<div class="person-link-group"><strong>' + escapeHtml(typeLabels[type]) + '</strong>' + list.map((record) => '<span>' + escapeHtml(record.name) + (primaryValue(record) ? ' · ' + escapeHtml(primaryValue(record)) : '') + '</span>').join("") + '</div>'; }
function openModal(record = {}) { const isEditing = Boolean(record.id); const type = record.type || "person"; document.querySelector("#modalTitle").textContent = isEditing ? "Editar registro" : "Novo registro"; document.querySelector("#deleteRecord").classList.toggle("hidden", !isEditing); fields.id.value = record.id || ""; fields.type.value = type; fields.name.value = record.name || ""; fields.department.value = record.department || ""; fields.tags.value = (record.tags || []).join(", "); fields.notes.value = record.notes || ""; prepareForm(type, record.details || {}); fields.owner.value = record.ownerId || ""; renderAttachmentsPanel(record); renderPersonLinks(record); modal.showModal(); fields.name.focus(); }
async function saveRecord() { const id = fields.id.value || crypto.randomUUID(); const type = fields.type.value; const details = collectDetails(); const attachments = [...currentAttachments, ...(await readAttachmentFiles())]; const next = makeRecord({ id, type, name: fields.name.value.trim(), department: fields.department.value.trim(), ownerId: getOwnerIdForSave(type, details), details, attachments, tags: fields.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean), notes: fields.notes.value.trim(), createdAt: records.find((record) => record.id === id)?.createdAt }); records = records.some((record) => record.id === id) ? records.map((record) => record.id === id ? next : record) : [next, ...records]; syncNotebookUsername(next); persist(); modal.close(); render(); }
function collectDetails() { const data = {}; dynamicFields.querySelectorAll("[data-detail]").forEach((input) => { if (input.classList.contains("state-field")) data[input.dataset.detail] = [...input.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => checkbox.value).join(", "); else data[input.dataset.detail] = input.value.trim(); }); return data; }
async function readAttachmentFiles() { const input = document.querySelector("#recordAttachments"); if (!input?.files?.length) return []; return Promise.all([...input.files].map((file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, dataUrl: reader.result }); reader.onerror = reject; reader.readAsDataURL(file); }))); }
function getOwnerIdForSave(type, details) { if (unassignedTypes.includes(type)) return ""; if (type === "phone" && details.role === "Principal") return ""; return fields.owner.value; }
function syncNotebookUsername(record) { if (record.type !== "notebook" || !record.ownerId || !record.details?.username) return; records = records.map((item) => item.id === record.ownerId && item.type === "person" ? { ...item, details: { ...(item.details || {}), username: record.details.username } } : item); }
function deleteCurrentRecord() { const id = fields.id.value; if (!id) return; const record = records.find((item) => item.id === id); if (!confirm('Excluir "' + (record?.name || "registro") + '"?')) return; records = records.filter((item) => item.id !== id).map((item) => item.ownerId === id ? { ...item, ownerId: "" } : item); persist(); modal.close(); render(); }
function exportJson() { downloadFile('mapa-escritorio-' + dateStamp() + '.json', JSON.stringify(records, null, 2), "application/json"); }
function exportCsv() { const header = ["tipo", "nome", "setor", "funcionario_vinculado", "campo_principal", "detalhes", "anexos", "tags", "observacoes"]; const rows = records.map((record) => [typeLabels[record.type], record.name, record.department, getOwner(record)?.name || "", primaryValue(record), detailsSummary(record), (record.attachments || []).map((file) => file.name).join("; "), (record.tags || []).join("; "), record.notes]); const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"); downloadFile('mapa-escritorio-' + dateStamp() + '.csv', csv, "text/csv;charset=utf-8"); }

function exportExcel() {
  const workbookSheets = [
    excelSheet("Funcionarios", "person"),
    excelSheet("Notebooks", "notebook"),
    excelSheet("Celulares", "phone"),
    excelSheet("Office", "office"),
    excelSheet("WiFi", "wifi"),
    excelSheet("Planilhas", "sheet"),
  ];
  const files = buildXlsxFiles(workbookSheets);
  const blob = new Blob([zipFiles(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mapa-escritorio-" + dateStamp() + ".xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
function excelSheet(name, type) {
  const schema = schemas[type] || [];
  const headers = ["Nome", "Setor", "Funcionário vinculado", ...schema.map((item) => item.label), "Anexos", "Tags", "Observações"];
  const rows = records.filter((record) => record.type === type).map((record) => [record.name, record.department, getOwner(record)?.name || "", ...schema.map((item) => record.details?.[item.key] || ""), (record.attachments || []).map((file) => file.name).join("; "), (record.tags || []).join("; "), record.notes]);
  return { name, rows: [headers, ...rows] };
}
function buildXlsxFiles(workbookSheets) {
  const sheetRefs = workbookSheets.map((sheet, index) => ({ ...sheet, id: index + 1 }));
  return [
    { name: "[Content_Types].xml", text: contentTypesXml(sheetRefs.length) },
    { name: "_rels/.rels", text: relsXml() },
    { name: "xl/workbook.xml", text: workbookXml(sheetRefs) },
    { name: "xl/_rels/workbook.xml.rels", text: workbookRelsXml(sheetRefs) },
    ...sheetRefs.map((sheet) => ({ name: "xl/worksheets/sheet" + sheet.id + ".xml", text: worksheetXml(sheet.rows) })),
  ];
}
function contentTypesXml(count) {
  let overrides = '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  for (let i = 1; i <= count; i++) overrides += '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  return '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + overrides + '</Types>';
}
function relsXml() {
  return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
}
function workbookXml(sheets) {
  return '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((sheet) => '<sheet name="' + xmlEscape(sheet.name) + '" sheetId="' + sheet.id + '" r:id="rId' + sheet.id + '"/>').join("") + '</sheets></workbook>';
}
function workbookRelsXml(sheets) {
  return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((sheet) => '<Relationship Id="rId' + sheet.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + sheet.id + '.xml"/>').join("") + '</Relationships>';
}
function worksheetXml(rows) {
  return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.map((row, rowIndex) => '<row r="' + (rowIndex + 1) + '">' + row.map((cell, colIndex) => '<c r="' + columnName(colIndex + 1) + (rowIndex + 1) + '" t="inlineStr"><is><t>' + xmlEscape(cell) + '</t></is></c>').join("") + '</row>').join("") + '</sheetData></worksheet>';
}
function columnName(number) {
  let name = "";
  while (number > 0) {
    const mod = (number - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    number = Math.floor((number - mod) / 26);
  }
  return name;
}
function zipFiles(files) {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({ name: file.name, bytes: encoder.encode(file.text), crc: 0 }));
  entries.forEach((entry) => entry.crc = crc32(entry.bytes));
  const parts = [];
  const central = [];
  let offset = 0;
  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const local = zipHeader(0x04034b50, entry, nameBytes, offset);
    parts.push(local, entry.bytes);
    central.push(zipHeader(0x02014b50, entry, nameBytes, offset));
    offset += local.length + entry.bytes.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = endOfCentralDirectory(entries.length, centralSize, offset);
  return new Blob([...parts, ...central, end]);
}
function zipHeader(signature, entry, nameBytes, offset) {
  const isCentral = signature === 0x02014b50;
  const size = isCentral ? 46 : 30;
  const buffer = new ArrayBuffer(size + nameBytes.length);
  const view = new DataView(buffer);
  let p = 0;
  view.setUint32(p, signature, true); p += 4;
  if (isCentral) { view.setUint16(p, 20, true); p += 2; }
  view.setUint16(p, 20, true); p += 2;
  view.setUint16(p, 0x0800, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint32(p, entry.crc, true); p += 4;
  view.setUint32(p, entry.bytes.length, true); p += 4;
  view.setUint32(p, entry.bytes.length, true); p += 4;
  view.setUint16(p, nameBytes.length, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  if (isCentral) {
    view.setUint16(p, 0, true); p += 2;
    view.setUint16(p, 0, true); p += 2;
    view.setUint16(p, 0, true); p += 2;
    view.setUint32(p, 0, true); p += 4;
    view.setUint32(p, offset, true); p += 4;
  }
  new Uint8Array(buffer, p).set(nameBytes);
  return new Uint8Array(buffer);
}
function endOfCentralDirectory(count, centralSize, centralOffset) {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return new Uint8Array(buffer);
}
function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
function xmlEscape(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function exportPdfReport() { const win = window.open("", "_blank"); if (!win) { alert("Permita pop-ups para gerar o relatório em PDF."); return; } win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de mapeamento</title><style>body{font-family:Arial,sans-serif;color:#17231f;margin:32px}h1{margin:0 0 4px;font-size:26px}h2{margin:28px 0 10px;font-size:18px;border-bottom:1px solid #d9dfd7;padding-bottom:6px}p{margin:0 0 16px;color:#59665f}table{width:100%;border-collapse:collapse;margin-bottom:18px}th,td{border:1px solid #d9dfd7;padding:8px;text-align:left;vertical-align:top;font-size:12px}th{background:#eef2ec}@media print{body{margin:18mm}button{display:none}}</style></head><body><button onclick="window.print()">Salvar como PDF</button><h1>Relatório de mapeamento</h1><p>Gerado em ' + escapeHtml(new Date().toLocaleString("pt-BR")) + '</p>' + reportSection("Funcionários", "person") + reportSection("Notebooks", "notebook") + reportSection("Celulares", "phone") + reportSection("Pacotes Office Family", "office") + reportSection("Redes Wi-Fi", "wifi") + reportSection("E-mails", "email") + reportSection("Planilhas", "sheet") + reportSection("Itens gerais", "item") + '<script>setTimeout(function(){window.print()},300)<\/script></body></html>'); win.document.close(); }
function reportSection(title, type) { const list = records.filter((record) => record.type === type); if (!list.length) return '<h2>' + escapeHtml(title) + '</h2><p>Nenhum registro.</p>'; return '<h2>' + escapeHtml(title) + '</h2><table><thead><tr><th>Nome</th><th>Setor</th><th>Funcionário vinculado</th><th>Detalhes</th><th>Anexos</th><th>Observações</th></tr></thead><tbody>' + list.map((record) => '<tr><td>' + escapeHtml(record.name) + '</td><td>' + escapeHtml(record.department) + '</td><td>' + escapeHtml(getOwner(record)?.name || "") + '</td><td>' + escapeHtml(detailsSummary(record)) + '</td><td>' + escapeHtml((record.attachments || []).map((file) => file.name).join("; ")) + '</td><td>' + escapeHtml(record.notes) + '</td></tr>').join("") + '</tbody></table>'; }
function importJson(event) { const [file] = event.target.files; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported)) throw new Error("invalid import"); records = imported.map(normalizeRecord); persist(); render(); alert("Backup importado com sucesso."); } catch { alert("Não foi possível importar esse arquivo."); } finally { event.target.value = ""; } }; reader.readAsText(file); }
function normalizeRecord(record) { const type = types.includes(record.type) ? record.type : "item"; const details = record.details && typeof record.details === "object" ? record.details : legacyDetails(record, type); return makeRecord({ ...record, type, details }); }
function legacyDetails(record, type) { const ref = record.reference || ""; if (type === "email") return { address: ref }; if (type === "sheet") return { purpose: ref }; if (type === "person") return { username: "", email: ref, function: employeeFunctions.includes(record.department) ? record.department : "" }; return { identifier: ref }; }
function splitList(value = "") { return String(value).split(",").map((item) => item.trim()).filter(Boolean); }
function primaryValue(record) { return record.details?.[primary[record.type]] || ""; }
function detailsSummary(record) { return (schemas[record.type] || []).filter((item) => record.details?.[item.key]).map((item) => item.label + ": " + record.details[item.key]).join("; "); }
function downloadFile(filename, content, mimeType) { const blob = new Blob([content], { type: mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function dateStamp() { return new Date().toISOString().slice(0, 10); }
function csvCell(value) { return '"' + String(value || "").replaceAll('"', '""') + '"'; }
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }