import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAnalytics
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    doc, getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, updateDoc, where, increment, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.getElementById('logoutButton').addEventListener('click', function (e) {
    e.preventDefault();

    if (confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบ?")) {
        const auth = getAuth();
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Logout Error: ", error);
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
});


const firebaseConfig = {
    apiKey: "AIzaSyCFyk_COhdIjnzaFmBDfbUOxyrzB8LNlO8",
    authDomain: "stock-actigen.firebaseapp.com",
    projectId: "stock-actigen",
    storageBucket: "stock-actigen.appspot.com",
    messagingSenderId: "195171881165",
    appId: "1:195171881165:web:2b0df77225900be9d65984",
    measurementId: "G-Z2XM5RQ7R3"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

async function loadTypes() {
    const db = getFirestore();
    const querySnapshot = await getDocs(collection(db, "typeSolubilizer"));
    const typeList = document.getElementById("typeList");
    querySnapshot.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.data().typeName;
        typeList.appendChild(option);
    });
}

let isDataLoaded = false;

document.addEventListener('DOMContentLoaded', async function () {
    await loadTypes();
    await loadFilterOptions();
});


async function loadFilterOptions() {
    const filterSelect = document.getElementById("filterType");

    filterSelect.innerHTML = '<option value="">All Types</option>';

    const typesSnapshot = await getDocs(collection(db, "typeSolubilizer"));
    typesSnapshot.forEach((typeDoc) => {
        if (typeDoc.data().typeName.trim() !== "") {
            let option = document.createElement("option");
            option.value = typeDoc.data().typeName;
            option.textContent = typeDoc.data().typeName;
            filterSelect.appendChild(option);
        }
    });

    if (!isDataLoaded) {
        await fetchDataAndDisplay();
        isDataLoaded = true;
    }
}

document.getElementById('filterType').addEventListener('change', function () {
    fetchDataAndDisplay(this.value);
});





async function submitToFirestore(data) {
    try {
        const materialsCollection = collection(db, "SOLUBILIZER_DB");
        const q = query(materialsCollection, where("lotNo", "==", data.lotNo));
        const querySnapshot = await getDocs(q);
        let existingDocId = null;

        querySnapshot.forEach((doc) => {
            if (doc.data().lotNo === data.lotNo) {
                existingDocId = doc.id;
            }
        });

        if (data.type) {
            const typeRef = collection(db, "typeSolubilizer");
            const q = query(typeRef, where("typeName", "==", data.type));
            const typeSnapshot = await getDocs(q);

            if (typeSnapshot.empty) {
                await addDoc(typeRef, { typeName: data.type });
            }
        }

        if (existingDocId) {
            const docRef = doc(db, "SOLUBILIZER_DB", existingDocId);
            await updateDoc(docRef, {
                remaining: increment(data.remaining),
            });
        } else {
            const docRef = await addDoc(materialsCollection, {
                ...data,
                remaining: data.remaining,
            });
            existingDocId = docRef.id;
        }

        const subCollectionRef = collection(db, `SOLUBILIZER_DB/${existingDocId}/historyAdded`);
        await addDoc(subCollectionRef, {
            ...data,
            remaining: data.remaining,
        });

        console.log("Data processed with LotNo: ", data.lotNo);

        const formModal = document.getElementById('userFormSolubilizerList');
        const modalInstance = bootstrap.Modal.getInstance(formModal);
        if (modalInstance) {
            modalInstance.hide();
        }
        await fetchDataAndDisplay();
    } catch (e) {
        console.error("Error adding/updating document: ", e);
    }
}

document.getElementById('materialForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const inputs = this.querySelectorAll('input[required]');
    let allValid = true;
    inputs.forEach(input => {
        if (!input.value.trim()) {
            alert(`${input.name} cannot be empty or just whitespace.`);
            allValid = false;
        }
    });

    if (allValid) {
        console.log("All inputs are valid. Form can be submitted.");
    }
});


document.getElementById('refreshDataButton').addEventListener('click', function () {
    fetchDataAndDisplay();
});

let isSubtracting = false;

document.getElementById('subtractDataButton').addEventListener('click', function () {
    isSubtracting = true;
});


document.getElementById('materialForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = {
        no: document.getElementById('no').value,
        materialName: document.getElementById('materialName').value,
        materialCode: document.getElementById('materialCode').value,
        lotNo: document.getElementById('lotNo').value,
        mfgDate: document.getElementById('mfgDate').value,
        expDate: document.getElementById('expDate').value,
        remaining: parseFloat(document.getElementById('remaining').value),
        project: document.getElementById('project').value,
        receive: document.getElementById('receive').value,
        objective: document.getElementById('objective').value,
        type: document.getElementById('type').value
    };

    const typeValue = formData.type;
    console.log('Selected type:', typeValue);

    const typeRef = collection(db, "typeSolubilizer");
    const q = query(typeRef, where("typeName", "==", typeValue));
    const typeSnapshot = await getDocs(q);

    if (typeSnapshot.empty) {
        await addDoc(typeRef, { typeName: typeValue });
    }

    if (isSubtracting) {
        await subtractFromFirestore(formData);
        isSubtracting = false;
    } else {
        await submitToFirestore(formData);
    }
});



