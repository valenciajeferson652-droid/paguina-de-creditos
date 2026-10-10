const ACCOUNTS_KEY = "mi_credito_cuentas_v1";
const SESSION_KEY = "mi_credito_sesion_v1";
const legacyKey = "clientes_creditos_v2";
let currentUser = null, KEY = "", clientes = [], clienteActivo = null, clienteEditando = null;
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const esc = t => String(t ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) };
const formatDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatLongDate = (date = new Date()) => date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const getAccounts = () => JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
const setAccounts = a => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
const normalizeUser = u => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const metaKey = () => KEY + "_meta";
function getMeta() { const raw = localStorage.getItem(metaKey()); let m; try { m = JSON.parse(raw) || {} } catch { m = {} }; m.portfolios = Array.isArray(m.portfolios) && m.portfolios.length ? m.portfolios : ["yeison"]; m.activePortfolio = m.activePortfolio && m.portfolios.includes(m.activePortfolio) ? m.activePortfolio : m.portfolios[0]; m.expenses = Array.isArray(m.expenses) ? m.expenses : []; m.incomes = Array.isArray(m.incomes) ? m.incomes : []; return m }
function saveMeta(m) { localStorage.setItem(metaKey(), JSON.stringify(m)) }
// El periodo de prueba se inicia la primera vez que se abre la cuenta en este dispositivo.
function actualizarEstadoPlan() {
  if (!currentUser) return;
  const m = getMeta();
  if (!m.trialStart) { m.trialStart = todayISO(); saveMeta(m); }
  const start = new Date(m.trialStart + "T00:00:00");
  const today = new Date(todayISO() + "T00:00:00");
  const elapsed = Math.max(0, Math.floor((today - start) / 86400000));
  const remaining = Math.max(1, 30 - elapsed);
  const badge = $("homeStatus");
  if (badge) badge.textContent = `Activo por ${remaining} ${remaining === 1 ? "día" : "días"}`;
  if (remaining === 1 && m.lastPaymentNoticeDate !== todayISO()) {
    alert("Tu periodo activo llegó a 1 día. Debes pagar para continuar usando Mi Crédito.");
    m.lastPaymentNoticeDate = todayISO(); saveMeta(m);
  }
}
function save() { if (currentUser) localStorage.setItem(KEY, JSON.stringify(clientes)); }
function getActivePortfolio() { return getMeta().activePortfolio }
async function hashPassword(value) { if (window.crypto?.subtle) { const data = new TextEncoder().encode(value), buf = await crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("") } return btoa(unescape(encodeURIComponent(value))) }
function setAuthMessage(msg, ok = false) { const el = $("authMessage"); if (el) { el.textContent = msg; el.style.color = ok ? "#159567" : "#b5222b" } }
function mostrarRegistro() { $("loginForm").style.display = "none"; $('registerForm').style.display = "grid"; $('authSubtitle').textContent = "Crea tu cuenta personal para guardar tu cartera."; setAuthMessage("") }
function mostrarLogin() { $('registerForm').style.display = "none"; $('loginForm').style.display = "grid"; $('authSubtitle').textContent = "Inicia sesión para entrar a tu cartera."; setAuthMessage("") }
function accountKey(user) { return `clientes_creditos_${user.id}` }
function cargarCuenta(user) {
  currentUser = user; KEY = accountKey(user); clientes = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!clientes.length && localStorage.getItem(legacyKey) && getAccounts().length === 1) { try { clientes = JSON.parse(localStorage.getItem(legacyKey)) || []; clientes.forEach(c => { c.cartera = c.cartera || "yeison"; c.historial = c.historial || [] }); save(); localStorage.removeItem(legacyKey) } catch { } }
  const m = getMeta(); if (!m.portfolios.includes("yeison")) m.portfolios.unshift("yeison"); saveMeta(m); document.body.classList.add("authenticated"); actualizarUsuarioUI(); actualizarCarteraUI(); render(); preview(); actualizarInicio(); actualizarEstadoPlan();
}
function actualizarUsuarioUI() { const badge = document.querySelector('.admin-badge'), name = document.querySelector('.admin-user'); if (badge) badge.textContent = currentUser?.name || "Administrador"; if (name) name.textContent = currentUser?.username || "" }
function actualizarCarteraUI() { const m = getMeta(); const btn = document.querySelector('.portfolio-select b'); if (btn) btn.textContent = m.activePortfolio; const tile = document.querySelector('.home-grid .home-tile b'); if (tile) tile.textContent = m.activePortfolio }
function iniciarSesion() { const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); if (!session) return false; const user = getAccounts().find(a => a.id === session.userId); if (!user) { localStorage.removeItem(SESSION_KEY); return false } cargarCuenta(user); return true }
async function handleLogin(e) { e.preventDefault(); const username = normalizeUser($('loginUser').value), pass = $('loginPass').value, account = getAccounts().find(a => a.username === username); if (!account) return setAuthMessage("Usuario o contraseña incorrectos."); if (await hashPassword(pass) !== account.passwordHash) return setAuthMessage("Usuario o contraseña incorrectos."); localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: account.id })); $('loginForm').reset(); cargarCuenta(account) }
async function handleRegister(e) { e.preventDefault(); const name = $('registerName').value.trim(), username = normalizeUser($('registerUser').value), pass = $('registerPass').value, pass2 = $('registerPass2').value; if (!name || username.length < 3) return setAuthMessage("Escribe un nombre y un usuario válido."); if (pass.length < 6) return setAuthMessage("La contraseña debe tener mínimo 6 caracteres."); if (pass !== pass2) return setAuthMessage("Las contraseñas no coinciden."); const accounts = getAccounts(); if (accounts.some(a => a.username === username)) return setAuthMessage("Ese usuario ya existe."); const account = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name, username, passwordHash: await hashPassword(pass), createdAt: new Date().toISOString() }; accounts.push(account); setAccounts(accounts); localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: account.id })); $('registerForm').reset(); cargarCuenta(account) }
function cerrarSesion() { if (!confirm("¿Quieres cerrar sesión?")) return; localStorage.removeItem(SESSION_KEY); currentUser = null; KEY = ""; clientes = []; document.body.classList.remove("authenticated", "showing-clients"); hide("menuModal"); mostrarLogin() }
function calc(prestamo, interes, cuotas) { const interesValor = prestamo * interes / 100, total = prestamo + interesValor; return { interesValor, total, cuota: cuotas ? total / cuotas : 0 } }
function addPeriod(date, frequency, n) { const d = new Date(date + "T12:00:00"); if (frequency === "Diario") d.setDate(d.getDate() + n); else if (frequency === "Semanal") d.setDate(d.getDate() + n * 7); else if (frequency === "Quincenal") d.setDate(d.getDate() + n * 15); else d.setMonth(d.getMonth() + n); return d }
function daysLeft(date) { return Math.ceil((new Date(date + "T23:59:59") - new Date()) / 86400000) }
function daysText(date) { const diff = daysLeft(date); if (diff < 0) return `Venció hace ${Math.abs(diff)} días`; if (diff === 0) return "Vence hoy"; if (diff === 1) return "Vence mañana"; return `Vence en ${diff} días` }
function paymentCount(c) { return Math.min(c.cuotas, Math.floor((Number(c.pagado || 0) + 0.0001) / (Number(c.cuota) || 1))) }
function preview() { const r = calc(+$('prestamo').value || 0, +$('interes').value || 0, +$('cuotas').value || 0); $('previewTotal').textContent = money(r.total); $('previewCuota').textContent = money(r.cuota) }
["prestamo", "interes", "cuotas"].forEach(id => $(id)?.addEventListener("input", preview));
$('fechaInicio').value = todayISO(); $('cuotas').value = 24; $('frecuencia').value = 'Diario';
$('clienteForm').addEventListener('submit', e => { e.preventDefault(); const nombre = $('nombre').value.trim(), telefono = $('telefono').value.replace(/\D/g, ""), direccion = $('direccion').value.trim(), prestamo = +$('prestamo').value, interes = +$('interes').value, cuotas = +$('cuotas').value, frecuencia = $('frecuencia').value, fechaInicio = $('fechaInicio').value || todayISO(); if (!nombre || telefono.length < 7 || prestamo <= 0 || interes < 0 || cuotas < 1) return alert("Completa correctamente los datos del cliente."); const r = calc(prestamo, interes, cuotas), vencimiento = addPeriod(fechaInicio, frecuencia, cuotas).toISOString().slice(0, 10); const c = { id: Date.now(), numero: clientes.length ? Math.max(...clientes.map(c => c.numero || 0)) + 1 : 1, nombre, telefono, direccion, prestamo, interes, cuotas, frecuencia, fechaInicio, vencimiento, total: r.total, cuota: r.cuota, pagado: 0, cartera: getActivePortfolio(), historial: [{ tipo: 'prestamo', fecha: new Date().toISOString(), valor: prestamo }] }; clientes.push(c); save(); e.target.reset(); $('fechaInicio').value = todayISO(); $('cuotas').value = 24; $('frecuencia').value = 'Diario'; preview(); cerrarFormulario(); render(); actualizarInicio(); });
function render() { const f = $('buscar').value.toLowerCase().trim(), cartera = getActivePortfolio(); const lista = clientes.filter(c => (c.cartera || 'yeison') === cartera).filter(c => `${c.nombre} ${c.telefono} ${c.direccion}`.toLowerCase().includes(f)).sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0)); $('clientes').innerHTML = lista.map(cardList).join(''); $('sinClientes').style.display = lista.length ? 'none' : 'block'; actualizarInicio() }
function pagoHoy(c) { const hoy = todayISO(); return (c.historial || []).some(h => h.tipo === 'abono' && String(h.fecha).slice(0,10) === hoy && Number(h.valor || 0) > 0); }
function cardList(c) { const saldo = Math.max(c.total - c.pagado, 0), terminado = saldo <= 0, pagadoHoy = pagoHoy(c); return `<article class="client-row ${terminado ? 'completed' : ''}" onclick="abrirCliente(${c.id})"><div class="client-name">${c.numero || ''}) ${esc(c.nombre)}</div><div class="client-check ${pagadoHoy ? 'paid-today' : ''}">${pagadoHoy ? '✓' : '○'}</div>${terminado ? `<div class="client-pill">Crédito terminado · ${money(c.total)}</div><div class="client-due renewal-hint">Toca para renovar</div>` : `<div class="client-main">Credito ${money(c.prestamo)} Saldo ${money(saldo)}</div><div class="client-due">${daysText(c.vencimiento)}</div>`}<div class="client-address">${esc(c.direccion || '')}</div></article>` }
$('buscar').addEventListener('input', render); $('menuBtn').onclick = () => abrirMenu();
function abrirFormulario() { $('nuevoModal').classList.add('show'); $('nombre').focus() } function cerrarFormulario() { $('nuevoModal').classList.remove('show') }
function abrirCliente(id) { clienteActivo = id; const c = clientes.find(x => x.id === id); if (!c) return; renderCliente(c); show('clienteModal') }
function terminadoText(c) { const saldo = Math.max(c.total - c.pagado, 0); if (saldo <= 0) return "🟢 Crédito terminado · listo para renovar"; const d = daysLeft(c.vencimiento); return d < 0 ? `🔴 Venció hace ${Math.abs(d)} días` : `🟢 ${d} días para pagar` }
function renderCliente(c) { const saldo = Math.max(c.total - c.pagado, 0), pagadas = paymentCount(c), terminado = saldo <= 0; $('clienteCard').innerHTML = `<div class="card-head"><h2>${c.numero || ''}) ${esc(c.nombre)}</h2><div class="card-icons"><button type="button" class="contact-icon phone-icon" aria-label="Llamar a ${esc(c.nombre)}" title="Llamar" onclick="llamar(event,${c.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 11.2 18.8a19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.09 3.18 2 2 0 0 1 4.08 1h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.05 8.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.69A2 2 0 0 1 22 16.92z"/></svg></button><button type="button" class="contact-icon location-icon" aria-label="Ver ubicación de ${esc(c.nombre)}" title="Ubicación" onclick="ubicacion(event,${c.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></button><button type="button" class="contact-icon whatsapp-icon" aria-label="Abrir WhatsApp de ${esc(c.nombre)}" title="WhatsApp" onclick="whatsapp(event,${c.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z"/><path d="M8.5 7.8c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.9c.1.2.1.4-.1.6l-.6.7c-.2.2-.2.4 0 .6.6 1 1.4 1.7 2.4 2.2.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.2-.8 1.7-.6.5-1.3.7-2.1.5-1.1-.3-2.5-.9-3.9-2.2-1.1-1-2.1-2.5-2.4-3.5-.3-1 .1-1.9.6-2.5Z"/></svg></button></div></div><div class="card-body"><div class="card-top"><div class="quick-pay"><span>$</span><input class="amount-input" id="montoAbono" type="number" min="1" max="${Math.max(saldo, 1)}" value="${Math.min(Math.round(c.cuota), Math.max(saldo, 1))}" ${terminado ? 'disabled' : ''}></div><div class="card-buttons">${terminado ? `<button class="renew-btn" onclick="renovarCliente(event,${c.id})">Renovar</button>` : `<button class="green-btn" onclick="abrirPagoDesdeCard(event,${c.id})">Abonar</button><button class="red-btn" onclick="noPagoDesdeCard(event,${c.id})">No pago</button>`}</div></div><div class="info-grid"><div class="info-item"><span class="info-icon">$</span><span>Credito<small>${money(c.prestamo)}</small></span></div><div class="info-item"><span class="info-icon">$</span><span>Saldo<small>${money(saldo)}</small></span></div><div class="info-item"><span class="info-icon">◐</span><span>Interés<small>${c.interes}%</small></span></div><div class="info-item"><span class="info-icon">◆</span><span>${c.frecuencia} <small>${money(c.cuota)}</small></span></div><div class="info-item"><span class="info-icon">☑</span><span>Inicio<small>${formatDate(c.fechaInicio)}</small></span></div><div class="info-item"><span class="info-icon">☒</span><span>Vence<small>${formatDate(c.vencimiento)}</small></span></div><div class="info-item"><span class="info-icon">✓</span><span>Pagos<small>${pagadas}/${c.cuotas} · ${money(c.pagado)}</small></span></div><div class="info-item"><span class="info-icon">▣</span><span>Cartera<small>${esc(c.cartera || 'yeison')}</small></span></div></div><div class="due-status"><span class="dot ${saldo <= 0 ? 'done' : ''}"></span>${terminadoText(c)}</div>${c.telefono ? `<div class="phone-line">📱 ${esc(c.telefono)}</div>` : ''}<div class="card-actions"><button onclick="abrirHistorial(event,${c.id})">Historial</button><button onclick="editarCliente(event,${c.id})">Editar</button><button onclick="moverCliente(event,${c.id})">Mover</button><button class="round-menu" onclick="accionesCliente(event,${c.id})">⋮</button></div></div>` }
function abrirPagoDesdeCard(e, id) { e.stopPropagation(); clienteActivo = id; const c = clientes.find(x => x.id === id); if (!c || c.total - c.pagado <= 0) return; const input = $('valorPago'); input.value = Math.min(Math.round(c.cuota), Math.max(c.total - c.pagado, 1)); $('clientePago').textContent = `${c.nombre} · saldo ${money(c.total - c.pagado)}`; show('pagoModal'); setTimeout(() => input.focus(), 50) }
function noPagoDesdeCard(e, id) { e.stopPropagation(); registrarNoPagoDirecto(id); }
function cerrarPago() { hide('pagoModal') }
function registrarPago() { const c = clientes.find(x => x.id === clienteActivo), v = +$('valorPago').value; if (!c || v <= 0) return; if (v > c.total - c.pagado) return alert(`El abono no puede superar el saldo de ${money(c.total - c.pagado)}.`); c.pagado = Number(c.pagado || 0) + v; c.historial = c.historial || []; c.historial.push({ tipo: 'abono', fecha: new Date().toISOString(), valor: v }); save(); cerrarPago(); render(); renderCliente(c); window.ultimoAbono = v; mostrarExito(c, v) }
function registrarNoPagoDirecto(id) { const c = clientes.find(x => x.id === id); if (!c) return; c.historial = c.historial || []; c.historial.push({ tipo: 'no_pago', fecha: new Date().toISOString(), valor: 0 }); save(); render(); renderCliente(c); alert(`No pago registrado para ${c.nombre}.`) }
function construirMensajeAbono(c, v) { const saldo = Math.max(c.total - c.pagado, 0), pagadas = paymentCount(c); return `Abono Exitoso ✅\n\nHas abonado: ${money(v)}\nNombre: ${c.nombre}\nCredito: ${money(c.prestamo)}\nSaldo restante: ${money(saldo)}\nValor cuota: ${money(c.cuota)}\nCuotas Pagas: ${pagadas} / ${c.cuotas}\n${formatLongDate()}` }
function mostrarExito(c, v) { const saldo = Math.max(c.total - c.pagado, 0), pagadas = paymentCount(c); $('historialContenido').innerHTML = `<div class="success-receipt"><div class="success-title">Abono Exitoso <span>✓</span></div><div class="receipt-row"><strong>Has abonado</strong><span>${money(v)}</span></div><div class="receipt-row"><strong>Nombre</strong><span>${esc(c.nombre).slice(0, 22)}${c.nombre.length > 22 ? '...' : ''}</span></div><div class="receipt-row"><strong>Credito</strong><span>${money(c.prestamo)}</span></div><div class="receipt-row"><strong>Saldo restante</strong><span>${money(saldo)}</span></div><div class="receipt-row"><strong>Valor cuota</strong><span>${money(c.cuota)}</span></div><div class="receipt-row"><strong>Cuotas Pagas</strong><span>${pagadas} / ${c.cuotas}</span></div><div class="receipt-date">${formatLongDate()}</div><div class="receipt-actions"><button class="whatsapp-send" onclick="whatsappAbono(${c.id},${v})">💬 Enviar por WhatsApp</button><button class="copy-send" onclick="copiarMensajeAbono(${c.id},${v})">Copiar mensaje</button><button class="close-receipt" onclick="cerrarHistorial()">Cerrar</button></div></div>`; show('historialModal') }
function whatsappAbono(id, v) { const c = clientes.find(x => x.id === id); if (!c) return; let tel = c.telefono; if (tel.length === 10 && tel.startsWith('3')) tel = '57' + tel; window.open(`https://wa.me/${tel}?text=${encodeURIComponent(construirMensajeAbono(c, v))}`, '_blank') }
function copiarMensajeAbono(id, v) { const c = clientes.find(x => x.id === id); if (!c) return; navigator.clipboard?.writeText(construirMensajeAbono(c, v)).then(() => alert('Mensaje copiado.')).catch(() => alert('No se pudo copiar automáticamente.')) }
function whatsapp(e, id) { if (e) e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c) return; let tel = c.telefono; if (tel.length === 10 && tel.startsWith('3')) tel = '57' + tel; const msg = c.pagado > 0 ? construirMensajeAbono(c, c.historial?.filter(h => h.tipo === 'abono').at(-1)?.valor || 0) : `Hola ${c.nombre}. Tu saldo actual es ${money(Math.max(c.total - c.pagado, 0))}. Cuota: ${money(c.cuota)}.`; window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank') }
function llamar(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); location.href = `tel:${c.telefono}` }
function ubicacion(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c.direccion) return alert('Este cliente no tiene dirección registrada.'); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion)}`, '_blank') }
function editarCliente(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c) return; clienteEditando = id; $('editNumero').value = c.numero || ''; $('editNombre').value = c.nombre; $('editTelefono').value = c.telefono; $('editDireccion').value = c.direccion || ''; $('editPrestamo').value = c.prestamo; $('editInteres').value = c.interes; $('editCuotas').value = c.cuotas; $('editFrecuencia').value = c.frecuencia; $('editFechaInicio').value = c.fechaInicio; $('editSaldo').value = Math.max(c.total - c.pagado, 0); hide('clienteModal'); show('editarModal') }
function cerrarEdicion() { hide('editarModal'); clienteEditando = null }
function reordenarNumeroCliente(cliente, nuevoNumero) { const cartera = cliente.cartera || 'yeison'; const anterior = Number(cliente.numero || 0); if (nuevoNumero === anterior) return; const grupo = clientes.filter(x => x.id !== cliente.id && (x.cartera || 'yeison') === cartera); if (nuevoNumero < anterior) { grupo.forEach(x => { const n = Number(x.numero || 0); if (n >= nuevoNumero && n < anterior) x.numero = n + 1; }); } else { grupo.forEach(x => { const n = Number(x.numero || 0); if (n > anterior && n <= nuevoNumero) x.numero = n - 1; }); } cliente.numero = nuevoNumero; }
$('editarForm').addEventListener('submit', e => { e.preventDefault(); const c = clientes.find(x => x.id === clienteEditando); if (!c) return; const numero = +$('editNumero').value, nombre = $('editNombre').value.trim(), telefono = $('editTelefono').value.replace(/\D/g, ''), direccion = $('editDireccion').value.trim(), prestamo = +$('editPrestamo').value, interes = +$('editInteres').value, cuotas = +$('editCuotas').value, saldoActual = +$('editSaldo').value, frecuencia = $('editFrecuencia').value, fechaInicio = $('editFechaInicio').value || todayISO(); if (!Number.isInteger(numero) || numero < 1 || !nombre || telefono.length < 7 || prestamo <= 0 || interes < 0 || cuotas < 1 || !Number.isFinite(saldoActual) || saldoActual < 0) return alert('Completa correctamente los datos del cliente.'); const r = calc(prestamo, interes, cuotas); reordenarNumeroCliente(c, numero); c.nombre = nombre; c.telefono = telefono; c.direccion = direccion; c.prestamo = prestamo; c.interes = interes; c.cuotas = cuotas; c.frecuencia = frecuencia; c.fechaInicio = fechaInicio; c.vencimiento = addPeriod(fechaInicio, frecuencia, cuotas).toISOString().slice(0, 10); c.pagado = Number(c.pagado) || 0; c.total = saldoActual + c.pagado; c.cuota = r.cuota; save(); cerrarEdicion(); render(); renderCliente(c); show('clienteModal') });

function renovarCliente(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c) return; if (Math.max(c.total - c.pagado, 0) > 0) return alert('Este crédito todavía tiene saldo pendiente.'); $('renovNombre').value = c.nombre; $('renovTelefono').value = c.telefono; $('renovDireccion').value = c.direccion || ''; $('renovPrestamo').value = c.prestamo; $('renovInteres').value = c.interes; $('renovCuotas').value = c.cuotas; $('renovFrecuencia').value = c.frecuencia; $('renovFecha').value = todayISO(); $('renovClienteId').value = id; hide('clienteModal'); show('renovarModal'); }
$('renovarForm').addEventListener('submit', e => { e.preventDefault(); const old = clientes.find(x => x.id === +$('renovClienteId').value); if (!old) return; const prestamo = +$('renovPrestamo').value, interes = +$('renovInteres').value, cuotas = +$('renovCuotas').value, frecuencia = $('renovFrecuencia').value, fecha = $('renovFecha').value || todayISO(); const r = calc(prestamo, interes, cuotas); const nuevo = { ...old, id: Date.now(), numero: clientes.length ? Math.max(...clientes.map(c => c.numero || 0)) + 1 : 1, prestamo, interes, cuotas, frecuencia, fechaInicio: fecha, vencimiento: addPeriod(fecha, frecuencia, cuotas).toISOString().slice(0, 10), total: r.total, cuota: r.cuota, pagado: 0, cartera: getActivePortfolio(), historial: [{ tipo: 'prestamo', fecha: new Date().toISOString(), valor: prestamo }, { tipo: 'renovacion', fecha: new Date().toISOString(), valor: prestamo, anteriorId: old.id }] }; clientes.push(nuevo); save(); hide('renovarModal'); render(); abrirCliente(nuevo.id) });
function accionesCliente(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (confirm(`¿Eliminar a ${c.nombre}?`)) { clientes = clientes.filter(x => x.id !== id); save(); hide('clienteModal'); render() } }
function moverCliente(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c) return; const m = getMeta(); $('moverClienteId').value = id; $('moverDestino').innerHTML = m.portfolios.map(p => `<option value="${esc(p)}" ${p === (c.cartera || 'yeison') ? 'selected' : ''}>${esc(p)}</option>`).join(''); hide('clienteModal'); show('moverModal') }
$('moverForm').addEventListener('submit', e => { e.preventDefault(); const c = clientes.find(x => x.id === +$('moverClienteId').value); if (!c) return; c.cartera = $('moverDestino').value; save(); hide('moverModal'); render(); abrirCliente(c.id) });
function agruparMovimientosPorDia(movimientos, incluirNombre = false) {
  const grupos = new Map();
  movimientos.slice().sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).forEach(h => {
    const fecha = String(h.fecha || '').slice(0,10) || todayISO();
    if (!grupos.has(fecha)) grupos.set(fecha, []);
    grupos.get(fecha).push(h);
  });
  return [...grupos.entries()].map(([fecha, items]) => {
    const total = items.reduce((s,h) => s + Number(h.valor || 0), 0);
    const titulo = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    return `<section class="history-day"><div class="history-day-head"><b>${titulo}</b><span>${items.length} ${items.length === 1 ? 'movimiento' : 'movimientos'}</span></div>${items.map(h => `<div class="history-item"><span>${tipoNombre(h.tipo)}${incluirNombre ? ' · ' + esc(h.nombre || '') : ''}<small>${new Date(h.fecha).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}${incluirNombre && h.cartera ? ' · ' + esc(h.cartera) : ''}</small></span><b>${Number(h.valor || 0) ? money(h.valor) : '—'}</b></div>`).join('')}<div class="history-day-total"><span>Total del día</span><b>${money(total)}</b></div></section>`;
  }).join('');
}
function abrirHistorial(e, id) { e.stopPropagation(); const c = clientes.find(x => x.id === id); if (!c) return; let html = `<h2>Historial de ${esc(c.nombre)}</h2><p class="sub">Movimientos organizados por día</p>`; html += c.historial?.length ? agruparMovimientosPorDia(c.historial) : '<p>No hay movimientos registrados.</p>'; $('historialContenido').innerHTML = html; show('historialModal') }
function tipoNombre(t) { return t === 'abono' ? 'Cobro / Abono' : t === 'prestamo' ? 'Préstamo' : t === 'renovacion' ? 'Renovación' : t === 'gasto' ? 'Gasto' : 'No pago' }
function cerrarHistorial() { hide('historialModal') }
function currentWeekRange() { const now = new Date(), day = (now.getDay() + 6) % 7, start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(now.getDate() - day); const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999); return { start, end } }
function allMovements() { const m = getMeta(); const arr = []; clientes.forEach(c => (c.historial || []).forEach(h => arr.push({ ...h, nombre: c.nombre, cartera: c.cartera || 'yeison' }))); m.expenses.forEach(g => arr.push({ ...g, tipo: 'gasto', nombre: g.descripcion, cartera: g.cartera || m.activePortfolio })); return arr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) }
function weeklyStats() { const { start, end } = currentWeekRange(); const mov = allMovements().filter(x => { const d = new Date(x.fecha); return d >= start && d <= end }); return { mov, cobrado: mov.filter(x => x.tipo === 'abono').reduce((s, x) => s + Number(x.valor || 0), 0), prestado: mov.filter(x => x.tipo === 'prestamo' || x.tipo === 'renovacion').reduce((s, x) => s + Number(x.valor || 0), 0), gastos: mov.filter(x => x.tipo === 'gasto').reduce((s, x) => s + Number(x.valor || 0), 0) } }
function inicioSemana(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); const day = (x.getDay()+6)%7; x.setDate(x.getDate()-day); return x }
function fechaISODate(d) { return new Date(d).toISOString().slice(0,10) }
function diasSemana() { const start = inicioSemana(); return ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((nombre,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return {nombre, fecha:fechaISODate(d)} }) }
function guardarDiaIngresos(fecha) { const m=getMeta(); m.diasGuardados=Array.isArray(m.diasGuardados)?m.diasGuardados:[]; if(!m.diasGuardados.includes(fecha)) m.diasGuardados.push(fecha); saveMeta(m); verIngresos(); alert(`Trabajo del ${new Date(fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} guardado.`) }
function verIngresos() {
  const cartera=getActivePortfolio(), dias=diasSemana();
  const mov=allMovements();
  const cards=dias.map(d=>{
    const abonos=mov.filter(x=>x.tipo==='abono' && x.cartera===cartera && String(x.fecha).slice(0,10)===d.fecha);
    const prestamos=mov.filter(x=>(x.tipo==='prestamo'||x.tipo==='renovacion') && x.cartera===cartera && String(x.fecha).slice(0,10)===d.fecha);
    const cobro=abonos.reduce((s,x)=>s+Number(x.valor||0),0), prestesto=prestamos.reduce((s,x)=>s+Number(x.valor||0),0);
    const guardados=(getMeta().diasGuardados||[]).includes(d.fecha);
    return `<div class="day-income"><div class="day-head"><div><h3>${d.nombre}</h3><small>${formatDate(d.fecha)}</small></div><span class="day-saved">${guardados?'✓ Guardado':'Sin guardar'}</span></div><div class="day-values"><div><span>💰 Cobro</span><b>${money(cobro)}</b></div><div><span>💸 Préstamo</span><b>${money(prestesto)}</b></div></div><div class="finance-list">${abonos.map(x=>`<div class="history-item"><span><span class="payment-mark">✓</span> ${esc(x.nombre)}<small>${money(x.valor)}</small></span><b>${money(x.valor)}</b></div>`).join('') || '<p>No hay pagos registrados este día.</p>'}</div><button class="green-btn full" onclick="guardarDiaIngresos('${d.fecha}')">💾 Guardar día</button></div>`;
  }).join('');
  const week=mov.filter(x=>x.tipo==='abono'&&x.cartera===cartera&&dias.some(d=>d.fecha===String(x.fecha).slice(0,10))).reduce((s,x)=>s+Number(x.valor||0),0);
  $('finanzasContenido').innerHTML=`<h2>Ingresos</h2><p class="sub">Control diario de cobros · lunes a sábado</p><div class="finance-cards"><div><small>Total cobrado semana</small><b>${money(week)}</b></div><div><small>Cartera</small><b>${esc(cartera)}</b></div></div><div class="days-income-grid">${cards}</div>`;
  show('finanzasModal');
}
function verEgresos() { const { mov, prestado, gastos } = weeklyStats(); const totalGastos = getMeta().expenses.reduce((s, x) => s + Number(x.valor || 0), 0); $('finanzasContenido').innerHTML = `<h2>Egresos</h2><p class="sub">Préstamos entregados y gastos registrados</p><div class="finance-cards"><div><small>Prestado esta semana</small><b>${money(prestado)}</b></div><div><small>Gastos esta semana</small><b>${money(gastos)}</b></div></div><button class="green-btn full finance-add" onclick="abrirGasto()">＋ Registrar gasto</button><div class="finance-list">${mov.filter(x => x.tipo === 'prestamo' || x.tipo === 'renovacion' || x.tipo === 'gasto').map(x => `<div class="history-item"><span>${x.tipo === 'gasto' ? '🧾' : '💸'} ${esc(x.nombre)}<small>${x.tipo === 'gasto' ? 'Gasto' : 'Préstamo'} · ${new Date(x.fecha).toLocaleDateString('es-CO')}</small></span><b>${money(x.valor)}</b></div>`).join('') || '<p>No hay egresos esta semana.</p>'}</div><p class="sub">Gastos acumulados: ${money(totalGastos)}</p>`; show('finanzasModal') }
function abrirGasto() { hide('finanzasModal'); $('gastoFecha').value = todayISO(); $('gastoDescripcion').value = ''; $('gastoValor').value = ''; $('gastoCartera').innerHTML = getMeta().portfolios.map(p => `<option>${esc(p)}</option>`).join(''); show('gastoModal') }
$('gastoForm').addEventListener('submit', e => { e.preventDefault(); const descripcion = $('gastoDescripcion').value.trim(), valor = +$('gastoValor').value, fecha = $('gastoFecha').value || todayISO(), cartera = $('gastoCartera').value; if (!descripcion || valor <= 0) return alert('Completa la descripción y el valor del gasto.'); const m = getMeta(); m.expenses.push({ id: Date.now(), descripcion, valor, fecha: new Date(fecha + 'T12:00:00').toISOString(), cartera }); saveMeta(m); hide('gastoModal'); verEgresos(); actualizarInicio() });
function verHistorialGeneral() { const { mov, cobrado, prestado, gastos } = weeklyStats(); const totalPrestado = allMovements().filter(x => x.tipo === 'prestamo' || x.tipo === 'renovacion').reduce((s, x) => s + Number(x.valor || 0), 0); const totalCobrado = allMovements().filter(x => x.tipo === 'abono').reduce((s, x) => s + Number(x.valor || 0), 0); let html = `<h2>Historial semanal</h2><p class="sub">Lunes a domingo · ${formatDate(todayISO())}</p><div class="week-summary"><div><b>${money(cobrado)}</b><span>Cobrado esta semana</span></div><div><b>${money(prestado)}</b><span>Prestado esta semana</span></div><div><b>${money(gastos)}</b><span>Gastos esta semana</span></div></div><div class="history-total"><b>Acumulado</b><span>Cobrado ${money(totalCobrado)} · Prestado ${money(totalPrestado)}</span></div>`; html += mov.length ? agruparMovimientosPorDia(mov, true) : '<p>No hay movimientos esta semana.</p>'; $('historialContenido').innerHTML = html; show('historialModal') }
function irInicio() { document.body.classList.remove('showing-clients'); window.scrollTo({ top: 0, behavior: 'smooth' }); actualizarInicio() }
function irClientes() { document.body.classList.add('showing-clients'); window.scrollTo({ top: 0, behavior: 'smooth' }); render() }
function abrirMenu() { show('menuModal'); $('menuModal').setAttribute('aria-hidden','false') }
function menuAccion(opcion) { cerrarMenu(); if (opcion === 'inicio') return irInicio(); if (opcion === 'historial') return verHistorialGeneral(); if (opcion === 'clientes' || opcion === 'prestamos') return irClientes(); if (opcion === 'pagos') { irClientes(); alert('Abre un cliente y pulsa Abonar para registrar un pago.'); return; } if (opcion === 'carteras') return abrirCarteras(); if (opcion === 'gastos' || opcion === 'egresos' || opcion === 'cajas') return verEgresos(); if (opcion === 'reportes') return verInfo(); if (opcion === 'solicitudes') { alert('Solicitudes: esta sección todavía no está implementada en el proyecto.'); return; } if (opcion === 'mapa' || opcion === 'rutas') { irClientes(); alert('Selecciona un cliente y pulsa el icono de ubicación para abrir el mapa.'); return; } if (opcion === 'feriados' || opcion === 'plantillas' || opcion === 'seguridad') { alert('Esta sección todavía no está implementada en el proyecto.'); return; } }
function actualizarInicio() { const base = clientes.filter(c => (c.cartera || 'yeison') === getActivePortfolio()).reduce((s, c) => s + Number(c.prestamo || 0), 0), saldo = clientes.filter(c => (c.cartera || 'yeison') === getActivePortfolio()).reduce((s, c) => s + Math.max(Number(c.total || 0) - Number(c.pagado || 0), 0), 0); $('homeBase').textContent = money(base); $('homeDate').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' }); if ($('infoClientes')) { $('infoClientes').textContent = clientes.filter(c => (c.cartera || 'yeison') === getActivePortfolio()).length; $('infoPrestado').textContent = money(base); $('infoSaldo').textContent = money(saldo) } }
function verInfo() { actualizarInicio(); show('infoModal') }
function abrirCarteras() { renderCarteras(); show('carterasModal') }
function renderCarteras() { const m = getMeta(); $('carterasLista').innerHTML = m.portfolios.map(p => `<div class="portfolio-row ${p === m.activePortfolio ? 'active' : ''}"><button onclick="seleccionarCartera('${esc(p)}')">📁 ${esc(p)}</button><span>${clientes.filter(c => (c.cartera || 'yeison') === p).length}</span></div>`).join(''); }
function seleccionarCartera(p) { const m = getMeta(); if (!m.portfolios.includes(p)) return; m.activePortfolio = p; saveMeta(m); actualizarCarteraUI(); hide('carterasModal'); irInicio() }
function crearCartera() { const nombre = $('nuevaCartera').value.trim(); if (!nombre) return; if (getMeta().portfolios.some(p => p.toLowerCase() === nombre.toLowerCase())) return alert('Esa cartera ya existe.'); const m = getMeta(); m.portfolios.push(nombre); m.activePortfolio = nombre; saveMeta(m); $('nuevaCartera').value = ''; renderCarteras(); actualizarCarteraUI(); alert(`Cartera "${nombre}" creada.`) }
function guardarDatos() { exportarDatos(); alert('Copia de seguridad descargada correctamente.') }

function liquidar() { const saldo = clientes.filter(c => (c.cartera || 'yeison') === getActivePortfolio()).reduce((s, c) => s + Math.max(Number(c.total || 0) - Number(c.pagado || 0), 0), 0); alert(`Saldo pendiente de la cartera ${getActivePortfolio()}: ${money(saldo)}`) }
function borrarTodo() { if (confirm('¿Seguro que quieres borrar todos los clientes de esta cuenta?')) { clientes = []; save(); render(); cerrarMenu() } }
function show(id) { $(id)?.classList.add('show') } function hide(id) { $(id)?.classList.remove('show') }
const backdropModals = ['nuevoModal', 'clienteModal', 'pagoModal', 'editarModal', 'historialModal', 'menuModal', 'infoModal', 'carterasModal', 'finanzasModal', 'gastoModal', 'moverModal', 'renovarModal'];
function cerrarModalAlTocarFondo(e) { backdropModals.forEach(id => { const modal = $(id); if (modal && e.target === modal) hide(id); }); }
window.addEventListener('click', cerrarModalAlTocarFondo);
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') cerrarModalAlTocarFondo(e); });
function cerrarMenu() { hide('menuModal'); $('menuModal')?.setAttribute('aria-hidden','true') }
function cerrarHistorial() { hide('historialModal') }
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
});

async function instalarApp() {
  // Android/Chrome: abre el instalador nativo cuando el navegador lo permite.
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch { }
    deferredInstallPrompt = null;
    return;
  }

  // iPhone/iPad: iOS no permite abrir el instalador desde JavaScript.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    alert("Para instalar en iPhone: toca Compartir (□↑) → Agregar a pantalla de inicio → Agregar.");
    return;
  }

  alert("Para instalar: abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla de inicio”.");
}

async function exportarDatos() {
  const data = {
    usuario: currentUser?.username || "",
    clientes,
    meta: getMeta(),
    fecha: new Date().toISOString()
  };

  const json = JSON.stringify(data, null, 2);
  const fileName = "mi-credito-respaldo.json";
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const file = new File([blob], fileName, { type: "application/json" });

  // Android/iPhone modernos: usa el selector nativo de compartir/guardar.
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        title: "Copia de seguridad - Mi Crédito",
        text: "Guarda esta copia de seguridad de Mi Crédito.",
        files: [file]
      });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  // Navegadores que no soportan compartir archivos: descarga normal.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Algunos iPhone antiguos bloquean el atributo download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      window.open("data:application/json;charset=utf-8," + encodeURIComponent(json), "_blank");
    }
  }, 1200);
}
$('loginForm').addEventListener('submit', handleLogin); $('registerForm').addEventListener('submit', handleRegister);
if (!iniciarSesion()) { document.body.classList.remove('authenticated'); mostrarLogin() }

setInterval(() => { if (document.body.classList.contains('showing-clients')) render() }, 60000);

window.addEventListener("focus", actualizarEstadoPlan);
document.addEventListener("visibilitychange", () => { if (!document.hidden) actualizarEstadoPlan(); });
