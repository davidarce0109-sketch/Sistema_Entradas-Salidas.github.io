import { initializeApp } from "firebase/app";
import { 
    getFirestore, collection, doc, setDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, query, where, addDoc, onSnapshot 
} from "firebase/firestore";

// Configuración de tu base de datos Firebase enviada
const firebaseConfig = {
  apiKey: "AIzaSyDHn60EuXZEbi2SijvKsnm2JBRxtjEWvDg",
  authDomain: "sistema-de-entradas-y-sa-4f89f.firebaseapp.com",
  projectId: "sistema-de-entradas-y-sa-4f89f",
  storageBucket: "sistema-de-entradas-y-sa-4f89f.firebasestorage.app",
  messagingSenderId: "579466318121",
  appId: "1:579466318121:web:0f21c1aa692dc6a9afa738"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado de la Sesión Local
let currentUser = null;
let html5QrcodeScanner = null;

// ELEMENTOS DEL DOM
const authContainer = document.getElementById('auth-container');
const loginFields = document.getElementById('login-fields');
const registerFields = document.getElementById('register-fields');
const authTitle = document.getElementById('auth-title');
const roleSelect = document.getElementById('role-select');
const appHeader = document.getElementById('app-header');

// Páneles principales de roles
const panelAdmin = document.getElementById('panel-administrative');
const panelGuard = document.getElementById('panel-guard');
const panelInstructor = document.getElementById('panel-instructor');

// --- INTERFAZ Y NAVEGACIÓN ---
document.getElementById('go-to-register').addEventListener('click', () => {
    if(roleSelect.value === 'Administrativo') {
        alert("El personal administrativo no puede autoregistrarse.");
        return;
    }
    loginFields.classList.add('hidden');
    registerFields.classList.remove('hidden');
    authTitle.innerText = "Registrar Nuevo " + roleSelect.value;
});

document.getElementById('go-to-login').addEventListener('click', () => {
    registerFields.classList.add('hidden');
    loginFields.classList.remove('hidden');
    authTitle.innerText = "Iniciar Sesión";
});

roleSelect.addEventListener('change', () => {
    if(!registerFields.classList.contains('hidden')) {
        authTitle.innerText = "Registrar Nuevo " + roleSelect.value;
    }
});

// --- SISTEMA DE AUTENTICACIÓN (RF-02 al RF-06) ---
document.getElementById('btn-register').addEventListener('click', async () => {
    const docId = document.getElementById('reg-doc').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const confirmPass = document.getElementById('reg-confirm-pass').value;
    const role = roleSelect.value;

    if(!docId || !name || !pass || !confirmPass) return alert("Complete todos los campos.");
    if(pass !== confirmPass) return alert("Las contraseñas no coinciden.");

    try {
        const userRef = doc(db, "users", docId);
        const userSnap = await getDoc(userRef);
        if(userSnap.exists()) return alert("El usuario con este documento ya existe.");

        await setDoc(userRef, {
            documento: docId,
            nombre: name,
            contrasena: pass,
            rol: role
        });

        alert("Registro completado con éxito.");
        
        // RF-04: Eliminar datos ingresados tras completar el registro exitosamente
        document.getElementById('reg-doc').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-pass').value = '';
        document.getElementById('reg-confirm-pass').value = '';
        document.getElementById('go-to-login').click();

    } catch (e) {
        console.error(e);
        alert("Error al procesar el registro.");
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const docId = document.getElementById('login-doc').value.trim();
    const pass = document.getElementById('login-pass').value;
    const role = roleSelect.value;

    if(!docId || !pass) return alert("Por favor complete las credenciales.");

    // RF-06: Validación estricta del acceso del personal administrativo
    if(role === 'Administrativo') {
        if(docId === "1114241534" && pass === "3507960599") {
            loadSession({ documento: docId, nombre: "Admin General", rol: "Administrativo" });
        } else {
            alert("Credenciales administrativas incorrectas.");
        }
        return;
    }

    // RF-05: Validación de acceso para Instructores y Guardias
    try {
        const userSnap = await getDoc(doc(db, "users", docId));
        if(userSnap.exists() && userSnap.data().contrasena === pass && userSnap.data().rol === role) {
            loadSession(userSnap.data());
        } else {
            alert("Usuario, contraseña o rol incorrectos.");
        }
    } catch(e) {
        console.error(e);
    }
});

function loadSession(user) {
    currentUser = user;
    authContainer.classList.add('hidden');
    appHeader.classList.remove('hidden');
    document.getElementById('user-display-name').innerText = user.nombre;
    document.getElementById('user-display-role').innerText = user.rol;

    // RF-07, RF-08, RF-09: Despliegue de plataformas correspondientes
    if(user.rol === 'Administrativo') {
        panelAdmin.classList.remove('hidden');
        initAdminPanel();
    } else if(user.rol === 'Guardia') {
        panelGuard.classList.remove('hidden');
        initGuardPanel();
    } else if(user.rol === 'Instructor') {
        panelInstructor.classList.remove('hidden');
        initInstructorPanel();
    }
}

document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    panelAdmin.classList.add('hidden');
    panelGuard.classList.add('hidden');
    panelInstructor.classList.add('hidden');
    appHeader.classList.add('hidden');
    authContainer.classList.remove('hidden');
    document.getElementById('login-doc').value = '';
    document.getElementById('login-pass').value = '';
});