document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('databody').addEventListener('click', async function (e) {
        if (e.target.classList.contains('btn-danger')) {
            const docId = e.target.closest('tr').getAttribute('data-doc-id');
            if (confirm("คุณต้องการลบข้อมูลนี้ใช่หรือไม่?")) {
                try {
                    await deleteDoc(doc(db, "SOLUBILIZER_DB", docId));
                    console.log("Document successfully deleted!");
                    fetchDataAndDisplay();
                } catch (error) {
                    console.error("Error removing document: ", error);
                }
            }
        }
    });

    fetchDataAndDisplay();
});

async function fetchDataAndDisplay(selectedType, searchText = "") {
    try {
        let q;
        if (selectedType) {
            q = query(collection(db, "SOLUBILIZER_DB"), where("type", "==", selectedType));
        } else if (searchText) {
            q = query(collection(db, "SOLUBILIZER_DB"), where("materialName", "==", searchText));
        } else if (searchText) {
            q = query(collection(db, "SOLUBILIZER_DB"), where("LotNo", "==", searchText));
        } else {
            q = query(collection(db, "SOLUBILIZER_DB"), orderBy("no", "asc"));
        }

        isDataLoaded = true;

        const querySnapshot = await getDocs(q);
        let docs = querySnapshot.docs;

        if (!selectedType && !searchText) {
            // เรียงลำดับเอกสารถ้าไม่มีการค้นหา
            docs = docs.sort((a, b) => a.data().no - b.data().no);
        }

        const databody = document.getElementById("databody");
        const modalDatabody = document.getElementById("modalDatabody");
        const modalDatabody2 = document.getElementById("modalDatabody2");

        databody.innerHTML = '';
        modalDatabody.innerHTML = '';
        modalDatabody2.innerHTML = '';

        const fetchPromises = docs.map(async (doc) => { // ใช้ตัวแปร docs แทน querySnapshot.docs
            const data = doc.data();
            const docId = doc.id;

            addRowToTable(data, docId, databody);

            const addedDocsPromise = getDocs(collection(db, `SOLUBILIZER_DB/${docId}/historyAdded`));
            const subtractedDocsPromise = getDocs(collection(db, `SOLUBILIZER_DB/${docId}/historySubtracted`));

            const [addedDocs, subtractedDocs] = await Promise.all([addedDocsPromise, subtractedDocsPromise]);

            addedDocs.forEach(subDoc => {
                addRowToTable(subDoc.data(), subDoc.id, modalDatabody);
            });

            subtractedDocs.forEach(subDoc => {
                addRowToTable(subDoc.data(), subDoc.id, modalDatabody2);
            });
        });

        await Promise.all(fetchPromises);
    } catch (error) {
        console.error("Error fetching documents: ", error);
    }
}


function addRowToTable(data, docId, tableBody) {
    const row = document.createElement("tr");
    row.setAttribute('data-doc-id', docId);
    row.innerHTML = `
<td>${data.no || ''}</td>
<td>${data.materialCode || ''}</td>
<td>${data.materialName || ''}</td>
<td>${data.lotNo || ''}</td>
<td>${data.mfgDate || ''}</td>
<td>${data.expDate || ''}</td>
<td>${data.remaining || ''}</td>
<td>${data.project || ''}</td>
<td>${data.receive || ''}</td>
<td>${data.objective || ''}</td>
`;
    if (tableBody === databody) {
        row.innerHTML += '<td><button class="btn btn-danger">Delete</button></td>';
    }
    tableBody.appendChild(row);
}
document.getElementById('searchButton').addEventListener('click', function () {
    const searchText = document.getElementById('searchInput').value;
    fetchDataAndDisplay(null, searchText);
});


document.getElementById('databody').addEventListener('click', function (e) {
    if (e.target.classList.contains('btn-danger') || e.target.closest('.btn-danger')) {
        const btn = e.target.closest('.btn-danger'); // หาปุ่มลบที่ใกล้ที่สุด
        const docId = btn.closest('tr').getAttribute('data-doc-id');
        if (docId && confirm("คุณต้องการลบข้อมูลนี้ใช่หรือไม่?")) {
            deleteDocument(docId);
        }
    }
});

async function deleteDocument(docId) {
    try {
        await deleteDoc(doc(db, "SOLUBILIZER_DB", docId));
        console.log("Document successfully deleted!");
        fetchDataAndDisplay();
    } catch (error) {
        console.error("Error removing document: ", error);
    }
}


async function subtractFromFirestore(data) {
    try {
        const materialsCollection = collection(db, "SOLUBILIZER_DB");
        const q = query(materialsCollection, where("lotNo", "==", data.lotNo));
        const querySnapshot = await getDocs(q);
        let existingDocId = null;

        querySnapshot.forEach((doc) => {
            if (doc.data().lotNo === data.lotNo) {
                existingDocId = doc.id;
            }
        });

        if (existingDocId) {
            const docRef = doc(db, "SOLUBILIZER_DB", existingDocId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const currentData = docSnap.data();
                const newRemaining = currentData.remaining - data.remaining;

                if (newRemaining < 0) {
                    console.error("Cannot subtract more than the current amount.");
                } else {
                    await updateDoc(docRef, {
                        remaining: newRemaining,
                    });

                    const subCollectionRef = collection(db, `SOLUBILIZER_DB/${existingDocId}/historySubtracted`);
                    await addDoc(subCollectionRef, {
                        ...data,
                        remaining: -data.remaining,
                    });

                    console.log("Data subtracted from LotNo: ", data.lotNo);
                    await fetchDataAndDisplay();
                }
            } else {
                console.error("Document data does not exist.");
            }
        } else {
            console.error("No document with the provided lotNo exists to subtract from.");
        }
    } catch (e) {
        console.error("Error subtracting from document: ", e);
    }
}