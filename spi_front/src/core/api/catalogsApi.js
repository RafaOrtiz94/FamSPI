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

export const catalogsApi = {
    // ===== EQUIPOS =====
    getEquipment: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/catalogs/equipment`, {
                params,
                ...getHeaders(),
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching equipment:', error);
            throw error;
        }
    },

    getEquipmentById: async (id) => {
        try {
            const response = await axios.get(`${API_URL}/catalogs/equipment/${id}`, getHeaders());
            return response.data;
        } catch (error) {
            console.error('Error fetching equipment by ID:', error);
            throw error;
        }
    },

    // ===== DETERMINACIONES =====
    getDeterminations: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/catalogs/determinations`, {
                params,
                ...getHeaders(),
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching determinations:', error);
            throw error;
        }
    },

    getDeterminationsByEquipment: async (equipmentId) => {
        try {
            const response = await axios.get(
                `${API_URL}/catalogs/determinations/by-equipment/${equipmentId}`,
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching determinations by equipment:', error);
            throw error;
        }
    },

    // ===== CONSUMIBLES =====
    getConsumables: async (params = {}) => {
        try {
            const response = await axios.get(`${API_URL}/catalogs/consumables`, {
                params,
                ...getHeaders(),
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching consumables:', error);
            throw error;
        }
    },

    getConsumablesByDetermination: async (determinationId) => {
        try {
            const response = await axios.get(
                `${API_URL}/catalogs/consumables/by-determination/${determinationId}`,
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching consumables by determination:', error);
            throw error;
        }
    },
};