// --- CONTROL PANEL ADMINISTRATIVO (RF-10 al RF-15) ---
function initAdminPanel() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const tbody = document.getElementById('admin-users-table');
        const selectInst = document.getElementById('admin-select-instructor');
        tbody.innerHTML = '';
        selectInst.innerHTML = '<option value="">Seleccione Instructor...</option>';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if(data.rol === 'Instructor') {
                let opt = document.createElement('option');
                opt.value = data.documento;
                opt.innerText = data.nombre;
                selectInst.appendChild(opt);
            }

            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.nombre}</td>
                <td>${data.documento}</td>
                <td>${data.rol}</td>
                <td>
                    <button class="btn btn-sm btn-change-pass" data-id="${data.documento}">Cambiar Clave</button>
                    <button class="btn btn-sm btn-danger btn-delete-acc" data-id="${data.documento}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Event listeners dinámicos para evitar usar llamadas inline en el HTML
        document.querySelectorAll('.btn-change-pass').forEach(btn => {
            btn.addEventListener('click', (e) => changePassword(e.target.dataset.id));
        });
        document.querySelectorAll('.btn-delete-acc').forEach(btn => {
            btn.addEventListener('click', (e) => deleteAccount(e.target.dataset.id));
        });
    });

    document.getElementById('admin-filter-date').addEventListener('change', (e) => {
        loadAdminVisitors(e.target.value);
    });
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('admin-filter-date').value = todayStr;
    loadAdminVisitors(todayStr);
}

async function changePassword(docId) {
    let newPass = prompt("Ingrese la nueva contraseña:");
    if(newPass) {
        await updateDoc(doc(db, "users", docId), { contrasena: newPass });
        alert("Contraseña actualizada con éxito (RF-10/11).");
    }
}

async function deleteAccount(docId) {
    if(confirm("¿Está seguro de eliminar esta cuenta? (RF-12/13)")) {
        await deleteDoc(doc(db, "users", docId));
        alert("Cuenta removida del sistema.");
    }
}

// RF-14: Asignación de acceso a fichas
document.getElementById('btn-assign-ficha').addEventListener('click', async () => {
    const instId = document.getElementById('admin-select-instructor').value;
    const ficha = document.getElementById('admin-input-ficha').value.trim();
    if(!instId || !ficha) return alert("Seleccione Instructor e indique la Ficha.");

    await addDoc(collection(db, "assignments"), { instructorId: instId, ficha: ficha });
    alert("Ficha vinculada.");
    document.getElementById('admin-input-ficha').value = '';
    loadAssignedFichas();
});

document.getElementById('admin-select-instructor').addEventListener('change', loadAssignedFichas);

async function loadAssignedFichas() {
    const instId = document.getElementById('admin-select-instructor').value;
    const list = document.getElementById('assigned-fichas-list');
    list.innerHTML = '';
    if(!instId) return;

    const q = query(collection(db, "assignments"), where("instructorId", "==", instId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
        let li = document.createElement('li');
        li.innerHTML = `${docSnap.data().ficha} <button class="btn btn-sm btn-danger btn-remove-assign" data-id="${docSnap.id}">Quitar</button>`;
        list.appendChild(li);
    });

    document.querySelectorAll('.btn-remove-assign').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            await deleteDoc(doc(db, "assignments", e.target.dataset.id));
            loadAssignedFichas();
        });
    });
}

