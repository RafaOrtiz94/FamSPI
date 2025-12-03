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

export const businessCaseApi = {
    /**
     * Calcula los requerimientos para una lista de determinaciones
     * @param {Array} items - [{ determinationId, annualVolume }]
     */
    calculate: async (items) => {
        try {
            const response = await axios.post(
                `${API_URL}/business-case/calculate`,
                { items },
                getHeaders()
            );
            return response.data;
        } catch (error) {
            console.error('Error calculating business case:', error);
            throw error;
        }
    },
};
