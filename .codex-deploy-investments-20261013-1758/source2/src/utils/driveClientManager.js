const { ensureFolder } = require("./drive");
const { drive } = require("../config/google");
const logger = require("../config/logger");

const getRootFolderId = () => {
    const rootId = process.env.DRIVE_CLIENT_REGISTRATIONS_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID;
    if (!rootId) {
        throw new Error("DRIVE_CLIENT_REGISTRATIONS_FOLDER_ID o DRIVE_ROOT_FOLDER_ID no está configurado en el entorno.");
    }
    return rootId;
};

const getApprovedFolderId = () => {
    const rootId = process.env.DRIVE_APPROVED_CLIENTS_FOLDER_ID || process.env.DRIVE_ROOT_FOLDER_ID;
     if (!rootId) {
        throw new Error("DRIVE_APPROVED_CLIENTS_FOLDER_ID o DRIVE_ROOT_FOLDER_ID no está configurado en el entorno.");
    }
    return rootId;
}

/**
 * Crea la estructura de carpetas para un nuevo cliente.
 * @param {string} clientName - El nombre comercial del cliente.
 * @returns {Promise<string>} El ID de la carpeta del cliente.
 */
async function createClientFolder(clientName) {
    if (!clientName) {
        throw new Error("El nombre del cliente es obligatorio para crear la carpeta.");
    }

    const rootId = getRootFolderId();
    
    // 1. Asegurar que existe la carpeta "Registro de Nuevos Clientes"
    const registrationsFolder = await ensureFolder("Registro de Nuevos Clientes", rootId);

    // 2. Crear la carpeta para el cliente dentro de "Registro de Nuevos Clientes"
    const clientFolder = await ensureFolder(clientName, registrationsFolder.id);

    logger.info(`[Drive] Carpeta de cliente creada/asegurada: ${clientName} (ID: ${clientFolder.id})`);

    return clientFolder.id;
}

/**
 * Mueve la carpeta de un cliente al directorio de "Clientes Aprobados".
 * @param {string} clientFolderId - El ID de la carpeta del cliente.
 * @returns {Promise<void>}
 */
async function moveClientFolderToApproved(clientFolderId) {
    if (!clientFolderId) {
        throw new Error("El ID de la carpeta del cliente es obligatorio.");
    }

    // 1. Obtener ID de la carpeta de registros y la de aprobados.
    const registrationsFolder = await ensureFolder("Registro de Nuevos Clientes", getRootFolderId());
    const approvedFolder = await ensureFolder("Clientes Aprobados", getApprovedFolderId());

    // 2. Obtener los parents actuales de la carpeta para poder remover el anterior.
    const file = await drive.files.get({
        fileId: clientFolderId,
        fields: 'parents',
        supportsAllDrives: true,
    });

    const previousParents = file.data.parents.join(',');

    // 3. Mover la carpeta cambiando sus parents.
    await drive.files.update({
        fileId: clientFolderId,
        addParents: approvedFolder.id,
        removeParents: previousParents,
        supportsAllDrives: true,
        fields: 'id, parents',
    });

    logger.info(`[Drive] Carpeta ${clientFolderId} movida a Clientes Aprobados (ID: ${approvedFolder.id})`);
}

module.exports = {
    createClientFolder,
    moveClientFolderToApproved,
};