// RF-15 / RF-29: Filtrar consolidados por fecha
async function loadAdminVisitors(dateStr) {
    const tbody = document.getElementById('admin-visitors-table');
    tbody.innerHTML = '';
    const q = query(collection(db, "logs"), where("fecha", "==", dateStr), where("tipo", "==", "visitante"));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
        let data = docSnap.data();
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${data.documento}</td><td>${data.nombre}</td><td>${data.motivo}</td><td>${data.entrada}</td><td>${data.salida || 'En planta'}</td>`;
        tbody.appendChild(tr);
    });
}

// --- PANEL GUARDIA DE SEGURIDAD (RF-16 al RF-23) ---
function initGuardPanel() {
    loadGuardDayLogs();
    
    // Lector QR mediante cámara del dispositivo (RF-23)
    if(!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        html5QrcodeScanner.render((decodedText) => {
            try {
                const parsed = JSON.parse(decodedText);
                if(parsed.documento && parsed.nombre && parsed.ficha) {
                    registerAprendizLog(parsed.documento, parsed.nombre, parsed.ficha);
                    document.getElementById('qr-result').innerText = `QR Escaneado: ${parsed.nombre} registrado.`;
                }
            } catch(e) {
                alert("Estructura de código QR inválida.");
            }
        });
    }

    document.getElementById('guard-search-ap').addEventListener('input', loadGuardDayLogs);
}

// RF-17: Registro Manual Aprendiz
document.getElementById('btn-guard-save-ap').addEventListener('click', () => {
    const docId = document.getElementById('guard-ap-doc').value.trim();
    const name = document.getElementById('guard-ap-name').value.trim();
    const ficha = document.getElementById('guard-ap-ficha').value.trim();

    if(!docId || !name || !ficha) return alert("Complete los datos requeridos.");
    registerAprendizLog(docId, name, ficha);

    document.getElementById('guard-ap-doc').value = '';
    document.getElementById('guard-ap-name').value = '';
    document.getElementById('guard-ap-ficha').value = '';
});

// RF-19: Registro Manual Visitante
document.getElementById('btn-guard-save-vis').addEventListener('click', async () => {
    const docId = document.getElementById('guard-vis-doc').value.trim();
    const name = document.getElementById('guard-vis-name').value.trim();
    const motivo = document.getElementById('guard-vis-motivo').value.trim();
    const now = new Date();

    if(!docId || !name || !motivo) return alert("Complete los datos requeridos.");

    await addDoc(collection(db, "logs"), {
        tipo: 'visitante',
        documento: docId,
        nombre: name,
        motivo: motivo,
        fecha: now.toISOString().split('T')[0],
        entrada: now.toLocaleTimeString()
    });

    document.getElementById('guard-vis-doc').value = '';
    document.getElementById('guard-vis-name').value = '';
    document.getElementById('guard-vis-motivo').value = '';
    loadGuardDayLogs();
});

async function registerAprendizLog(docId, name, ficha) {
    const now = new Date();
    await addDoc(collection(db, "logs"), {
        tipo: 'aprendiz',
        documento: docId,
        nombre: name,
        ficha: ficha,
        fecha: now.toISOString().split('T')[0],
        entrada: now.toLocaleTimeString(),
        observacion: ''
    });
    loadGuardDayLogs();
}

// Renderizado de control diario y busqueda (RF-21, RF-22)
async function loadGuardDayLogs() {
    const searchVal = document.getElementById('guard-search-ap').value.toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const apTable = document.getElementById('guard-ap-table');
    const visTable = document.getElementById('guard-vis-table');
    apTable.innerHTML = '';
    visTable.innerHTML = '';

    const q = query(collection(db, "logs"), where("fecha", "==", todayStr));
    const snap = await getDocs(q);

    snap.forEach(docSnap => {
        let data = docSnap.data();
        let id = docSnap.id;

        if(data.tipo === 'aprendiz') {
            if(searchVal && !data.nombre.toLowerCase().includes(searchVal) && !data.documento.includes(searchVal)) return;

            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.ficha}</td>
                <td>${data.nombre}</td>
                <td>${data.documento}</td>
                <td>${data.entrada}</td>
                <td>${data.salida || '--'}</td>
                <td>${!data.salida ? `<button class="btn btn-sm btn-danger btn-checkout" data-id="${id}">Salida</button>` : 'Fuera'}</td>
            `;
            apTable.appendChild(tr);
        } else if(data.tipo === 'visitante') {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.documento}</td>
                <td>${data.nombre}</td>
                <td>${data.motivo}</td>
                <td>${data.entrada}</td>
                <td>${data.salida || '--'}</td>
                <td>${!data.salida ? `<button class="btn btn-sm btn-danger btn-checkout" data-id="${id}">Salida</button>` : 'Fuera'}</td>
            `;
            visTable.appendChild(tr);
        }
    });

    // Vinculación de salidas exactas (RF-18 / RF-20)
    document.querySelectorAll('.btn-checkout').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            await updateDoc(doc(db, "logs", e.target.dataset.id), {
                salida: new Date().toLocaleTimeString()
            });
            loadGuardDayLogs();
        });
    });
}

// --- PANEL INSTRUCTOR (RF-25 al RF-28) ---
async function initInstructorPanel() {
    const selectFicha = document.getElementById('inst-ficha-select');
    selectFicha.innerHTML = '<option value="">-- Seleccione Ficha --</option>';
    
    const q = query(collection(db, "assignments"), where("instructorId", "==", currentUser.documento));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
        let opt = document.createElement('option');
        opt.value = docSnap.data().ficha;
        opt.innerText = docSnap.data().ficha;
        selectFicha.appendChild(opt);
    });

    selectFicha.addEventListener('change', loadInstructorClassList);
    document.getElementById('inst-filter-date').addEventListener('change', loadInstructorHistory);
    document.getElementById('inst-filter-date').value = new Date().toISOString().split('T')[0];
    loadInstructorHistory();
}

async function loadInstructorClassList() {
    const ficha = document.getElementById('inst-ficha-select').value;
    const tbody = document.getElementById('inst-ap-table');
    tbody.innerHTML = '';
    if(!ficha) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(collection(db, "logs"), where("fecha", "==", todayStr), where("tipo", "==", "aprendiz"), where("ficha", "==", ficha));
    const snap = await getDocs(q);

    snap.forEach(docSnap => {
        let data = docSnap.data();
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.documento}</td>
            <td>${data.nombre}</td>
            <td>${data.ficha}</td>
            <td>${data.entrada}</td>
            <td><button class="btn btn-sm btn-open-obs" data-id="${docSnap.id}">Escribir Obs</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-open-obs').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('obs-ap-id').value = e.target.dataset.id;
            document.getElementById('obs-text').value = '';
            document.getElementById('observation-modal').classList.remove('hidden');
        });
    });
}

document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('observation-modal').classList.add('hidden');
});

document.getElementById('btn-save-obs').addEventListener('click', async () => {
    const logId = document.getElementById('obs-ap-id').value;
    const obsText = document.getElementById('obs-text').value.trim();
    if(!obsText) return alert("Escriba la observación.");

    await updateDoc(doc(db, "logs", logId), {
        observacion: obsText,
        instructorAutor: currentUser.documento,
        instructorNombre: currentUser.nombre
    });

    alert("Observación almacenada.");
    document.getElementById('observation-modal').classList.add('hidden');
    loadInstructorClassList();
    loadInstructorHistory();
});

async function loadInstructorHistory() {
    const dateStr = document.getElementById('inst-filter-date').value;
    const tbody = document.getElementById('inst-history-table');
    tbody.innerHTML = '';
    if(!dateStr) return;

    const q = query(collection(db, "logs"), where("fecha", "==", dateStr), where("tipo", "==", "aprendiz"));
    const snap = await getDocs(q);

    snap.forEach(docSnap => {
        let data = docSnap.data();
        if(data.observacion) {
            let tr = document.createElement('tr');
            const isAuthor = data.instructorAutor === currentUser.documento;
            tr.innerHTML = `
                <td>${data.fecha}</td>
                <td>${data.ficha}</td>
                <td>${data.nombre}</td>
                <td>${data.observacion}</td>
                <td>${data.instructorNombre || 'Anon'}</td>
                <td>
                    ${isAuthor ? `<button class="btn btn-sm btn-danger btn-del-obs" data-id="${docSnap.id}">Eliminar</button>` : '<span class="text-muted">No Autorizado</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    // RF-27: Permitir que únicamente el creador de la observación pueda borrarla
    document.querySelectorAll('.btn-del-obs').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm("¿Desea borrar la observación?")) {
                await updateDoc(doc(db, "logs", e.target.dataset.id), {
                    observacion: '',
                    instructorAutor: '',
                    instructorNombre: ''
                });
                loadInstructorHistory();
                if(document.getElementById('inst-ficha-select').value) loadInstructorClassList();
            }
        });
    });
}
