import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
};

export const technicalApplicationsApi = {
    /**
     * Obtiene los documentos disponibles según el rol del usuario
     */
    getAvailableDocuments: async () => {
        try {
            const response = await axios.get(
                `${API_URL}/technical-applications/available`,
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching available documents:', error);
            throw error;
        }
    },

    /**
     * Crea un nuevo documento técnico
     */
    createDocument: async (documentType, formData) => {
        try {
            const response = await axios.post(
                `${API_URL}/technical-applications/documents`,
                { documentType, formData },
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    },

    /**
     * Obtiene el historial de documentos
     */
    getDocumentHistory: async (filters = {}) => {
        try {
            const response = await axios.get(
                `${API_URL}/technical-applications/documents`,
                {
                    params: filters,
                    ...getHeaders(),
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching document history:', error);
            throw error;
        }
    },

    /**
     * Obtiene un documento específico por ID
     */
    getDocumentById: async (id) => {
        try {
            const response = await axios.get(
                `${API_URL}/technical-applications/documents/${id}`,
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching document by ID:', error);
            throw error;
        }
    },
};
