import React from 'react';
import PropTypes from 'prop-types';

const ApplicationActionCard = ({ title, description, icon, onClick }) => {
    return (
        <div
            onClick={onClick}
            className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-indigo-500 hover:shadow-md focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 cursor-pointer transition-all duration-200"
        >
            <div className="flex-shrink-0">
                <span className="text-4xl">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-500 truncate">{description}</p>
            </div>
        </div>
    );
};

ApplicationActionCard.propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
};

export default ApplicationActionCard;
