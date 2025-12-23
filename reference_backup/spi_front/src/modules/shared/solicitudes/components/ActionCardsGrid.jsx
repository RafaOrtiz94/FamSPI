import React from "react";
import ActionCard from "../../../../core/ui/patterns/ActionCard";

/**
 * Grid responsivo de action cards para crear solicitudes
 * @param {Object} props
 * @param {Array} props.cards - Array de configuración de action cards
 * @param {Function} props.onClick - Callback al hacer click en un card
 * @param {Object} props.columns - Configuración de columnas por breakpoint
 */
const ActionCardsGrid = ({ cards, onClick, columns = {} }) => {
    const {
        sm = 1,
        md = 2,
        lg = cards.length >= 6 ? 3 : cards.length >= 4 ? 2 : 3
    } = columns;

    const gridClasses = `grid grid-cols-${sm} md:grid-cols-${md} lg:grid-cols-${lg} gap-5`;

    return (
        <div className={gridClasses}>
            {cards.map((card) => (
                <div key={card.id} className="flex">
                    <ActionCard
                        icon={card.icon}
                        subtitle={card.subtitle}
                        title={card.title}
                        color={card.color}
                        description={card.description}
                        chips={card.chips}
                        onClick={() => onClick(card.id)}
                        disabled={card.disabled}
                    />
                </div>
            ))}
        </div>
    );
};

export default ActionCardsGrid;
